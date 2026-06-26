/**
 * Client-tag coverage for the generic publish hook (src/hooks/useNostrPublish.ts).
 *
 * Every event published through `useNostrPublish` must carry the NIP-89
 * `client` tag (suppressed only on non-https origins). This is the path used
 * by geocache edits (kind 37516 via `useEditGeocache`) and adventures
 * (kind 37517 via `useCreateAdventure`), so it guards the regression where
 * created/edited events shipped without attribution.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import type { EventTemplate, NostrEvent } from 'nostr-tools';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { NIP_GC_KINDS } from '@/utils/nip-gc';

const secretKey = generateSecretKey();
const pubkey = getPublicKey(secretKey);

const signedEvents: NostrEvent[] = [];

// The real client tag is suppressed on non-https origins; jsdom runs on
// http://localhost, so mock the helper deterministically.
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

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn().mockResolvedValue([]),
      event: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey,
      signer: {
        getPublicKey: async () => pubkey,
        signEvent: async (template: EventTemplate) => {
          const event = finalizeEvent(template, secretKey);
          signedEvents.push(event);
          return event;
        },
      },
    },
  }),
}));

vi.mock('@/utils/haptics', () => ({
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const CLIENT_TAG = ['client', 'Treasures', CLIENT_HANDLER_ADDRESS, CLIENT_HANDLER_RELAY];

describe('useNostrPublish — NIP-89 client tag', () => {
  beforeEach(() => {
    signedEvents.length = 0;
    clientTagEnabled = true;
  });

  it('adds the client tag to a geocache edit (kind 37516)', async () => {
    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    await result.current.mutateAsync({
      kind: NIP_GC_KINDS.GEOCACHE,
      content: 'edited',
      tags: [['d', 'abc123'], ['name', 'Edited Cache']],
    });

    expect(signedEvents).toHaveLength(1);
    expect(signedEvents[0].kind).toBe(NIP_GC_KINDS.GEOCACHE);
    expect(signedEvents[0].tags).toContainEqual(CLIENT_TAG);
  });

  it('adds the client tag to an adventure (kind 37517)', async () => {
    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    await result.current.mutateAsync({
      kind: NIP_GC_KINDS.ADVENTURE,
      content: 'an adventure',
      tags: [['d', 'adventure-1'], ['title', 'My Adventure']],
    });

    expect(signedEvents[0].kind).toBe(NIP_GC_KINDS.ADVENTURE);
    expect(signedEvents[0].tags).toContainEqual(CLIENT_TAG);
  });

  it('does not duplicate an existing client tag', async () => {
    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    await result.current.mutateAsync({
      kind: NIP_GC_KINDS.GEOCACHE,
      content: 'edited',
      tags: [['client', 'Treasures', CLIENT_HANDLER_ADDRESS, CLIENT_HANDLER_RELAY]],
    });

    const clientTags = signedEvents[0].tags.filter((t) => t[0] === 'client');
    expect(clientTags).toHaveLength(1);
  });

  it('omits the client tag on non-https origins', async () => {
    clientTagEnabled = false;
    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    await result.current.mutateAsync({
      kind: NIP_GC_KINDS.GEOCACHE,
      content: 'edited',
      tags: [['d', 'abc123']],
    });

    await waitFor(() => expect(signedEvents).toHaveLength(1));
    expect(signedEvents[0].tags.find((t) => t[0] === 'client')).toBeUndefined();
  });
});
