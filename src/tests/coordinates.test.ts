import { describe, it, expect } from 'vitest';
import { parseCoordinate, autocorrectCoordinates } from '@/lib/coordinates';

describe('parseCoordinate', () => {
  it('should parse integer coordinates', () => {
    expect(parseCoordinate('40')).toBe(40);
    expect(parseCoordinate('-74')).toBe(-74);
    expect(parseCoordinate('0')).toBe(0);
  });

  it('should parse decimal coordinates', () => {
    expect(parseCoordinate('40.7128')).toBe(40.7128);
    expect(parseCoordinate('-74.0060')).toBe(-74.0060);
    expect(parseCoordinate('0.0')).toBe(0.0);
  });

  it('should handle coordinates with leading/trailing whitespace', () => {
    expect(parseCoordinate(' 40.7128 ')).toBe(40.7128);
    expect(parseCoordinate('\t-74.0060\n')).toBe(-74.0060);
  });

  it('should handle scientific notation', () => {
    expect(parseCoordinate('1e2')).toBe(100);
    expect(parseCoordinate('1.5e1')).toBe(15);
  });

  it('should handle edge cases with multiple decimal points', () => {
    // parseFloat stops at the first invalid character, so '40.7.128' becomes 40.7
    expect(parseCoordinate('40.7.128')).toBe(40.7);
    expect(parseCoordinate('40..7')).toBe(40);
  });

  it('should return NaN for invalid input', () => {
    expect(parseCoordinate('')).toBeNaN();
    expect(parseCoordinate('abc')).toBeNaN();
    expect(parseCoordinate('not-a-number')).toBeNaN();
    expect(parseCoordinate('Infinity')).toBeNaN();
    expect(parseCoordinate('NaN')).toBeNaN();
  });

  it('should return NaN for null/undefined input', () => {
    expect(parseCoordinate(null as any)).toBeNaN();
    expect(parseCoordinate(undefined as any)).toBeNaN();
  });
});

describe('autocorrectCoordinates with parseCoordinate integration', () => {
  it('should work with integer coordinates', () => {
    const { lat, lng, corrected } = autocorrectCoordinates(40, -74);
    expect(lat).toBe(40);
    expect(lng).toBe(-74);
    expect(corrected).toBe(false);
  });

  it('should work with decimal coordinates', () => {
    const { lat, lng, corrected } = autocorrectCoordinates(40.7128, -74.0060);
    expect(lat).toBe(40.7128);
    expect(lng).toBe(-74.0060);
    expect(corrected).toBe(false);
  });

  it('should correct swapped coordinates', () => {
    // Latitude > 90 but longitude within valid latitude range
    // Use coordinates outside North America to avoid the North America correction
    const { lat, lng, corrected } = autocorrectCoordinates(120, 10);
    expect(lat).toBe(10);
    expect(lng).toBe(120);
    expect(corrected).toBe(true);
  });

  it('should correct positive longitude in North America', () => {
    // North American coordinates with positive longitude (should be negative)
    const { lat, lng, corrected } = autocorrectCoordinates(40, 74);
    expect(lat).toBe(40);
    expect(lng).toBe(-74);
    expect(corrected).toBe(true);
  });
});