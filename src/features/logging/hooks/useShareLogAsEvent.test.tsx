import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShareLogAsEvent } from './useShareLogAsEvent';

// Mock the modules
const mockUseNostrPublish = vi.fn();
const mockGeocacheToNaddr = vi.fn(() => 'naddr1test');

vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => mockUseNostrPublish(),
}));

vi.mock('@/shared/utils/naddr', () => ({
  geocacheToNaddr: () => mockGeocacheToNaddr(),
}));

describe('useShareLogAsEvent', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNostrPublish.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('should return shareLogAsEvent function and isPublishing state', () => {
    const { result } = renderHook(() => useShareLogAsEvent(), { wrapper });

    expect(result.current.shareLogAsEvent).toBeDefined();
    expect(typeof result.current.shareLogAsEvent).toBe('function');
    expect(result.current.isPublishing).toBe(false);
  });

  it('should format content correctly for found log', async () => {
    const mockMutate = vi.fn();
    mockUseNostrPublish.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    const { result } = renderHook(() => useShareLogAsEvent(), { wrapper });

    const geocache = {
      id: 'test-id',
      name: 'Test Geocache',
      dTag: 'test-dtag',
      pubkey: 'test-pubkey',
      relays: ['wss://relay.example.com'],
      kind: 37516,
    };

    const logText = 'This was an amazing find!';
    const logType = 'found' as const;

    await result.current.shareLogAsEvent({
      geocache,
      logText,
      logType,
      isVerified: false,
    });

    expect(mockMutate).toHaveBeenCalledWith({
      kind: 1,
      content: `Just found a treasure! #treasures #geocache

🧭 Test Geocache
https://treasures.to/naddr1test

My experience:
"This was an amazing find!"`,
      tags: [
        ['t', 'treasures'],
        ['r', 'https://treasures.to/naddr1test'],
        ['client', 'treasures'],
      ],
    });
  });

  it('should format content correctly for verified found log', async () => {
    const mockMutate = vi.fn();
    mockUseNostrPublish.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    const { result } = renderHook(() => useShareLogAsEvent(), { wrapper });

    const geocache = {
      id: 'test-id',
      name: 'Test Geocache',
      dTag: 'test-dtag',
      pubkey: 'test-pubkey',
      relays: ['wss://relay.example.com'],
      kind: 37516,
    };

    const logText = 'Verified find with QR code!';
    const logType = 'found' as const;

    await result.current.shareLogAsEvent({
      geocache,
      logText,
      logType,
      isVerified: true,
    });

    expect(mockMutate).toHaveBeenCalledWith({
      kind: 1,
      content: `Just found a treasure (Verified ✨)! #treasures #geocache

🧭 Test Geocache
https://treasures.to/naddr1test

My experience:
"Verified find with QR code!"`,
      tags: [
        ['t', 'treasures'],
        ['r', 'https://treasures.to/naddr1test'],
        ['client', 'treasures'],
      ],
    });
  });

  it('should not publish for non-found log types', async () => {
    const mockMutate = vi.fn();
    mockUseNostrPublish.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    const { result } = renderHook(() => useShareLogAsEvent(), { wrapper });

    const geocache = {
      id: 'test-id',
      name: 'Test Geocache',
      dTag: 'test-dtag',
      pubkey: 'test-pubkey',
      relays: ['wss://relay.example.com'],
      kind: 37516,
    };

    const logText = 'Could not find it this time';
    const logType = 'dnf' as const;

    await result.current.shareLogAsEvent({
      geocache,
      logText,
      logType,
      isVerified: false,
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('should omit compass line when geocache name is empty', async () => {
    const mockMutate = vi.fn();
    mockUseNostrPublish.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    const { result } = renderHook(() => useShareLogAsEvent(), { wrapper });

    const geocache = {
      id: 'test-id',
      name: '',
      dTag: 'test-dtag',
      pubkey: 'test-pubkey',
      relays: ['wss://relay.example.com'],
      kind: 37516,
    };

    const logText = 'Found it!';
    const logType = 'found' as const;

    await result.current.shareLogAsEvent({
      geocache,
      logText,
      logType,
      isVerified: false,
    });

    expect(mockMutate).toHaveBeenCalledWith({
      kind: 1,
      content: `Just found a treasure! #treasures #geocache
https://treasures.to/naddr1test

My experience:
"Found it!"`,
      tags: [
        ['t', 'treasures'],
        ['r', 'https://treasures.to/naddr1test'],
        ['client', 'treasures'],
      ],
    });
  });

  it('should include geocache URL and user log text in content', async () => {
    const mockMutate = vi.fn();
    mockUseNostrPublish.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    const { result } = renderHook(() => useShareLogAsEvent(), { wrapper });

    const geocache = {
      id: 'test-id',
      name: 'Amazing Cache',
      dTag: 'test-dtag',
      pubkey: 'test-pubkey',
      relays: ['wss://relay.example.com'],
      kind: 37516,
    };

    const logText = 'This was incredible! The view was breathtaking.';
    const logType = 'found' as const;

    await result.current.shareLogAsEvent({
      geocache,
      logText,
      logType,
      isVerified: false,
    });

    expect(mockMutate).toHaveBeenCalledWith({
      kind: 1,
      content: `Just found a treasure! #treasures #geocache

🧭 Amazing Cache
https://treasures.to/naddr1test

My experience:
"This was incredible! The view was breathtaking."`,
      tags: [
        ['t', 'treasures'],
        ['r', 'https://treasures.to/naddr1test'],
        ['client', 'treasures'],
      ],
    });
  });

  it('should not publish for note log type', async () => {
    const mockMutate = vi.fn();
    mockUseNostrPublish.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    const { result } = renderHook(() => useShareLogAsEvent(), { wrapper });

    const geocache = {
      id: 'test-id',
      name: 'Test Geocache',
      dTag: 'test-dtag',
      pubkey: 'test-pubkey',
      relays: ['wss://relay.example.com'],
      kind: 37516,
    };

    const logText = 'Left a note for future finders';
    const logType = 'note' as const;

    await result.current.shareLogAsEvent({
      geocache,
      logText,
      logType,
      isVerified: false,
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('should not publish for maintenance log type', async () => {
    const mockMutate = vi.fn();
    mockUseNostrPublish.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    const { result } = renderHook(() => useShareLogAsEvent(), { wrapper });

    const geocache = {
      id: 'test-id',
      name: 'Test Geocache',
      dTag: 'test-dtag',
      pubkey: 'test-pubkey',
      relays: ['wss://relay.example.com'],
      kind: 37516,
    };

    const logText = 'Performed some maintenance on the cache';
    const logType = 'maintenance' as const;

    await result.current.shareLogAsEvent({
      geocache,
      logText,
      logType,
      isVerified: false,
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });
});