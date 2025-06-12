import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyLocation } from '@/features/geocache/utils/osmVerification';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Underwater Detection Improvements', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should not flag location as underwater when on land with nearby water', async () => {
    // Mock response with land features and distant water
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          // Land features indicating we're on solid ground
          {
            type: 'way',
            id: 1,
            tags: {
              highway: 'footway',
              surface: 'paved'
            }
          },
          {
            type: 'node',
            id: 2,
            tags: {
              amenity: 'bench'
            }
          },
          // Water feature nearby but not containing the location
          {
            type: 'way',
            id: 3,
            tags: {
              natural: 'water',
              name: 'Test Lake'
            }
          }
        ]
      })
    });

    const result = await verifyLocation(40.7128, -74.0060);

    // Should not be flagged as underwater since we have clear land indicators
    expect(result.warnings).not.toContain(expect.stringContaining('UNDERWATER'));
    expect(result.warnings).not.toContain(expect.stringContaining('underwater'));
  });

  it('should not flag location as underwater when near small streams', async () => {
    // Mock response with small waterway
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          // Land features
          {
            type: 'way',
            id: 1,
            tags: {
              landuse: 'grass'
            }
          },
          // Small stream - should not trigger underwater warning
          {
            type: 'way',
            id: 2,
            tags: {
              waterway: 'stream',
              name: 'Small Creek'
            }
          }
        ]
      })
    });

    const result = await verifyLocation(40.7128, -74.0060);

    // Should not be flagged as underwater for small streams
    expect(result.warnings).not.toContain(expect.stringContaining('UNDERWATER'));
    expect(result.warnings).not.toContain(expect.stringContaining('underwater'));
  });

  it('should be conservative about underwater detection without clear geometry', async () => {
    // Mock response with only water features and no clear land indicators
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'way',
            id: 1,
            tags: {
              natural: 'water',
              name: 'Test Lake'
            }
          }
        ]
      })
    });

    const result = await verifyLocation(40.7128, -74.0060);

    // Should be conservative - not flag as underwater without proper geometry checks
    expect(result.warnings).not.toContain(expect.stringContaining('UNDERWATER'));
  });

  it('should be less noisy about nearby water when on clear land', async () => {
    // Mock response with significant water body nearby
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          // Clear land indicator
          {
            type: 'way',
            id: 1,
            tags: {
              highway: 'path'
            }
          },
          // Significant water body
          {
            type: 'way',
            id: 2,
            tags: {
              natural: 'water',
              name: 'Large Lake'
            }
          }
        ]
      })
    });

    const result = await verifyLocation(40.7128, -74.0060);

    // Should not flag as underwater and be less noisy about nearby water
    expect(result.warnings).not.toContain(expect.stringContaining('UNDERWATER'));
    // The improved logic should be less noisy about water warnings when clearly on land
    expect(result.warnings.length).toBeLessThanOrEqual(1);
  });

  it('should detect land features more comprehensively', async () => {
    // Mock response with various land indicators
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'way',
            id: 1,
            tags: {
              natural: 'wood'
            }
          },
          {
            type: 'node',
            id: 2,
            tags: {
              barrier: 'fence'
            }
          },
          {
            type: 'way',
            id: 3,
            tags: {
              power: 'line'
            }
          }
        ]
      })
    });

    const result = await verifyLocation(40.7128, -74.0060);

    // Should recognize these as land features and not flag any water warnings
    expect(result.warnings).not.toContain(expect.stringContaining('UNDERWATER'));
    expect(result.warnings).not.toContain(expect.stringContaining('water'));
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await verifyLocation(40.7128, -74.0060);

    expect(result.warnings).toContain('Unable to verify location restrictions. Please manually verify the location is appropriate.');
    expect(result.isRestricted).toBe(false);
  });

  it('should handle API timeout gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 504
    });

    const result = await verifyLocation(40.7128, -74.0060);

    expect(result.warnings).toContain('Unable to verify location restrictions. Please manually verify the location is appropriate.');
    expect(result.isRestricted).toBe(false);
  });
});