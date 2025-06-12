import { describe, it, expect } from 'vitest';
import { formatCoordinateForInput } from '@/features/map/utils/coordinates';

describe('formatCoordinateForInput', () => {
  it('should limit precision to 5 decimal places for automatic sources', () => {
    // Test map click coordinates (usually have many decimal places)
    expect(formatCoordinateForInput(40.712812345678, true)).toBe('40.71281');
    expect(formatCoordinateForInput(-74.006012345678, true)).toBe('-74.00601');
    
    // Test GPS coordinates (usually have many decimal places)
    expect(formatCoordinateForInput(40.712812, true)).toBe('40.71281');
    expect(formatCoordinateForInput(-74.006, true)).toBe('-74.00600');
  });

  it('should preserve full precision for manual entry', () => {
    // Manual entry should preserve whatever the user typed
    expect(formatCoordinateForInput(40.712812345678, false)).toBe('40.712812345678');
    expect(formatCoordinateForInput(-74.006012345678, false)).toBe('-74.006012345678');
    expect(formatCoordinateForInput(40.7, false)).toBe('40.7');
    expect(formatCoordinateForInput(-74, false)).toBe('-74');
  });

  it('should handle edge cases', () => {
    // Test zero
    expect(formatCoordinateForInput(0, true)).toBe('0.00000');
    expect(formatCoordinateForInput(0, false)).toBe('0');
    
    // Test negative numbers
    expect(formatCoordinateForInput(-0.123456789, true)).toBe('-0.12346');
    expect(formatCoordinateForInput(-0.123456789, false)).toBe('-0.123456789');
    
    // Test large numbers
    expect(formatCoordinateForInput(180.123456789, true)).toBe('180.12346');
    expect(formatCoordinateForInput(-180.123456789, true)).toBe('-180.12346');
  });
});