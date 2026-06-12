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
import { useLogStore } from '@/stores/useLogStore';
import { NIP_GC_KINDS } from '@/utils/nip-gc';

const OWNER = '0'.repeat(63) + '1';
const DTAG = 'test-dtag';
const COORDINATE = `${NIP_GC_KINDS.GEOCACHE}:${OWNER}:${DTAG}`;

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
      event: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

describe('useLogStore.fetchLogs', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockQuery.mockReset();
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
