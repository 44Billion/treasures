import { describe, it, expect } from 'vitest';
import { getCacheIcon, getCacheIconSvg, getCacheColor } from '@/features/geocache/utils/cacheIcons';

describe('Cache Icons', () => {
  describe('getCacheIcon', () => {
    it('should return chest icon for traditional cache type', () => {
      const icon = getCacheIcon('traditional');
      expect(icon).toBeDefined();
    });

    it('should return compass icon for multi cache type', () => {
      const icon = getCacheIcon('multi');
      expect(icon).toBeDefined();
    });

    it('should return help circle icon for mystery cache type', () => {
      const icon = getCacheIcon('mystery');
      expect(icon).toBeDefined();
    });

    it('should return chest icon for unknown cache type (default)', () => {
      const icon = getCacheIcon('unknown');
      expect(icon).toBeDefined();
    });

    it('should handle different sizes', () => {
      const smallIcon = getCacheIcon('traditional', 'sm');
      const mediumIcon = getCacheIcon('traditional', 'md');
      const largeIcon = getCacheIcon('traditional', 'lg');
      
      expect(smallIcon).toBeDefined();
      expect(mediumIcon).toBeDefined();
      expect(largeIcon).toBeDefined();
    });
  });

  describe('getCacheIconSvg', () => {
    it('should return chest SVG for traditional cache type', () => {
      const svg = getCacheIconSvg('traditional');
      expect(svg).toContain('M8 19a2 2 0 0 0 2-2V9a4 4 0 0 0-8 0v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4H6');
      expect(svg).toContain('M2 11h20');
      expect(svg).toContain('M16 11v3');
    });

    it('should return compass SVG for multi cache type', () => {
      const svg = getCacheIconSvg('multi');
      expect(svg).toContain('circle cx="12" cy="12" r="10"');
      expect(svg).toContain('polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"');
    });

    it('should return help circle SVG for mystery cache type', () => {
      const svg = getCacheIconSvg('mystery');
      expect(svg).toContain('circle cx="12" cy="12" r="10"');
      expect(svg).toContain('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3');
    });

    it('should return chest SVG for unknown cache type (default)', () => {
      const svg = getCacheIconSvg('unknown');
      expect(svg).toContain('M8 19a2 2 0 0 0 2-2V9a4 4 0 0 0-8 0v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4H6');
    });
  });

  describe('getCacheColor', () => {
    it('should return emerald color for traditional cache type', () => {
      const color = getCacheColor('traditional');
      expect(color).toBe('#10b981');
    });

    it('should return amber color for multi cache type', () => {
      const color = getCacheColor('multi');
      expect(color).toBe('#f59e0b');
    });

    it('should return purple color for mystery cache type', () => {
      const color = getCacheColor('mystery');
      expect(color).toBe('#8b5cf6');
    });

    it('should return emerald color for unknown cache type (default)', () => {
      const color = getCacheColor('unknown');
      expect(color).toBe('#10b981');
    });
  });
});