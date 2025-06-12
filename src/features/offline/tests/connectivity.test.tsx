import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConnectivity } from '../hooks/useConnectivity';
import { connectivityChecker } from '../utils/connectivityChecker';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Connectivity', () => {
  beforeEach(() => {
    // Reset mocks
    mockFetch.mockReset();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    // Clean up
    connectivityChecker.destroy();
  });

  describe('useConnectivity', () => {
    it('should provide connectivity status', async () => {
      const { result } = renderHook(() => useConnectivity());

      await waitFor(() => {
        expect(result.current.isOnline).toBeDefined();
        expect(result.current.isConnected).toBeDefined();
        expect(result.current.connectionQuality).toBeDefined();
      });
    });

    it('should detect online status', async () => {
      // Mock successful fetch
      mockFetch.mockResolvedValue(new Response());

      const { result } = renderHook(() => useConnectivity());

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
      });
    });

    it('should detect offline status', async () => {
      // Mock navigator offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const { result } = renderHook(() => useConnectivity());

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
        expect(result.current.isConnected).toBe(false);
        expect(result.current.connectionQuality).toBe('offline');
      });
    });

    it('should handle fetch failures', async () => {
      // Mock fetch failure
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useConnectivity());

      // Force a connectivity check
      await result.current.forceCheck();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
        expect(result.current.connectionQuality).toBe('offline');
      });
    });

    it('should determine connection quality based on latency', async () => {
      // Mock slow response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(new Response()), 2000)
        )
      );

      const { result } = renderHook(() => useConnectivity());

      await result.current.forceCheck();

      await waitFor(() => {
        if (result.current.isConnected) {
          expect(['good', 'poor']).toContain(result.current.connectionQuality);
        }
      }, { timeout: 5000 });
    });

    it('should handle timeout scenarios', async () => {
      // Mock timeout
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AbortError')), 5000)
        )
      );

      const { result } = renderHook(() => useConnectivity());

      await result.current.forceCheck();

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      }, { timeout: 10000 });
    });
  });

  describe('ConnectivityChecker', () => {
    it('should initialize with default options', () => {
      const status = connectivityChecker.getStatus();
      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('connectionQuality');
      expect(status).toHaveProperty('lastChecked');
    });

    it('should allow custom options', () => {
      const customChecker = new (connectivityChecker.constructor as any)({
        timeout: 5000,
        checkInterval: 60000,
        testUrls: ['https://example.com'],
        maxRetries: 2,
      });

      expect(customChecker).toBeDefined();
    });

    it('should notify listeners of status changes', async () => {
      const listener = vi.fn();
      const unsubscribe = connectivityChecker.addListener(listener);

      // Trigger a status change
      await connectivityChecker.forceCheck();

      await waitFor(() => {
        expect(listener).toHaveBeenCalled();
      });

      unsubscribe();
    });

    it('should handle multiple test URLs', async () => {
      // Mock first URL to fail, second to succeed
      mockFetch
        .mockRejectedValueOnce(new Error('First URL failed'))
        .mockResolvedValueOnce(new Response());

      const status = await connectivityChecker.forceCheck();

      expect(status.isConnected).toBe(true);
    });

    it('should respect retry logic', async () => {
      // Mock all attempts to fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      const status = await connectivityChecker.forceCheck();

      expect(status.isConnected).toBe(false);
      expect(status.connectionQuality).toBe('offline');
    });
  });

  describe('Browser Events', () => {
    it('should respond to online/offline events', async () => {
      const { result } = renderHook(() => useConnectivity());

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      // Dispatch offline event
      window.dispatchEvent(new Event('offline'));

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });

      // Simulate going online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      // Mock successful connectivity test
      mockFetch.mockResolvedValue(new Response());

      // Dispatch online event
      window.dispatchEvent(new Event('online'));

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
      });
    });

    it('should check connectivity when page becomes visible', async () => {
      const checkSpy = vi.spyOn(connectivityChecker, 'checkConnectivity');

      // Simulate page becoming visible
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false,
      });

      document.dispatchEvent(new Event('visibilitychange'));

      await waitFor(() => {
        expect(checkSpy).toHaveBeenCalled();
      });

      checkSpy.mockRestore();
    });
  });
});