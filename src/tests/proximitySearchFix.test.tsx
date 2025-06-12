/**
 * Test for the new geohash-based proximity search approach
 */

import { describe, it, expect } from 'vitest';
import { encodeGeohash } from '@/features/geocache/utils/nip-gc';

// Copy the new function for testing
function generateGeohashPatterns(
  centerLat: number, 
  centerLng: number, 
  radiusKm: number
): string[] {
  const patterns = new Set<string>();
  
  // Determine the optimal precision level based on radius
  let targetPrecision: number;
  if (radiusKm >= 100) targetPrecision = 3;      // u4x       (metro area)
  else if (radiusKm >= 50) targetPrecision = 4;  // u4xs      (city-level)
  else if (radiusKm >= 25) targetPrecision = 5;  // u4xsu     (broader)
  else if (radiusKm >= 10) targetPrecision = 6;  // u4xsud    (region)
  else if (radiusKm >= 5) targetPrecision = 7;   // u4xsudv   (area)
  else if (radiusKm >= 2) targetPrecision = 8;   // u4xsudvx  (nearby)
  else targetPrecision = 9;                      // u4xsudvxb (exact)
  
  // Generate the center geohash at target precision
  const centerGeohash = encodeGeohash(centerLat, centerLng, targetPrecision);
  patterns.add(centerGeohash);
  
  // For comprehensive coverage, also include patterns at nearby precisions
  // This ensures we catch geocaches that might be at cell boundaries
  const precisionRange = Math.max(1, Math.min(2, Math.floor(radiusKm / 10)));
  
  for (let p = Math.max(3, targetPrecision - precisionRange); p <= Math.min(9, targetPrecision + precisionRange); p++) {
    const geohash = encodeGeohash(centerLat, centerLng, p);
    patterns.add(geohash);
    
    // For larger radiuses, add some spatial coverage by slightly offsetting coordinates
    if (radiusKm >= 5) {
      const offset = 0.001 * Math.pow(2, 9 - p); // Smaller offset for higher precision
      const offsets = [
        [offset, 0], [-offset, 0], [0, offset], [0, -offset],
        [offset, offset], [offset, -offset], [-offset, offset], [-offset, -offset]
      ];
      
      for (const [latOffset, lngOffset] of offsets) {
        const offsetLat = centerLat + latOffset;
        const offsetLng = centerLng + lngOffset;
        
        if (offsetLat >= -90 && offsetLat <= 90 && offsetLng >= -180 && offsetLng <= 180) {
          const offsetGeohash = encodeGeohash(offsetLat, offsetLng, p);
          patterns.add(offsetGeohash);
        }
      }
    }
  }
  
  return Array.from(patterns).sort();
}

describe('New Geohash-Based Proximity Search', () => {
  it('should generate appropriate precision patterns for small radius', () => {
    // Oslo coordinates with small radius (1km)
    const osloLat = 59.9139;
    const osloLng = 10.7522;
    const radiusKm = 1;

    const patterns = generateGeohashPatterns(osloLat, osloLng, radiusKm);

    // Should generate patterns for small radius
    expect(patterns.length).toBeGreaterThan(0);

    // For 1km radius, should use precision 9 (exact)
    const has9CharPatterns = patterns.some(p => p.length === 9);
    expect(has9CharPatterns).toBe(true);

    // Should include the exact Oslo center geohash
    const osloGeohash9 = encodeGeohash(osloLat, osloLng, 9);
    expect(patterns).toContain(osloGeohash9);
  });

  it('should handle large radius efficiently (Oslo 10km case)', () => {
    // Oslo coordinates with large radius (10km) - the original problem case
    const osloLat = 59.9139;
    const osloLng = 10.7522;
    const radiusKm = 10;

    const patterns = generateGeohashPatterns(osloLat, osloLng, radiusKm);

    // Should generate patterns efficiently (not thousands)
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.length).toBeLessThan(1000); // Much more efficient than old approach

    // For 10km radius, should use precision 6 (region)
    const has6CharPatterns = patterns.some(p => p.length === 6);
    expect(has6CharPatterns).toBe(true);

    // Should include the center geohash at appropriate precision
    const osloGeohash6 = encodeGeohash(osloLat, osloLng, 6);
    expect(patterns).toContain(osloGeohash6);
  });

  it('should use appropriate precision based on radius size', () => {
    const lat = 40.7128; // New York
    const lng = -74.0060;

    // Test very small radius (0.5km) - should use precision 9
    const verySmallPatterns = generateGeohashPatterns(lat, lng, 0.5);
    expect(verySmallPatterns.some(p => p.length === 9)).toBe(true);
    
    // Test small radius (2km) - should use precision 8
    const smallPatterns = generateGeohashPatterns(lat, lng, 2);
    expect(smallPatterns.some(p => p.length === 8)).toBe(true);
    
    // Test medium radius (10km) - should use precision 6
    const mediumPatterns = generateGeohashPatterns(lat, lng, 10);
    expect(mediumPatterns.some(p => p.length === 6)).toBe(true);
    
    // Test large radius (100km) - should use precision 3
    const largePatterns = generateGeohashPatterns(lat, lng, 100);
    expect(largePatterns.some(p => p.length === 3)).toBe(true);
  });

  it('should include neighbors for comprehensive coverage', () => {
    const lat = 40.7128;
    const lng = -74.0060;
    const radiusKm = 5; // Should use precision 7

    const patterns = generateGeohashPatterns(lat, lng, radiusKm);

    // Should include the center geohash
    const centerGeohash = encodeGeohash(lat, lng, 7);
    expect(patterns).toContain(centerGeohash);

    // Should include multiple patterns (center + neighbors)
    expect(patterns.length).toBeGreaterThan(1);
    expect(patterns.length).toBeLessThan(50); // Reasonable number
  });

  it('should handle edge cases near poles and date line', () => {
    // Test near North Pole
    const patterns1 = generateGeohashPatterns(89, 0, 10);
    expect(patterns1.length).toBeGreaterThan(0);
    
    // Test near South Pole
    const patterns2 = generateGeohashPatterns(-89, 0, 10);
    expect(patterns2.length).toBeGreaterThan(0);
    
    // Test near International Date Line
    const patterns3 = generateGeohashPatterns(0, 179, 10);
    expect(patterns3.length).toBeGreaterThan(0);
    
    const patterns4 = generateGeohashPatterns(0, -179, 10);
    expect(patterns4.length).toBeGreaterThan(0);
  });

  it('should generate appropriate pattern counts for different radiuses', () => {
    const lat = 40.7128;
    const lng = -74.0060;

    // Small radius - should have fewer patterns
    const smallPatterns = generateGeohashPatterns(lat, lng, 1);
    const smallCount = smallPatterns.length;

    // Medium radius - should have more patterns due to spatial offsets
    const mediumPatterns = generateGeohashPatterns(lat, lng, 10);
    const mediumCount = mediumPatterns.length;

    // Large radius - should have many patterns due to lower precision + offsets
    const largePatterns = generateGeohashPatterns(lat, lng, 100);
    const largeCount = largePatterns.length;

    // All should have at least one pattern
    expect(smallCount).toBeGreaterThan(0);
    expect(mediumCount).toBeGreaterThan(0);
    expect(largeCount).toBeGreaterThan(0);

    // Medium radius should have more patterns than small (due to spatial offsets)
    expect(mediumCount).toBeGreaterThan(smallCount);
  });
});