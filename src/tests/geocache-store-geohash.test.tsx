/**
 * Tests for useGeocacheStore.fetchGeocachesByGeohash — viewport-scoped local
 * discovery. Verifies the relay `#g` filter is built from the supplied prefixes
 * and that newly-fetched treasures are merged into the shared list cache,
 * deduped by addressable id (newest version wins).
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import type { EventTemplate, NostrEvent } from 'nostr-tools';
import { useGeocacheStore } from '@/stores/useGeocacheStore';
import { NIP_GC_KINDS, encodeGeohash } from '@/utils/nip-gc';

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);

const queryMock = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: queryMock,
      event: vi.fn(),
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey,
      signer: {
        getPublicKey: async () => pubkey,
        signEvent: async (template: EventTemplate) => finalizeEvent(template, secretKey),
      },
    },
  }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: {
      relayMetadata: { relays: [], updatedAt: 0 },
      useAppRelays: true,
      useUserRelays: false,
    },
  }),
}));

/** Build a valid kind-37516 treasure event at the given coordinates. */
function makeTreasureEvent(opts: {
  d: string;
  lat: number;
  lng: number;
  created_at: number;
  name?: string;
}): NostrEvent {
  const { d, lat, lng, created_at, name = 'Cache' } = opts;
  const tags: string[][] = [
    ['d', d],
    ['name', name],
    ['D', '2'],
    ['T', '3'],
    ['S', 'small'],
  ];
  // Multiple geohash precisions, matching how the app writes them.
  for (let p = 3; p <= 6; p++) tags.push(['g', encodeGeohash(lat, lng, p)]);

  return finalizeEvent(
    { kind: NIP_GC_KINDS.GEOCACHE, content: 'desc', tags, created_at },
    secretKey,
  );
}

describe('useGeocacheStore.fetchGeocachesByGeohash', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryMock.mockReset();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('queries relays with a #g filter built from the given prefixes', async () => {
    queryMock.mockResolvedValue([]);
    const { result } = renderHook(() => useGeocacheStore(), { wrapper });

    const prefixes = ['u33db', 'u33dc'];
    await result.current.fetchGeocachesByGeohash(prefixes);

    // Find the call that used the #g filter (other calls are the list query).
    const gCall = queryMock.mock.calls.find(
      ([filters]) => Array.isArray(filters) && filters[0] && '#g' in filters[0],
    );
    expect(gCall).toBeTruthy();
    const filter = gCall![0][0];
    expect(filter.kinds).toEqual([NIP_GC_KINDS.GEOCACHE]);
    expect(filter['#g']).toEqual(prefixes);
  });

  it('merges fetched treasures into the list cache, newest version wins', async () => {
    const lat = 52.52;
    const lng = 13.405;
    const prefix = encodeGeohash(lat, lng, 5);

    const older = makeTreasureEvent({ d: 'abc', lat, lng, created_at: 1000, name: 'Old' });
    const newer = makeTreasureEvent({ d: 'abc', lat, lng, created_at: 2000, name: 'New' });

    // First the #g query returns the older version, then a later query the newer.
    queryMock.mockImplementation(async (filters: { '#g'?: string[] }[]) => {
      if (filters[0] && '#g' in filters[0]) {
        return queryMock.mock.calls.filter(
          ([f]) => f[0] && '#g' in f[0],
        ).length === 1
          ? [older]
          : [newer];
      }
      return [];
    });

    const { result } = renderHook(() => useGeocacheStore(), { wrapper });

    const first = await result.current.fetchGeocachesByGeohash([prefix]);
    expect(first.success).toBe(true);
    expect(first.data?.some((g) => g.name === 'Old')).toBe(true);

    const second = await result.current.fetchGeocachesByGeohash([prefix]);
    expect(second.success).toBe(true);

    await waitFor(() => {
      // Deduped to a single entry, upgraded to the newer version.
      const matches = (second.data ?? []).filter((g) => g.dTag === 'abc');
      expect(matches).toHaveLength(1);
      expect(matches[0]?.name).toBe('New');
    });
  });

  it('returns the existing list unchanged when no prefixes are given', async () => {
    queryMock.mockResolvedValue([]);
    const { result } = renderHook(() => useGeocacheStore(), { wrapper });

    const res = await result.current.fetchGeocachesByGeohash([]);
    expect(res.success).toBe(true);
    // No #g query should have been issued.
    const gCall = queryMock.mock.calls.find(
      ([filters]) => Array.isArray(filters) && filters[0] && '#g' in filters[0],
    );
    expect(gCall).toBeUndefined();
  });
});
