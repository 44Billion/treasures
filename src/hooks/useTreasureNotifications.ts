import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip57 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserGeocaches } from '@/hooks/useUserGeocaches';
import { useEncryptedSettings } from '@/hooks/useEncryptedSettings';
import {
  NIP_GC_KINDS,
  parseLogEvent,
  createGeocacheCoordinate,
} from '@/utils/nip-gc';
import { NIP_GD_KINDS } from '@/utils/nip-gd';
import {
  getEmbeddedVerification,
  verifyEmbeddedVerification,
} from '@/utils/verification';
import { TIMEOUTS, QUERY_LIMITS } from '@/config';
import type { Geocache } from '@/types/geocache';

/** Categories of activity that can generate a notification. */
export type TreasureNotificationType =
  | 'found'
  | 'dnf'
  | 'note'
  | 'maintenance'
  | 'archived'
  | 'zap'
  | 'good-deed';

export interface TreasureNotification {
  /** The underlying Nostr event id (stable React key). */
  id: string;
  /** The raw source event. */
  event: NostrEvent;
  /** Activity category. */
  type: TreasureNotificationType;
  /** Pubkey of the actor who generated the activity. */
  actorPubkey: string;
  /** Unix timestamp (seconds) of the activity. */
  createdAt: number;
  /** Coordinate (`kind:pubkey:dTag`) of the treasure this relates to. */
  geocacheCoordinate: string;
  /** The user's treasure this activity targets, if resolvable. */
  geocache?: Geocache;
  /** Zap amount in sats (only for `type === 'zap'`). */
  amountSats?: number;
  /** Log/note/deed text content, if any. */
  text?: string;
  /** True when a found log carries a valid embedded verification event. */
  isVerified?: boolean;
  /** True if newer than the read cursor. */
  isNew: boolean;
}

/** Extract zap amount (sats) from a kind 9735 receipt. */
function getZapAmountSats(event: NostrEvent): number {
  const bolt11 = event.tags.find((t) => t[0] === 'bolt11')?.[1];
  if (!bolt11) return 0;
  try {
    return nip57.getSatoshisAmountFromBolt11(bolt11);
  } catch {
    return 0;
  }
}

/** Map a parsed log's `type` to a notification type. */
function logTypeToNotificationType(
  type: string,
): TreasureNotificationType | null {
  switch (type) {
    case 'found':
      return 'found';
    case 'dnf':
      return 'dnf';
    case 'note':
      return 'note';
    case 'maintenance':
      return 'maintenance';
    case 'archived':
      return 'archived';
    default:
      return null;
  }
}

/**
 * Notifications for activity on the current user's own treasures.
 *
 * Surfaces found logs (7516), comment logs (1111: dnf/note/maintenance/note),
 * zaps (9735), and good deeds / Key Quest completions (5777) that reference any
 * treasure the user created. Events authored by the user themselves are
 * excluded.
 *
 * Read state is tracked via the NIP-78 notification cursor in
 * {@link useEncryptedSettings}; any event newer than the cursor is `isNew`.
 */
