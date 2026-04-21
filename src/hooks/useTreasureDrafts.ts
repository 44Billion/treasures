/**
 * useTreasureDrafts - NIP-37 encrypted draft management for geocache creation.
 *
 * Drafts are stored as kind 31234 events with the inner (unsigned) geocache
 * payload JSON-stringified and NIP-44-encrypted to the author's own pubkey.
 *
 * Each draft gets a unique d-tag so users can have multiple drafts.
 * A parallel localStorage copy is kept so the in-progress form survives
 * browser backgrounding while the relay round-trip is still in flight.
 */

import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { TIMEOUTS } from '@/config';
import type { GeocacheFormData } from '@/types/geocache-form';
import type { Geocache } from '@/types/geocache';

// ── Types ──────────────────────────────────────────────────────────────

/** The full state that gets persisted inside a draft. */
export interface TreasureDraftPayload {
  formData: GeocacheFormData;
  location: { lat: number; lng: number } | null;
  images: string[];
  currentStep: number;
}

/** A draft record enriched with metadata for display. */
export interface TreasureDraft extends TreasureDraftPayload {
  /** The d-tag used as the addressable identifier on the relay. */
  slug: string;
  /** Unix-seconds timestamp of the wrapping kind-31234 event. */
  updatedAt: number;
  /** The Nostr event id of the kind 31234 wrapper. */
  eventId: string;
}

// ── localStorage helpers ───────────────────────────────────────────────

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
  return `geocache-draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Convert a TreasureDraft into a Geocache-like object for cards ──────

export function draftToGeocache(draft: TreasureDraft, pubkey: string): Geocache {
  return {
    id: draft.eventId,
    pubkey,
    created_at: draft.updatedAt,
    dTag: draft.slug,
    kind: NIP_GC_KINDS.DRAFT,
    name: draft.formData.name || 'Untitled Draft',
    description: draft.formData.description || '',
    hint: draft.formData.hint || undefined,
    location: draft.location || { lat: 0, lng: 0 },
    difficulty: parseInt(draft.formData.difficulty) || 1,
    terrain: parseInt(draft.formData.terrain) || 1,
    size: (draft.formData.size as Geocache['size']) || 'regular',
    type: (draft.formData.type as Geocache['type']) || 'traditional',
    images: draft.images,
    contentWarning: draft.formData.contentWarning || undefined,
    hidden: true, // Drafts reuse the hidden badge
  };
}

// ── Hook: create / save / delete drafts ────────────────────────────────

export function useTreasureDrafts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // ── Query: load ALL relay drafts for the current user ──────────────

  const relayDrafts = useQuery<TreasureDraft[]>({
    queryKey: ['treasure-drafts', user?.pubkey],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (c) => {
      if (!user) return [];

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

      if (!user.signer.nip44) return [];

      const drafts: TreasureDraft[] = [];
      for (const event of events) {
        // Blank content = deleted per NIP-37
        if (!event.content.trim()) continue;

        const slug = event.tags.find(t => t[0] === 'd')?.[1];
        if (!slug) continue;

        try {
          const plaintext = await user.signer.nip44.decrypt(user.pubkey, event.content);
          const inner = JSON.parse(plaintext) as TreasureDraftPayload;
          drafts.push({
            ...inner,
            slug,
            updatedAt: event.created_at,
            eventId: event.id,
          });
        } catch (err) {
          console.warn('[useTreasureDrafts] Failed to decrypt draft:', slug, err);
        }
      }

      return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
    },
  });

  // ── Mutation: save a new draft (or overwrite by slug) to relay ──────

  const saveDraft = useMutation({
    mutationFn: async (params: { payload: TreasureDraftPayload; slug?: string }) => {
      if (!user) throw new Error('User is not logged in');
      if (!user.signer.nip44) throw new Error('Signer does not support NIP-44 encryption');

      const { payload, slug: existingSlug } = params;
      const slug = existingSlug || newDraftSlug();

      // Always persist locally first (fast, offline-safe)
      saveLocalDraft(payload);

      // Encrypt and publish to relay
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

      return { event, slug };
    },
    onSuccess: () => {
      // Refresh the drafts list
      queryClient.invalidateQueries({ queryKey: ['treasure-drafts', user?.pubkey] });
    },
  });

  // ── Mutation: delete a specific draft by slug + event ID ─────────

  const deleteDraft = useMutation({
    mutationFn: async ({ slug, eventId }: { slug: string; eventId: string }) => {
      if (!user) return;

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
    /** All relay drafts for the current user. */
    relayDrafts,
    /** Save a draft to localStorage + relay. Pass slug to overwrite an existing draft. */
    saveDraft,
    /** Delete a specific draft from the relay (kind 5). */
    deleteDraft,
    /** Quick local-only helpers (used by auto-save). */
    local: {
      load: loadLocalDraft,
      save: saveLocalDraft,
      clear: clearLocalDraft,
    },
  };
}
