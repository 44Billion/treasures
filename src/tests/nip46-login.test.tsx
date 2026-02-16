/**
 * NIP-46 Login Integration Tests
 * 
 * Tests the nostrconnect:// login flow including:
 * - Parameter generation
 * - URI formatting
 * - QR code display
 * - Connection handling
 */

import { describe, it, expect } from 'vitest';
import { generateNostrConnectParams, generateNostrConnectURI } from '@/hooks/useLoginActions';

describe('NIP-46 Login Support', () => {
  describe('generateNostrConnectParams', () => {
    it('should generate valid nostrconnect parameters', () => {
      const relays = ['wss://relay.damus.io'];
      const params = generateNostrConnectParams(relays);

      expect(params).toBeDefined();
      expect(params.clientSecretKey).toBeInstanceOf(Uint8Array);
      expect(params.clientSecretKey.length).toBe(32);
      expect(params.clientPubkey).toBeDefined();
      expect(params.clientPubkey.length).toBe(64); // hex pubkey
      expect(params.secret).toBeDefined();
      expect(params.secret.length).toBe(8);
      expect(params.secret).toMatch(/^[0-9a-f]{8}$/); // hex string
      expect(params.relays).toEqual(relays);
    });

    it('should generate unique parameters on each call', () => {
      const relays = ['wss://relay.damus.io'];
      const params1 = generateNostrConnectParams(relays);
      const params2 = generateNostrConnectParams(relays);

      expect(params1.clientPubkey).not.toBe(params2.clientPubkey);
      expect(params1.secret).not.toBe(params2.secret);
    });
  });

  describe('generateNostrConnectURI', () => {
    it('should generate valid nostrconnect URI', () => {
      const params = generateNostrConnectParams(['wss://relay.damus.io']);
      const uri = generateNostrConnectURI(params, 'Treasures.to');

      expect(uri).toMatch(/^nostrconnect:\/\//);
      expect(uri).toContain(params.clientPubkey);
      // URLs are encoded, so check for encoded version
      expect(uri).toContain('relay=wss%3A%2F%2Frelay.damus.io');
      expect(uri).toContain(`secret=${params.secret}`);
      expect(uri).toContain('name=Treasures.to');
    });

    it('should include multiple relays in URI', () => {
      const relays = ['wss://relay1.com', 'wss://relay2.com'];
      const params = generateNostrConnectParams(relays);
      const uri = generateNostrConnectURI(params);

      // URLs are encoded, so check for encoded version
      expect(uri).toContain('relay=wss%3A%2F%2Frelay1.com');
      expect(uri).toContain('relay=wss%3A%2F%2Frelay2.com');
    });

    it('should work without app name', () => {
      const params = generateNostrConnectParams(['wss://relay.damus.io']);
      const uri = generateNostrConnectURI(params);

      expect(uri).toMatch(/^nostrconnect:\/\//);
      expect(uri).not.toContain('name=');
    });

    it('should properly encode special characters in app name', () => {
      const params = generateNostrConnectParams(['wss://relay.damus.io']);
      const uri = generateNostrConnectURI(params, 'Test App & More');

      expect(uri).toContain('name=Test+App+%26+More');
    });
  });

  describe('URI format validation', () => {
    it('should create scannable QR code compatible URIs', () => {
      const params = generateNostrConnectParams(['wss://relay.damus.io']);
      const uri = generateNostrConnectURI(params, 'Treasures.to');

      // URI should be parseable
      const url = new URL(uri);
      expect(url.protocol).toBe('nostrconnect:');
      expect(url.hostname).toBe(params.clientPubkey);
      
      const searchParams = new URLSearchParams(url.search);
      expect(searchParams.get('secret')).toBe(params.secret);
      expect(searchParams.get('relay')).toBe('wss://relay.damus.io');
      expect(searchParams.get('name')).toBe('Treasures.to');
    });
  });
});
