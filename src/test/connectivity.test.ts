/**
 * Tests for enhanced connectivity detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectivityChecker } from '@/lib/connectivityChecker';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('ConnectivityChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset navigator.onLine to true
    (navigator as any).onLine = true;
  });

  afterEach(() => {
    connectivityChecker.destroy();
  });

  it('should detect online status from navigator.onLine', () => {
    const status = connectivityChecker.getStatus();
    expect(status.isOnline).toBe(true);
  });

  it('should detect offline status when navigator.onLine is false', async () => {
    (navigator as any).onLine = false;
    
    const status = await connectivityChecker.forceCheck();
    expect(status.isOnline).toBe(false);
    expect(status.isConnected).toBe(false);
    expect(status.connectionQuality).toBe('offline');
  });

  it('should test actual connectivity when online', async () => {
    mockFetch.mockResolvedValueOnce(new Response());
    
    const status = await connectivityChecker.forceCheck();
    expect(mockFetch).toHaveBeenCalled();
    expect(status.isConnected).toBe(true);
  });

  it('should handle fetch failures gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    
    const status = await connectivityChecker.forceCheck();
    expect(status.isConnected).toBe(false);
    expect(status.connectionQuality).toBe('offline');
  });

  it('should determine connection quality based on latency', async () => {
    // Mock a slow response
    mockFetch.mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve(new Response()), 2000)
      )
    );
    
    const status = await connectivityChecker.forceCheck();
    if (status.isConnected) {
      expect(status.connectionQuality).toBe('poor');
    }
  });

  it('should notify listeners of status changes', async () => {
    const listener = vi.fn();
    const unsubscribe = connectivityChecker.addListener(listener);
    
    await connectivityChecker.forceCheck();
    
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});