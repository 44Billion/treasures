/**
 * useTreasureDrafts - NIP-37 encrypted draft management for geocache creation.
 *
 * Drafts are stored as kind 31234 events with the inner (unsigned) geocache
 * payload JSON-stringified and NIP-44-encrypted to the author's own pubkey.
 *
 * Each draft gets a unique d-tag so users can have multiple drafts.
 *
 * Two localStorage layers cooperate here:
 *
 *   1. Single-slot auto-save (`treasures-create-cache-draft`) — survives a
 *      browser reload while the user is mid-form. Always overwritten by the
 *      latest auto-save tick on the create page.
 *
 *   2. Multi-slot offline drafts (`lib/localDraftsStore`) — explicit "Save
 *      Draft" calls that couldn't reach the relay (or were made while
 *      offline). Keyed by slug, surfaced in the profile drafts list with a
 *      "Not synced" badge, and removed once a successful relay publish lands.
 */

import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { TIMEOUTS } from '@/config';
import type { Geocache } from '@/types/geocache';
import {
  listLocalDrafts,
  upsertLocalDraft,
  removeLocalDraft,
  markLocalDraftSynced,
  newLocalDraftSlug,
} from '@/lib/localDraftsStore';
import type {
  TreasureDraft,
  TreasureDraftPayload,
} from '@/hooks/useTreasureDrafts.types';

// Re-export the canonical types so existing `import { TreasureDraft } from
// '@/hooks/useTreasureDrafts'` callers keep working.
export type {
  TreasureDraft,
  TreasureDraftPayload,
} from '@/hooks/useTreasureDrafts.types';

// ── localStorage helpers (single-slot auto-save) ───────────────────────

const LOCAL_STORAGE_KEY = 'treasures-create-cache-draft';

export function loadLocalDraft(): TreasureDraftPayload | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      formData: parsed.formData,
      location: parsed.location ?? null,
      images: parsed.images ?? [],
      currentStep: parsed.currentStep ?? 1,
    };
  } catch {
    return null;
  }
}

export function saveLocalDraft(payload: TreasureDraftPayload): void {
  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify({ ...payload, savedAt: new Date().toISOString() }),
  );
}

