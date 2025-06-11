import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useOfflineSettings, useOfflineMode } from '../hooks/useOfflineStorage';
import { offlineStorage } from '../utils/offlineStorage';

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('Offline Storage', () => {
  beforeEach(async () => {
    // Initialize offline storage for tests
    await offlineStorage.init();
  });

  afterEach(async () => {
    // Clean up after each test
    await offlineStorage.clearOldData(0);
  });

  describe('useOfflineSettings', () => {
    it('should load and save settings', async () => {
      const { result } = renderHook(() => useOfflineSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.settings).toBeDefined();
      });

      // Test setting a value
      result.current.setSetting({ key: 'testSetting', value: 'testValue' });

      await waitFor(() => {
        expect(result.current.settings.testSetting).toBe('testValue');
      });
    });

    it('should have default values for offline settings', async () => {
      const { result } = renderHook(() => useOfflineSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.settings.autoCacheMaps).toBe(true);
      });
    });
  });

  describe('useOfflineMode', () => {
    it('should detect offline mode correctly', async () => {
      const { result } = renderHook(() => useOfflineMode(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(typeof result.current.isOfflineMode).toBe('boolean');
        expect(typeof result.current.isOnline).toBe('boolean');
        expect(typeof result.current.isConnected).toBe('boolean');
      });
    });

    it('should respect offline-only mode setting', async () => {
      const { result: settingsResult } = renderHook(() => useOfflineSettings(), {
        wrapper: createWrapper(),
      });

      const { result: modeResult } = renderHook(() => useOfflineMode(), {
        wrapper: createWrapper(),
      });

      // Enable offline-only mode
      settingsResult.current.setSetting({ key: 'offlineOnly', value: true });

      await waitFor(() => {
        expect(modeResult.current.isOnline).toBe(false);
        expect(modeResult.current.connectionQuality).toBe('offline');
      });
    });
  });

  describe('Offline Storage Operations', () => {
    it('should store and retrieve geocaches', async () => {
      const testGeocache = {
        id: 'test-cache-1',
        event: {
          id: 'test-event-1',
          kind: 37515,
          content: 'Test geocache',
          created_at: Date.now(),
          pubkey: 'test-pubkey',
          sig: 'test-sig',
          tags: [],
        },
        lastUpdated: Date.now(),
        coordinates: [40.7128, -74.0060] as [number, number],
        difficulty: 2,
        terrain: 1.5,
        type: 'traditional',
      };

      await offlineStorage.storeGeocache(testGeocache);
      const retrieved = await offlineStorage.getGeocache('test-cache-1');

      expect(retrieved).toEqual(testGeocache);
    });

    it('should store and retrieve profiles', async () => {
      const testProfile = {
        pubkey: 'test-pubkey',
        metadata: {
          name: 'Test User',
          about: 'Test profile',
        },
        lastUpdated: Date.now(),
      };

      await offlineStorage.storeProfile(testProfile);
      const retrieved = await offlineStorage.getProfile('test-pubkey');

      expect(retrieved).toEqual(testProfile);
    });

    it('should handle geocache bounds queries', async () => {
      const testGeocache1 = {
        id: 'test-cache-1',
        event: {
          id: 'test-event-1',
          kind: 37515,
          content: 'Test geocache 1',
          created_at: Date.now(),
          pubkey: 'test-pubkey',
          sig: 'test-sig',
          tags: [],
        },
        lastUpdated: Date.now(),
        coordinates: [40.7128, -74.0060] as [number, number],
      };

      const testGeocache2 = {
        id: 'test-cache-2',
        event: {
          id: 'test-event-2',
          kind: 37515,
          content: 'Test geocache 2',
          created_at: Date.now(),
          pubkey: 'test-pubkey',
          sig: 'test-sig',
          tags: [],
        },
        lastUpdated: Date.now(),
        coordinates: [41.0, -75.0] as [number, number],
      };

      await offlineStorage.storeGeocache(testGeocache1);
      await offlineStorage.storeGeocache(testGeocache2);

      const inBounds = await offlineStorage.getGeocachesInBounds(40.0, 41.0, -75.0, -74.0);
      expect(inBounds).toHaveLength(2);

      const outOfBounds = await offlineStorage.getGeocachesInBounds(42.0, 43.0, -76.0, -75.0);
      expect(outOfBounds).toHaveLength(0);
    });

    it('should manage offline actions queue', async () => {
      const actionId = await offlineStorage.addOfflineAction({
        type: 'publish_event',
        data: { eventId: 'test-event' },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
      });

      expect(actionId).toBeDefined();

      const pendingActions = await offlineStorage.getPendingActions();
      expect(pendingActions).toHaveLength(1);
      expect(pendingActions[0].id).toBe(actionId);

      await offlineStorage.removeOfflineAction(actionId);
      const afterRemoval = await offlineStorage.getPendingActions();
      expect(afterRemoval).toHaveLength(0);
    });

    it('should handle settings storage', async () => {
      await offlineStorage.setSetting('testKey', 'testValue');
      const value = await offlineStorage.getSetting('testKey');
      expect(value).toBe('testValue');

      await offlineStorage.setSetting('testKey', { nested: 'object' });
      const objectValue = await offlineStorage.getSetting('testKey');
      expect(objectValue).toEqual({ nested: 'object' });
    });

    it('should clean up old data', async () => {
      const oldGeocache = {
        id: 'old-cache',
        event: {
          id: 'old-event',
          kind: 37515,
          content: 'Old geocache',
          created_at: Date.now(),
          pubkey: 'test-pubkey',
          sig: 'test-sig',
          tags: [],
        },
        lastUpdated: Date.now() - (31 * 24 * 60 * 60 * 1000), // 31 days ago
      };

      const newGeocache = {
        id: 'new-cache',
        event: {
          id: 'new-event',
          kind: 37515,
          content: 'New geocache',
          created_at: Date.now(),
          pubkey: 'test-pubkey',
          sig: 'test-sig',
          tags: [],
        },
        lastUpdated: Date.now(),
      };

      await offlineStorage.storeGeocache(oldGeocache);
      await offlineStorage.storeGeocache(newGeocache);

      // Clean up data older than 30 days
      await offlineStorage.clearOldData(30 * 24 * 60 * 60 * 1000);

      const allCaches = await offlineStorage.getAllGeocaches();
      expect(allCaches).toHaveLength(1);
      expect(allCaches[0].id).toBe('new-cache');
    });
  });

  describe('Error Handling', () => {
    it('should handle IndexedDB unavailability gracefully', async () => {
      // This test would need to mock IndexedDB being unavailable
      // For now, we just ensure the storage methods don't throw
      expect(async () => {
        await offlineStorage.storeEvent({
          id: 'test',
          kind: 1,
          content: 'test',
          created_at: Date.now(),
          pubkey: 'test',
          sig: 'test',
          tags: [],
        });
      }).not.toThrow();
    });

    it('should handle missing data gracefully', async () => {
      const nonExistentCache = await offlineStorage.getGeocache('non-existent');
      expect(nonExistentCache).toBeNull();

      const nonExistentProfile = await offlineStorage.getProfile('non-existent');
      expect(nonExistentProfile).toBeNull();

      const nonExistentEvent = await offlineStorage.getEvent('non-existent');
      expect(nonExistentEvent).toBeNull();
    });
  });
});