export function useTreasureNotifications() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: geocaches, isLoading: isLoadingGeocaches } = useUserGeocaches();
  const { settings, updateSettings } = useEncryptedSettings();

  const cursor = settings?.notifications?.cursor ?? 0;

  // Build the set of coordinates for the user's treasures, and a lookup so we
  // can attach the originating treasure to each notification. Each treasure is
  // indexed by its own coordinate only — legacy treasures (37515) use the
  // legacy coordinate, current ones (37516) use the canonical coordinate. We
  // deliberately do NOT add the alternate form, to keep the `#a` filter small.
  const { coordinates, byCoordinate } = useMemo(() => {
    const byCoordinate = new Map<string, Geocache>();
    const coordinates: string[] = [];

    for (const gc of geocaches ?? []) {
      const kind = gc.kind ?? NIP_GC_KINDS.GEOCACHE;
      const coord = createGeocacheCoordinate(gc.pubkey, gc.dTag, kind);
      coordinates.push(coord);
      byCoordinate.set(coord, gc);
    }

    return { coordinates, byCoordinate };
  }, [geocaches]);

  const coordinatesKey = coordinates.join(',');

  const query = useQuery({
    queryKey: ['treasure-notifications', user?.pubkey, coordinatesKey],
    queryFn: async (c) => {
      if (!user || coordinates.length === 0) return [];

      const signal = AbortSignal.any([
        c.signal,
        AbortSignal.timeout(TIMEOUTS.QUERY),
      ]);

      const filters = [
        {
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          '#a': coordinates,
          limit: QUERY_LIMITS.LOGS,
        },
        {
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#a': coordinates,
          limit: QUERY_LIMITS.LOGS,
        },
        {
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#A': coordinates,
          limit: QUERY_LIMITS.LOGS,
        },
        {
          kinds: [9735],
          '#a': coordinates,
          limit: QUERY_LIMITS.LOGS,
        },
        {
          kinds: [NIP_GD_KINDS.GOOD_DEED],
          '#a': coordinates,
          limit: QUERY_LIMITS.LOGS,
        },
      ];

      // EOSE / timeout race: stream events from a single multi-filter REQ and
      // resolve the moment relays signal EOSE (stored events exhausted), rather
      // than always blocking for the full TIMEOUTS.QUERY window. The abort
      // signal still caps the wait for slow / non-responsive relays.
      const events: NostrEvent[] = [];
      try {
        for await (const msg of nostr.req(filters, { signal })) {
          if (msg[0] === 'EVENT') {
            events.push(msg[2]);
          } else if (msg[0] === 'EOSE' || msg[0] === 'CLOSED') {
            break;
          }
        }
      } catch {
        // Aborted by timeout/unmount — return whatever arrived so far.
      }

      const seen = new Set<string>();
      const items: Omit<TreasureNotification, 'isNew' | 'geocache'>[] = [];

      for (const event of events) {
        if (seen.has(event.id)) continue;
        // Never notify the user about their own activity.
        if (event.pubkey === user.pubkey) continue;

        const coord = resolveCoordinate(event, byCoordinate);
        if (!coord) continue;
        const geocache = byCoordinate.get(coord);

        let type: TreasureNotificationType | null = null;
        let amountSats: number | undefined;
        let text: string | undefined;
        let isVerified: boolean | undefined;

        if (
          event.kind === NIP_GC_KINDS.FOUND_LOG ||
          event.kind === NIP_GC_KINDS.COMMENT_LOG
        ) {
          const log = parseLogEvent(event);
          if (!log) continue; // drops foreign / malformed 1111 events
          type = logTypeToNotificationType(log.type);
          text = log.text;

          // Validate embedded verification for found logs against the
          // treasure's verification pubkey (parseLogEvent leaves this false).
          if (type === 'found' && geocache?.verificationPubkey) {
            try {
              if (getEmbeddedVerification(event)) {
                isVerified = await verifyEmbeddedVerification(
                  event,
                  geocache.verificationPubkey,
                );
              }
            } catch {
              isVerified = false;
            }
          }
        } else if (event.kind === 9735) {
          type = 'zap';
          amountSats = getZapAmountSats(event);
          // Zap receipts carry the zapper's comment on the request's content.
          text = event.content || undefined;
        } else if (event.kind === NIP_GD_KINDS.GOOD_DEED) {
          type = 'good-deed';
          text = event.content || undefined;
        }

        if (!type) continue;

        seen.add(event.id);
        items.push({
          id: event.id,
          event,
          type,
          actorPubkey: event.pubkey,
          createdAt: event.created_at,
          geocacheCoordinate: coord,
          amountSats,
          text,
          isVerified,
        });
      }

      return items;
    },
    enabled: !!user && coordinates.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  const notifications = useMemo<TreasureNotification[]>(() => {
    if (!user) return [];
    return (query.data ?? [])
      .map((item) => ({
        ...item,
        geocache: byCoordinate.get(item.geocacheCoordinate),
        isNew: item.createdAt > cursor,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [query.data, user, byCoordinate, cursor]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.isNew).length,
    [notifications],
  );

  // Advance the read cursor to the newest notification timestamp.
  const markAsRead = async () => {
    if (notifications.length === 0) return;
    const newest = notifications[0].createdAt; // sorted newest-first
    if (newest <= cursor) return;
    if (!updateSettings) return;
    try {
      await updateSettings.mutateAsync({
        notifications: { ...(settings?.notifications ?? {}), cursor: newest },
      });
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    cursor,
    markAsRead,
    // Loading is true while the user's treasures are still loading, while the
    // notifications query is fetching for the first time, or while a fetch is
    // in flight with no data yet — so the page never flashes the empty state
    // before results have actually settled.
    isLoading:
      isLoadingGeocaches ||
      query.isLoading ||
      (query.isFetching && (query.data?.length ?? 0) === 0),
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Resolve which of the user's treasure coordinates an event references. Checks
 * every `a`/`A` tag against the known coordinate set so a reply whose first `a`
 * tag points at a parent comment still resolves to the owning treasure.
 */
function resolveCoordinate(
  event: NostrEvent,
  known: Map<string, Geocache>,
): string | null {
  for (const tag of event.tags) {
    if (tag[0] !== 'a' && tag[0] !== 'A') continue;
    const value = tag[1];
    if (value && known.has(value)) return value;
  }
  return null;
}