export function clearLocalDraft(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

// ── Draft slug generation ──────────────────────────────────────────────

/** Generate a unique d-tag for a new draft. */
function newDraftSlug(): string {
  return newLocalDraftSlug();
}

// ── Convert a TreasureDraft into a Geocache-like object for cards ──────

export function draftToGeocache(draft: TreasureDraft, pubkey: string): Geocache & { syncStatus?: 'synced' | 'local' } {
  return {
    id: draft.eventId,
    pubkey,
    created_at: draft.updatedAt,
    dTag: draft.slug,
    kind: NIP_GC_KINDS.DRAFT,
    name: draft.formData.name || 'Untitled Draft',
    description: draft.formData.description || '',
    hint: draft.formData.hint || undefined,
    mission: draft.formData.mission || undefined,
    location: draft.location || { lat: 0, lng: 0 },
    difficulty: parseInt(draft.formData.difficulty) || 1,
    terrain: parseInt(draft.formData.terrain) || 1,
    size: (draft.formData.size as Geocache['size']) || 'regular',
    type: (draft.formData.type as Geocache['type']) || 'traditional',
    images: draft.images,
    contentWarning: draft.formData.contentWarning || undefined,
    hidden: true, // Drafts reuse the hidden badge
    // Extra field downstream UI (cards, profile) can read to mark local-only
    // drafts with a "Not synced" badge. Not part of the canonical Geocache
    // shape — see geocache-card for the consumer.
    syncStatus: draft.source,
  };
}

// ── Hook: create / save / delete drafts ────────────────────────────────

export function useTreasureDrafts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // ── Query: load ALL relay drafts for the current user, then merge with
  //          any local-only drafts saved while offline ──────────────────

  const relayDrafts = useQuery<TreasureDraft[]>({
    queryKey: ['treasure-drafts', user?.pubkey],
    enabled: !!user,
    staleTime: 5 * 60_000,
    // Surface local-only drafts immediately on the very first render —
    // they're synchronously available from localStorage and shouldn't have
    // to wait for the relay round-trip to appear in the profile list. The
    // `queryFn` below will replace this with the fully reconciled set
    // (synced + local) once the relay responds.
    placeholderData: () => {
      if (!user) return undefined;
      return listLocalDrafts(user.pubkey).map<TreasureDraft>(d => ({
        ...d.payload,
        slug: d.slug,
        updatedAt: Math.floor(new Date(d.savedAt).getTime() / 1000),
        eventId: `local:${d.slug}`,
        source: 'local',
      }));
    },
    queryFn: async (c) => {
      if (!user) return [];

      // 1) Pull the synced drafts off the relay (best-effort — if the relay
      //    is down we still return the local-only drafts below).
      let synced: TreasureDraft[] = [];
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
        const events = await nostr.query(
          [{
            kinds: [NIP_GC_KINDS.DRAFT],
            authors: [user.pubkey],
            '#k': [NIP_GC_KINDS.GEOCACHE.toString()],
            limit: 50,
          }],
          { signal },
        );

        if (user.signer.nip44) {
          for (const event of events) {
            // Blank content = deleted per NIP-37
            if (!event.content.trim()) continue;

            const slug = event.tags.find(t => t[0] === 'd')?.[1];
            if (!slug) continue;

            try {
              const plaintext = await user.signer.nip44.decrypt(user.pubkey, event.content);
              const inner = JSON.parse(plaintext) as TreasureDraftPayload;
              synced.push({
                ...inner,
                slug,
                updatedAt: event.created_at,
                eventId: event.id,
                source: 'synced',
              });
            } catch (err) {
              console.warn('[useTreasureDrafts] Failed to decrypt draft:', slug, err);
            }
          }
        }
      } catch (err) {
        // Relay unreachable — fall through and just surface the local-only
        // drafts below. The next refetch will reconcile.
        console.warn('[useTreasureDrafts] Failed to fetch relay drafts:', err);
        synced = [];
      }

      // 2) Garbage-collect any local-only drafts whose slugs have since been
      //    confirmed on the relay (a previous offline save that has now
      //    synced via some other path).
      const syncedSlugs = new Set(synced.map(d => d.slug));
      for (const slug of syncedSlugs) {
        markLocalDraftSynced(user.pubkey, slug);
      }

      // 3) Append local-only drafts (those whose slug isn't already in the
      //    synced set).
      const local = listLocalDrafts(user.pubkey)
        .filter(d => !syncedSlugs.has(d.slug))
        .map<TreasureDraft>(d => ({
          ...d.payload,
          slug: d.slug,
          // Convert ISO -> unix-seconds so the merged sort below works.
          updatedAt: Math.floor(new Date(d.savedAt).getTime() / 1000),
          // Local-only drafts have no relay event id; synthesise a stable one
          // so React keys don't collide between renders.
          eventId: `local:${d.slug}`,
          source: 'local',
        }));

      return [...synced, ...local].sort((a, b) => b.updatedAt - a.updatedAt);
    },
  });

  // ── Mutation: save a draft (relay if possible, falls back to local) ──

  const saveDraft = useMutation({
    mutationFn: async (params: {
      payload: TreasureDraftPayload;
      slug?: string;
    }) => {
      if (!user) throw new Error('User is not logged in');

      const { payload, slug: existingSlug } = params;
      const slug = existingSlug || newDraftSlug();

      // Always persist locally first (fast, offline-safe). This single-slot
      // copy mirrors the in-progress form and is cleared on a successful
      // relay publish.
      saveLocalDraft(payload);

      if (!user.signer.nip44) {
        // No encryption available — fall back to the multi-slot store so the
        // work isn't lost, then surface the underlying issue to the caller.
        upsertLocalDraft(user.pubkey, slug, payload, 'pending');
        throw new Error('Signer does not support NIP-44 encryption');
      }

      // Try the relay round-trip. On failure, persist to the multi-slot
      // local store (keyed by slug, so the user can have multiple un-synced
      // drafts) and re-throw so the caller can show the right UI.
      try {
        const plaintext = JSON.stringify(payload);
        const encrypted = await user.signer.nip44.encrypt(user.pubkey, plaintext);

        const event = await publishEvent({
          kind: NIP_GC_KINDS.DRAFT,
          content: encrypted,
          tags: [
            ['d', slug],
            ['k', NIP_GC_KINDS.GEOCACHE.toString()],
          ],
        });

        // Relay confirmed — drop any prior local-only copy under this slug.
        removeLocalDraft(user.pubkey, slug);

        return { event, slug, syncStatus: 'synced' as const };
      } catch (err) {
        upsertLocalDraft(user.pubkey, slug, payload, 'pending');
        throw err;
      }
    },
    onSuccess: () => {
      // Refresh the drafts list (synced + local both flow through this query).
      queryClient.invalidateQueries({ queryKey: ['treasure-drafts', user?.pubkey] });
    },
    onError: () => {
      // Even on relay error we may have written to the local store, so the
      // list should still refresh to surface the new local draft.
      queryClient.invalidateQueries({ queryKey: ['treasure-drafts', user?.pubkey] });
    },
  });

  // ── Mutation: delete a specific draft by slug + event ID ─────────

  const deleteDraft = useMutation({
    mutationFn: async ({ slug, eventId }: { slug: string; eventId: string }) => {
      if (!user) return;

      // Local-only drafts don't have a real relay event — just drop the
      // local copy. Their synthesised eventId starts with `local:`.
      if (eventId.startsWith('local:')) {
        removeLocalDraft(user.pubkey, slug);
        return;
      }

      const tags: string[][] = [
        ['e', eventId],
        ['a', `${NIP_GC_KINDS.DRAFT}:${user.pubkey}:${slug}`],
        ['k', NIP_GC_KINDS.DRAFT.toString()],
      ];

      // Publish a kind 5 (NIP-09) deletion event targeting the draft
      await publishEvent({
        kind: 5,
        content: '',
        tags,
      });

      // Also wipe any matching local copy so we don't resurrect it on the
      // next merge.
      removeLocalDraft(user.pubkey, slug);
    },
    onSuccess: (_data, { slug }) => {
      // Optimistically remove from cache before relay catches up
      queryClient.setQueryData<TreasureDraft[]>(
        ['treasure-drafts', user?.pubkey],
        (old) => (old || []).filter(d => d.slug !== slug),
      );
      queryClient.invalidateQueries({ queryKey: ['treasure-drafts', user?.pubkey] });
    },
  });

  return {
    /** All drafts (synced + local-only) for the current user. */
    relayDrafts,
    /** Save a draft. Tries relay first; falls back to local on failure or when `offlineOnly: true`. */
    saveDraft,
    /** Delete a draft. Handles both relay-backed and local-only drafts. */
    deleteDraft,
    /** Quick local-only helpers (used by auto-save). */
    local: {
      load: loadLocalDraft,
      save: saveLocalDraft,
      clear: clearLocalDraft,
    },
  };
}
