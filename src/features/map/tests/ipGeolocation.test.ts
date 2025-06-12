import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getIPLocation } from '../utils/ipGeolocation';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('getIPLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return location from first successful service', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        loc: '40.7128,-74.0060'
      }),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await getIPLocation();

    expect(result).toEqual({
      lat: 40.7128,
      lng: -74.0060,
      accuracy: 25000,
      source: 'ipinfo.io'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ipinfo.io/json',
      expect.objectContaining({
        mode: 'cors',
        headers: expect.objectContaining({
          'Accept': 'application/json',
        }),
      })
    );
  });

  it('should try next service if first fails', async () => {
    // First service fails
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    // Second service succeeds
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        latitude: '40.7128',
        longitude: '-74.0060'
      }),
    };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await getIPLocation();

    expect(result).toEqual({
      lat: 40.7128,
      lng: -74.0060,
      accuracy: 25000,
      source: 'ipapi.co'
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle invalid coordinates', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        loc: 'invalid,coordinates'
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await getIPLocation();

    expect(result).toBeNull();
  });

  it('should reject null island coordinates', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        loc: '0,0'
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await getIPLocation();

    expect(result).toBeNull();
  });

  it('should handle HTTP errors', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await getIPLocation();

    expect(result).toBeNull();
  });

  it('should handle timeout', async () => {
    // Mock a request that rejects with AbortError immediately
    mockFetch.mockRejectedValue(Object.assign(new Error('AbortError'), { name: 'AbortError' }));

    const result = await getIPLocation();

    expect(result).toBeNull();
  });

  it('should validate coordinate ranges', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        latitude: '91', // Invalid latitude (> 90)
        longitude: '-74.0060'
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await getIPLocation();

    expect(result).toBeNull();
  });

  it('should parse different service response formats', async () => {
    // Test ipwhois.app format
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        latitude: '40.7128',
        longitude: '-74.0060'
      }),
    };

    mockFetch
      .mockRejectedValueOnce(new Error('First service failed'))
      .mockRejectedValueOnce(new Error('Second service failed'))
      .mockResolvedValueOnce(mockResponse);

    const result = await getIPLocation();

    expect(result).toEqual({
      lat: 40.7128,
      lng: -74.0060,
      accuracy: 30000,
      source: 'ipwhois.app'
    });
  });
});