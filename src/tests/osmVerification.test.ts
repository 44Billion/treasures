import { describe, it, expect } from 'vitest';
import { getVerificationSummary, type LocationVerification } from '../src/lib/osmVerification';

describe('osmVerification', () => {
  describe('getVerificationSummary', () => {
    it('should return safe status for locations with no warnings', () => {
      const verification: LocationVerification = {
        isRestricted: false,
        warnings: [],
        nearbyFeatures: [],
        accessibility: {},
        terrain: { hazards: [] },
        legal: { restrictions: [], permits: [] },
        environmental: {},
        safety: {},
      };

      const summary = getVerificationSummary(verification);
      expect(summary.status).toBe('safe');
    });

    it('should return warning status for locations near restricted areas', () => {
      const verification: LocationVerification = {
        isRestricted: true,
        warnings: ['Location is near a School'],
        nearbyFeatures: [],
        accessibility: {},
        terrain: { hazards: [] },
        legal: { restrictions: [], permits: [] },
        environmental: {},
        safety: {},
      };

      const summary = getVerificationSummary(verification);
      expect(summary.status).toBe('warning');
      expect(summary.message).toContain('some restrictions or considerations');
    });

    it('should return restricted status for locations inside restricted areas', () => {
      const verification: LocationVerification = {
        isRestricted: true,
        warnings: ['⚠️ Location is INSIDE private property'],
        nearbyFeatures: [],
        accessibility: {},
        terrain: { hazards: [] },
        legal: { restrictions: [], permits: [] },
        environmental: {},
        safety: {},
      };

      const summary = getVerificationSummary(verification);
      expect(summary.status).toBe('restricted');
      expect(summary.message).toContain('appears to be inside a restricted area');
      expect(summary.message).toContain('verify you have permission');
    });

    it('should return restricted status for locations inside buildings', () => {
      const verification: LocationVerification = {
        isRestricted: true,
        warnings: ['⚠️ Location appears to be inside a building (verify permissions)'],
        nearbyFeatures: [],
        accessibility: {},
        terrain: { hazards: [] },
        legal: { restrictions: [], permits: [] },
        environmental: {},
        safety: {},
      };

      const summary = getVerificationSummary(verification);
      expect(summary.status).toBe('restricted');
    });

    it('should return restricted status for locations inside sensitive facilities', () => {
      const verification: LocationVerification = {
        isRestricted: true,
        warnings: ['Location is inside a Military area'],
        nearbyFeatures: [],
        accessibility: {},
        terrain: { hazards: [] },
        legal: { restrictions: [], permits: [] },
        environmental: {},
        safety: {},
      };

      const summary = getVerificationSummary(verification);
      expect(summary.status).toBe('restricted');
    });

    it('should provide advisory language rather than blocking language', () => {
      const verification: LocationVerification = {
        isRestricted: true,
        warnings: ['⚠️ Location is INSIDE private property'],
        nearbyFeatures: [],
        accessibility: {},
        terrain: { hazards: [] },
        legal: { restrictions: [], permits: [] },
        environmental: {},
        safety: {},
      };

      const summary = getVerificationSummary(verification);
      expect(summary.message).not.toContain('Please choose a different location');
      expect(summary.message).toContain('verify you have permission');
      expect(summary.message).toContain('appropriate for geocaching');
    });

    it('should return restricted status for underwater locations', () => {
      const verification: LocationVerification = {
        isRestricted: true,
        warnings: ['⚠️ Location is UNDERWATER in body of water'],
        nearbyFeatures: [],
        accessibility: {},
        terrain: { hazards: [] },
        legal: { restrictions: [], permits: [] },
        environmental: {},
        safety: {},
      };

      const summary = getVerificationSummary(verification);
      expect(summary.status).toBe('restricted');
      expect(summary.message).toContain('underwater');
      expect(summary.message).not.toContain('cannot be placed in water bodies');
    });
  });
});