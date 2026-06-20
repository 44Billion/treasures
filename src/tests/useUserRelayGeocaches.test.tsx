/**
 * Tests for `useUserRelayGeocaches` — discovering a profile owner's treasures
 * on their own NIP-65 relays.
 *
 * Verifies:
 *  - We fetch the owner's kind-10002 relay list, query each of their *write*
 *    relays directly, and aggregate the results.
 *  - App-default relays are skipped (already covered by `useUserGeocaches`).
 *  - Results are deduped by addressable coordinate (kind:pubkey:dTag), keeping
 *    the newest version.
 *  - Hidden caches are filtered out unless viewing your own profile.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserRelayGeocaches } from '@/hooks/useUserRelayGeocaches';
import { NIP_GC_KINDS, encodeGeohash } from '@/utils/nip-gc';
import type { NostrEvent } from '@nostrify/nostrify';

const OWNER = '0'.repeat(63) + '1';

// --- mock the viewer's pool used to fetch the kind-10002 relay list ---
const poolQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: poolQuery } }),
}));

// --- mock the per-relay direct connections (dynamic import in the hook) ---
// Maps relay URL -> events the relay returns.
const relayEvents = new Map<string, NostrEvent[]>();
const closeSpy = vi.fn();
vi.mock('@nostrify/nostrify', () => ({
  NRelay1: class {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
    query() {
      // The hook strips trailing slashes from relay URLs; normalize lookups so
      // fixtures can be written with or without a trailing slash.
      const norm = this.url.replace(/\/+$/, '');
      return Promise.resolve(
        relayEvents.get(this.url) ?? relayEvents.get(norm) ?? relayEvents.get(`${norm}/`) ?? [],
      );
    }
    close() {
      closeSpy(this.url);
    }
  },
}));

function geocacheEvent(opts: {
  id: string;
  pubkey?: string;
  dTag: string;
  name: string;
  createdAt: number;
  hidden?: boolean;
}): NostrEvent {
  const tags: string[][] = [
    ['d', opts.dTag],
    ['name', opts.name],
    ['D', '2'],
    ['T', '2'],
    ['S', 'small'],
    ['g', encodeGeohash(40.7128, -74.006, 6)],
    ['t', 'traditional'],
  ];
  if (opts.hidden) tags.push(['t', 'hidden']);
  return {
    id: opts.id,
    kind: NIP_GC_KINDS.GEOCACHE,
    pubkey: opts.pubkey ?? OWNER,
    content: '',
    tags,
    created_at: opts.createdAt,
    sig: 'sig',
  };
}

function relayListEvent(relays: [string, string?][]): NostrEvent {
  return {
    id: 'relaylist',
    kind: 10002,
    pubkey: OWNER,
    content: '',
    tags: relays.map(([url, marker]) => (marker ? ['r', url, marker] : ['r', url])),
    created_at: 1700000000,
    sig: 'sig',
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useUserRelayGeocaches', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    relayEvents.clear();
    closeSpy.mockReset();
  });

  it('returns empty when the owner has no NIP-65 relay list', async () => {
    poolQuery.mockResolvedValue([]); // no kind 10002

    const { result } = renderHook(() => useUserRelayGeocaches(OWNER), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('queries the owner write relays and aggregates results, skipping app defaults', async () => {
    poolQuery.mockResolvedValue([
      relayListEvent([
        ['wss://relay.ditto.pub/'], // app default — should be skipped
        ['wss://relay.example-a.com/'],
        ['wss://relay.example-b.com/'],
        ['wss://relay.readonly.com/', 'read'], // read-only — should be skipped
      ]),
    ]);

    relayEvents.set('wss://relay.example-a.com/', [
      geocacheEvent({ id: 'a1', dTag: 'cache-a', name: 'Cache A', createdAt: 100 }),
    ]);
    relayEvents.set('wss://relay.example-b.com/', [
      geocacheEvent({ id: 'b1', dTag: 'cache-b', name: 'Cache B', createdAt: 200 }),
    ]);

    const { result } = renderHook(() => useUserRelayGeocaches(OWNER), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.map((g) => g.dTag).sort()).toEqual(['cache-a', 'cache-b']);
    // Newest first
    expect(data[0]!.dTag).toBe('cache-b');
    // App-default + read-only relays were never connected.
    const closedUrls = closeSpy.mock.calls.map((c) => c[0]);
    expect(closedUrls).toContain('wss://relay.example-a.com');
    expect(closedUrls).toContain('wss://relay.example-b.com');
    expect(closedUrls).not.toContain('wss://relay.ditto.pub');
    expect(closedUrls).not.toContain('wss://relay.readonly.com');
  });

  it('dedupes the same cache across relays, keeping the newest version', async () => {
    poolQuery.mockResolvedValue([
      relayListEvent([['wss://relay.example-a.com/'], ['wss://relay.example-b.com/']]),
    ]);

    relayEvents.set('wss://relay.example-a.com/', [
      geocacheEvent({ id: 'old', dTag: 'dup', name: 'Old Name', createdAt: 100 }),
    ]);
    relayEvents.set('wss://relay.example-b.com/', [
      geocacheEvent({ id: 'new', dTag: 'dup', name: 'New Name', createdAt: 300 }),
    ]);

    const { result } = renderHook(() => useUserRelayGeocaches(OWNER), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data).toHaveLength(1);
    expect(data[0]!.created_at).toBe(300);
    expect(data[0]!.name).toBe('New Name');
  });

  it('hides hidden caches for other people but shows them on your own profile', async () => {
    poolQuery.mockResolvedValue([relayListEvent([['wss://relay.example-a.com/']])]);
    relayEvents.set('wss://relay.example-a.com/', [
      geocacheEvent({ id: 'h1', dTag: 'secret', name: 'Secret', createdAt: 100, hidden: true }),
      geocacheEvent({ id: 'p1', dTag: 'public', name: 'Public', createdAt: 100 }),
    ]);

    const wrapper = createWrapper();

    const other = renderHook(() => useUserRelayGeocaches(OWNER, false), { wrapper });
    await waitFor(() => expect(other.result.current.isSuccess).toBe(true));
    expect(other.result.current.data!.map((g) => g.dTag)).toEqual(['public']);

    const own = renderHook(() => useUserRelayGeocaches(OWNER, true), { wrapper });
    await waitFor(() => expect(own.result.current.isSuccess).toBe(true));
    expect(own.result.current.data!.map((g) => g.dTag).sort()).toEqual(['public', 'secret']);
  });

  it('is disabled without a target pubkey', async () => {
    const { result } = renderHook(() => useUserRelayGeocaches(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(poolQuery).not.toHaveBeenCalled();
  });
});
