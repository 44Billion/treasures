import { describe, it, expect } from 'vitest';
import { cleanupDuplicateWarnings } from '../src/lib/osmVerification';

describe('Duplicate Warning Cleanup', () => {
  it('should remove exact duplicates', () => {
    const warnings = [
      'Location is near a School',
      'Location is near a School', // exact duplicate
      'Location is near a Park'
    ];
    
    const result = cleanupDuplicateWarnings(warnings);
    expect(result).toEqual([
      'Location is near a School',
      'Location is near a Park'
    ]);
  });

  it('should prefer human-friendly version over emoji version for private property', () => {
    const warnings = [
      'Location is inside a Private property',
      '⚠️ Location is INSIDE private property'
    ];
    
    const result = cleanupDuplicateWarnings(warnings);
    expect(result).toEqual(['Location is inside a Private property']);
  });

  it('should prefer inside over near for same facility type', () => {
    const warnings = [
      'Location is near a School',
      'Location is inside a School'
    ];
    
    const result = cleanupDuplicateWarnings(warnings);
    expect(result).toEqual(['Location is inside a School']);
  });

  it('should consolidate multiple private property warnings', () => {
    const warnings = [
      'Location is near private property',
      '⚠️ Location is INSIDE private property',
      'Location is inside a Private property'
    ];
    
    const result = cleanupDuplicateWarnings(warnings);
    expect(result).toEqual(['Location is inside a Private property']);
  });

  it('should handle buildings correctly', () => {
    const warnings = [
      'Location is near a building',
      '⚠️ Location appears to be inside a building (verify permissions)'
    ];
    
    const result = cleanupDuplicateWarnings(warnings);
    // The specific building warning should win due to additional context (parentheses)
    expect(result).toEqual(['⚠️ Location appears to be inside a building (verify permissions)']);
  });

  it('should keep different types of warnings', () => {
    const warnings = [
      'Location is near a School',
      'Location is near a Hospital',
      '⚠️ Location is INSIDE private property'
    ];
    
    const result = cleanupDuplicateWarnings(warnings);
    expect(result).toEqual([
      'Location is near a School',
      'Location is near a Hospital',
      '⚠️ Location is INSIDE private property'
    ]);
  });

  it('should handle empty array', () => {
    const warnings: string[] = [];
    const result = cleanupDuplicateWarnings(warnings);
    expect(result).toEqual([]);
  });

  it('should demonstrate the improved human-friendly preference', () => {
    // This test documents the improved behavior you requested
    const warnings = [
      '⚠️ Location is INSIDE private property',  // Technical/system warning
      'Location is inside a Private property'    // Human-friendly description
    ];
    
    const result = cleanupDuplicateWarnings(warnings);
    // Should prefer the human-friendly version
    expect(result).toEqual(['Location is inside a Private property']);
    expect(result[0]).not.toContain('⚠️');
    expect(result[0]).not.toContain('INSIDE');
    expect(result[0]).toContain('inside a');
  });

  it('should handle underwater warnings with highest priority', () => {
    const warnings = [
      'Location is near body of water',
      '⚠️ Location is UNDERWATER in river'
    ];
    
    const result = cleanupDuplicateWarnings(warnings);
    // UNDERWATER warning should take priority
    expect(result).toEqual(['⚠️ Location is UNDERWATER in river']);
  });

  it('should consolidate different water feature warnings', () => {
    const warnings = [
      'Location is near swimming pool',
      '⚠️ Location is UNDERWATER in body of water',
      'Location is near river'
    ];
    
    const result = cleanupDuplicateWarnings(warnings);
    // Should keep the most critical water warning
    expect(result).toEqual(['⚠️ Location is UNDERWATER in body of water']);
  });
});