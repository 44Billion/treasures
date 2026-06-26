/**
 * Geocache store tests (src/stores/useGeocacheStore.ts).
 *
 * Covers createGeocache: NIP-GC validation rules, produced event shape
 * (kind 37516, required tags), and relay hints sourced from the user's
 * effective relay configuration.
 */
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import type { EventTemplate, NostrEvent } from 'nostr-tools';
import { useGeocacheStore } from '@/stores/useGeocacheStore';
import type { Geocache } from '@/types/geocache';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { APP_RELAYS } from '@/lib/appRelays';

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);

const publishedEvents: NostrEvent[] = [];

// The real client tag is suppressed on non-https origins. jsdom runs on
// http://localhost, so we mock the helper to deterministically toggle the
// tag on/off and assert both branches.
const CLIENT_HANDLER_ADDRESS = '31990:86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47:cgdgkgvtgnb';
const CLIENT_HANDLER_RELAY = 'wss://relay.ditto.pub';
let clientTagEnabled = true;
const setClientTagEnabled = (enabled: boolean) => {
  clientTagEnabled = enabled;
};

vi.mock('@/lib/clientTag', () => ({
  ensureClientTag: (tags: string[][]) => {
    if (!clientTagEnabled) return;
    if (tags.some(([name]) => name === 'client')) return;
    tags.push(['client', 'Treasures', CLIENT_HANDLER_ADDRESS, CLIENT_HANDLER_RELAY]);
  },
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn().mockResolvedValue([]),
      event: vi.fn().mockImplementation(async (event: NostrEvent) => {
        publishedEvents.push(event);
      }),
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
      // No user relays — effective relays fall back to APP_RELAYS
      relayMetadata: { relays: [], updatedAt: 0 },
      useAppRelays: true,
      useUserRelays: false,
    },
  }),
}));

const validGeocache: Partial<Geocache> = {
  name: 'Test Treasure',
  description: 'A test cache hidden in the woods',
  location: { lat: 40.7128, lng: -74.006 },
  difficulty: 2,
  terrain: 3,
  size: 'small',
  type: 'traditional',
};

describe('useGeocacheStore.createGeocache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    publishedEvents.length = 0;
    setClientTagEnabled(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('publishes a kind 37516 event with required NIP-GC tags', async () => {
    const { result } = renderHook(() => useGeocacheStore(), { wrapper });

    const res = await result.current.createGeocache(validGeocache);
    expect(res.success).toBe(true);

    expect(publishedEvents).toHaveLength(1);
    const event = publishedEvents[0];
    expect(event.kind).toBe(NIP_GC_KINDS.GEOCACHE);
    expect(event.pubkey).toBe(pubkey);
    expect(event.content).toBe(validGeocache.description);

    const tag = (name: string) => event.tags.find((t) => t[0] === name)?.[1];
    expect(tag('d')).toMatch(/^[0-9a-f]{6}$/); // compact d-tag
    expect(tag('name')).toBe('Test Treasure');
    expect(tag('g')).toBeTruthy(); // geohash
    expect(tag('D')).toBe('2');
    expect(tag('T')).toBe('3');
    expect(tag('S')).toBe('small');
    // 't' is omitted for 'traditional' (the NIP-GC default type)
    expect(tag('t')).toBeUndefined();
    expect(tag('verification')).toMatch(/^[0-9a-f]{64}$/);

    // Parsed geocache comes back to the caller
    expect(res.data?.geocache.name).toBe('Test Treasure');
  });

  it('attaches the NIP-89 client tag on create (https origin)', async () => {
    setClientTagEnabled(true);
    const { result } = renderHook(() => useGeocacheStore(), { wrapper });
    await result.current.createGeocache(validGeocache);

    const clientTag = publishedEvents[0].tags.find((t) => t[0] === 'client');
    expect(clientTag).toEqual(['client', 'Treasures', CLIENT_HANDLER_ADDRESS, CLIENT_HANDLER_RELAY]);
  });

  it('omits the client tag on non-https origins', async () => {
    setClientTagEnabled(false);
    const { result } = renderHook(() => useGeocacheStore(), { wrapper });
    await result.current.createGeocache(validGeocache);

    const clientTag = publishedEvents[0].tags.find((t) => t[0] === 'client');
    expect(clientTag).toBeUndefined();
  });

  it('attaches relay hints from the effective (app) relays', async () => {
    const { result } = renderHook(() => useGeocacheStore(), { wrapper });
    await result.current.createGeocache(validGeocache);

    const rTags = publishedEvents[0].tags.filter((t) => t[0] === 'r').map((t) => t[1]);
    const appWriteRelays = APP_RELAYS.relays.filter((r) => r.write).map((r) => r.url);
    expect(rTags.length).toBeGreaterThan(0);
    for (const url of rTags) {
      expect(appWriteRelays).toContain(url);
    }
  });

  it.each([
    ['missing name', { ...validGeocache, name: '  ' }],
    ['missing description', { ...validGeocache, description: '' }],
    ['bad difficulty', { ...validGeocache, difficulty: 9 }],
    ['bad terrain', { ...validGeocache, terrain: 0 }],
    ['invalid type', { ...validGeocache, type: 'evil' }],
    ['invalid size', { ...validGeocache, size: 'gigantic' }],
    ['invalid coordinates', { ...validGeocache, location: { lat: 999, lng: 0 } }],
  ])('rejects %s', async (_label, data) => {
    const { result } = renderHook(() => useGeocacheStore(), { wrapper });

    const res = await result.current.createGeocache(data as Partial<Geocache>);
    expect(res.success).toBe(false);
    expect(res.error).toBeInstanceOf(Error);
    expect(publishedEvents).toHaveLength(0);
  });
});
