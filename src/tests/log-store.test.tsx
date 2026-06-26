/**
 * Log store tests (src/stores/useLogStore.ts).
 *
 * Exercises fetchLogs against a mocked relay pool using the real protocol
 * kinds (7516 found logs, 1111 NIP-22 comment logs) and the real
 * parseLogEvent implementation, so parsing/filtering/sorting regressions
 * are caught here.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import type { EventTemplate } from 'nostr-tools';
import { useLogStore } from '@/stores/useLogStore';
import { NIP_GC_KINDS } from '@/utils/nip-gc';

const OWNER = '0'.repeat(63) + '1';
const DTAG = 'test-dtag';
const COORDINATE = `${NIP_GC_KINDS.GEOCACHE}:${OWNER}:${DTAG}`;

const logSecretKey = generateSecretKey();
const logPubkey = getPublicKey(logSecretKey);

// Events captured from the relay `event()` call (used by the createLog suite).
const publishedEvents: NostrEvent[] = [];

// Toggle whether a logged-in signer is present (fetchLogs runs unauthenticated).
let currentUser: { pubkey: string; signer: { getPublicKey: () => Promise<string>; signEvent: (t: EventTemplate) => Promise<NostrEvent> } } | null = null;

// Deterministic client-tag mock (the real helper is suppressed on http origins).
const CLIENT_HANDLER_ADDRESS = '31990:86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47:cgdgkgvtgnb';
const CLIENT_HANDLER_RELAY = 'wss://relay.ditto.pub';
let clientTagEnabled = true;

vi.mock('@/lib/clientTag', () => ({
  ensureClientTag: (tags: string[][]) => {
    if (!clientTagEnabled) return;
    if (tags.some(([name]) => name === 'client')) return;
    tags.push(['client', 'Treasures', CLIENT_HANDLER_ADDRESS, CLIENT_HANDLER_RELAY]);
  },
}));

function foundLog(id: string, createdAt: number, pubkey = 'f'.repeat(64)): NostrEvent {
  return {
    id,
    kind: NIP_GC_KINDS.FOUND_LOG,
    pubkey,
    content: `Found it (${id})`,
    tags: [['a', COORDINATE]],
    created_at: createdAt,
    sig: 'sig',
  };
}

function commentLog(id: string, createdAt: number, type = 'dnf'): NostrEvent {
  return {
    id,
    kind: NIP_GC_KINDS.COMMENT_LOG,
    pubkey: 'c'.repeat(64),
    content: `Comment (${id})`,
    tags: [
      ['a', COORDINATE],
      ['A', COORDINATE],
      ['k', NIP_GC_KINDS.GEOCACHE.toString()],
      ['K', NIP_GC_KINDS.GEOCACHE.toString()],
      ['t', type],
    ],
    created_at: createdAt,
    sig: 'sig',
  };
}

const mockQuery = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: (...args: unknown[]) => mockQuery(...args),
      event: vi.fn().mockImplementation(async (event: NostrEvent) => {
        publishedEvents.push(event);
      }),
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser }),
}));

describe('useLogStore.fetchLogs', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockQuery.mockReset();
    currentUser = null;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('parses, merges, and sorts found and comment logs newest-first', async () => {
    mockQuery.mockImplementation(async (filters: Array<{ kinds?: number[] }>) => {
      const kinds = filters[0]?.kinds ?? [];
      if (kinds.includes(NIP_GC_KINDS.FOUND_LOG)) {
        return [foundLog('found-1', 100), foundLog('found-2', 300)];
      }
      if (kinds.includes(NIP_GC_KINDS.COMMENT_LOG)) {
        return [commentLog('dnf-1', 200)];
      }
      return [];
    });

    const { result } = renderHook(() => useLogStore(), { wrapper });

    const res = await result.current.fetchLogs(`${OWNER}:${DTAG}`);
    expect(res.success).toBe(true);

    const logs = res.data!;
    // Comment logs are returned by both the #a and #A queries; the parser
    // doesn't dedupe (callers do), so just verify ordering and content.
    expect(logs.map((l) => l.id)).toEqual(['found-2', 'dnf-1', 'dnf-1', 'found-1']);
    expect(logs[0].type).toBe('found');
    expect(logs[1].type).toBe('dnf');
    expect(logs[0].geocacheId).toBe(`${OWNER}:${DTAG}`);
    await waitFor(() => expect(mockQuery).toHaveBeenCalled());
  });

  it('filters out malformed events instead of failing', async () => {
    const malformed: NostrEvent = {
      id: 'bad-1',
      kind: NIP_GC_KINDS.FOUND_LOG,
      pubkey: 'f'.repeat(64),
      content: 'no a-tag',
      tags: [],
      created_at: 100,
      sig: 'sig',
    };
    const wrongKindRef: NostrEvent = {
      ...foundLog('bad-2', 110),
      tags: [['a', `30023:${OWNER}:${DTAG}`]], // not a geocache reference
    };

    mockQuery.mockImplementation(async (filters: Array<{ kinds?: number[] }>) => {
      const kinds = filters[0]?.kinds ?? [];
      if (kinds.includes(NIP_GC_KINDS.FOUND_LOG)) {
        return [malformed, wrongKindRef, foundLog('good-1', 120)];
      }
      return [];
    });

    const { result } = renderHook(() => useLogStore(), { wrapper });
    const res = await result.current.fetchLogs(`${OWNER}:${DTAG}`);

    expect(res.success).toBe(true);
    expect(res.data!.map((l) => l.id)).toEqual(['good-1']);
  });

  it('rejects comment logs with invalid type tags', async () => {
    mockQuery.mockImplementation(async (filters: Array<{ kinds?: number[] }>) => {
      const kinds = filters[0]?.kinds ?? [];
      if (kinds.includes(NIP_GC_KINDS.COMMENT_LOG)) {
        // The #a and #A queries both return these; dedupe is the caller's job
        return [commentLog('valid-note', 100, 'note'), commentLog('invalid-type', 110, 'spam')];
      }
      return [];
    });

    const { result } = renderHook(() => useLogStore(), { wrapper });
    const res = await result.current.fetchLogs(`${OWNER}:${DTAG}`);

    expect(res.success).toBe(true);
    expect(res.data!.every((l) => l.id === 'valid-note')).toBe(true);
  });

  it('degrades gracefully (empty success) when all relay queries fail', async () => {
    mockQuery.mockRejectedValue(new Error('relay exploded'));

    const { result } = renderHook(() => useLogStore(), { wrapper });
    const res = await result.current.fetchLogs(`${OWNER}:${DTAG}`);

    // separateQueries swallows individual query failures so one bad relay
    // doesn't sink the whole fetch; the result is a successful empty list.
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });
});

describe('useLogStore.createLog client tag', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockQuery.mockResolvedValue([]);
    publishedEvents.length = 0;
    clientTagEnabled = true;
    currentUser = {
      pubkey: logPubkey,
      signer: {
        getPublicKey: async () => logPubkey,
        signEvent: async (template: EventTemplate) => finalizeEvent(template, logSecretKey),
      },
    };
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const baseLog = {
    geocacheId: DTAG,
    geocachePubkey: OWNER,
    geocacheKind: NIP_GC_KINDS.GEOCACHE,
  };

  const clientTagOf = (event: NostrEvent) => event.tags.find((t) => t[0] === 'client');

  it('attaches the NIP-89 client tag to found logs (kind 7516)', async () => {
    const { result } = renderHook(() => useLogStore(), { wrapper });

    const res = await result.current.createLog({ ...baseLog, type: 'found', text: 'Found it!' });
    expect(res.success).toBe(true);

    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0].kind).toBe(NIP_GC_KINDS.FOUND_LOG);
    expect(clientTagOf(publishedEvents[0])).toEqual([
      'client',
      'Treasures',
      CLIENT_HANDLER_ADDRESS,
      CLIENT_HANDLER_RELAY,
    ]);
  });

  it('attaches the NIP-89 client tag to comment logs (kind 1111)', async () => {
    const { result } = renderHook(() => useLogStore(), { wrapper });

    const res = await result.current.createLog({ ...baseLog, type: 'dnf', text: 'Could not find it.' });
    expect(res.success).toBe(true);

    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0].kind).toBe(NIP_GC_KINDS.COMMENT_LOG);
    expect(clientTagOf(publishedEvents[0])).toEqual([
      'client',
      'Treasures',
      CLIENT_HANDLER_ADDRESS,
      CLIENT_HANDLER_RELAY,
    ]);
  });

  it('omits the client tag on non-https origins', async () => {
    clientTagEnabled = false;
    const { result } = renderHook(() => useLogStore(), { wrapper });

    const res = await result.current.createLog({ ...baseLog, type: 'found', text: 'Found it!' });
    expect(res.success).toBe(true);
    expect(clientTagOf(publishedEvents[0])).toBeUndefined();
  });
});
