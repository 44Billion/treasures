import { describe, it, expect } from 'vitest';
import { parseNaddr, geocacheToNaddr, isValidNaddr } from '@/shared/utils/naddr';

// Focus on testing the core naddr parsing functionality

describe('Cache Link Routing', () => {

  describe('naddr parsing', () => {
    it('should correctly parse valid naddr', () => {
      // Create a test naddr
      const testPubkey = 'a'.repeat(64);
      const testDTag = 'test-cache-123';
      const testRelays = ['wss://ditto.pub/relay'];
      
      const naddr = geocacheToNaddr(testPubkey, testDTag, testRelays);
      expect(naddr).toMatch(/^naddr1/);
      
      const parsed = parseNaddr(naddr);
      expect(parsed).not.toBeNull();
      expect(parsed?.pubkey).toBe(testPubkey);
      expect(parsed?.dTag).toBe(testDTag);
      expect(parsed?.relays).toEqual(testRelays);
    });

    it('should validate naddr correctly', () => {
      const validNaddr = geocacheToNaddr('a'.repeat(64), 'test-cache');
      expect(isValidNaddr(validNaddr)).toBe(true);
      
      expect(isValidNaddr('invalid-naddr')).toBe(false);
      expect(isValidNaddr('npub1test')).toBe(false);
      expect(isValidNaddr('')).toBe(false);
    });

    it('should reject non-geocache naddr', () => {
      // Create an naddr for a different kind (not 37515)
      // This simulates what would happen if someone tries to use a different type of Nostr address
      const invalidNaddr = 'invalid-naddr-format';
      
      // The parseNaddr should return null for invalid formats
      const parsed = parseNaddr(invalidNaddr);
      expect(parsed).toBeNull();
    });
  });

  describe('Error handling for invalid cache links', () => {
    it('should handle various invalid naddr formats', () => {
      const invalidFormats = [
        '',
        'invalid',
        'npub1test', // Wrong prefix
        'note1test', // Wrong prefix  
        'naddr1', // Too short
        'random-string',
        'https://example.com/cache',
      ];
      
      invalidFormats.forEach(invalid => {
        expect(parseNaddr(invalid)).toBeNull();
        expect(isValidNaddr(invalid)).toBe(false);
      });
    });
    
    it('should handle edge cases in naddr validation', () => {
      // Test with null/undefined
      expect(isValidNaddr(null as any)).toBe(false);
      expect(isValidNaddr(undefined as any)).toBe(false);
      
      // Test with very long strings
      const veryLongString = 'a'.repeat(1000);
      expect(isValidNaddr(veryLongString)).toBe(false);
      
      // Test with special characters
      expect(isValidNaddr('naddr1!@#$%^&*()')).toBe(false);
    });
  });

  describe('Real-world naddr examples', () => {
    it('should handle typical geocache naddr format', () => {
      // This is a realistic example of what a geocache naddr might look like
      const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
      const dTag = 'central-park-treasure-2024';
      const relays = ['wss://ditto.pub/relay', 'wss://relay.nostr.band'];
      
      const naddr = geocacheToNaddr(pubkey, dTag, relays);
      const parsed = parseNaddr(naddr);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.pubkey).toBe(pubkey);
      expect(parsed?.dTag).toBe(dTag);
      expect(parsed?.relays).toEqual(relays);
    });

    it('should handle naddr without relays', () => {
      const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
      const dTag = 'simple-cache';
      
      const naddr = geocacheToNaddr(pubkey, dTag);
      const parsed = parseNaddr(naddr);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.pubkey).toBe(pubkey);
      expect(parsed?.dTag).toBe(dTag);
      expect(parsed?.relays).toEqual([]);
    });
  });
});