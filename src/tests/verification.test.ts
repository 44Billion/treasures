import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateVerificationKeyPair,
  createVerificationEvent,
  parseVerificationFromHash,
  verifyKeyPair,
  hasEmbeddedVerification,
  getEmbeddedVerification,
  verifyEmbeddedVerification,
  isCurrentVerificationKey,
  isOutdatedVerificationKey
} from '@/features/geocache/utils/verification';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';
import type { NostrEvent } from '@nostrify/nostrify';

// Mock nostr-tools
vi.mock('nostr-tools', () => ({
  nip19: {
    decode: vi.fn(),
    nsecEncode: vi.fn(),
    npubEncode: vi.fn()
  }
}));

// Mock @nostrify/nostrify
vi.mock('@nostrify/nostrify', () => ({
  NSecSigner: vi.fn().mockImplementation(() => ({
    getPublicKey: vi.fn().mockResolvedValue('test-pubkey'),
    signEvent: vi.fn().mockResolvedValue({
      id: 'verification-event-id',
      pubkey: 'verification-pubkey',
      created_at: 1234567890,
      kind: 7517,
      tags: [['a', 'finder-pubkey:naddr1test']],
      content: 'Geocache verification for npub1test',
      sig: 'verification-sig'
    })
  }))
}));

// Mock naddr utils
vi.mock('@/shared/utils/naddr-utils', () => ({
  geocacheToNaddr: vi.fn().mockReturnValue('naddr1test'),
  parseNaddr: vi.fn().mockReturnValue({
    kind: 37515,
    pubkey: 'test-pubkey',
    identifier: 'test-dtag'
  })
}));

describe('Verification Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateVerificationKeyPair', () => {
    it('should generate a valid key pair', async () => {
      const { nip19 } = await import('nostr-tools');
      (nip19.nsecEncode as any).mockReturnValue('nsec1test');
      (nip19.npubEncode as any).mockReturnValue('npub1test');

      const keyPair = await generateVerificationKeyPair();

      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('nsec', 'nsec1test');
      expect(keyPair).toHaveProperty('npub', 'npub1test');
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.privateKey.length).toBe(32);
    });
  });

  describe('createVerificationEvent', () => {
    it('should create a valid verification event', async () => {
      const { nip19 } = await import('nostr-tools');
      (nip19.decode as any).mockReturnValue({
        type: 'nsec',
        data: new Uint8Array(32)
      });
      (nip19.npubEncode as any).mockReturnValue('npub1finder');

      const event = await createVerificationEvent(
        'nsec1test',
        'finder-pubkey',
        'geocache-pubkey',
        'geocache-dtag'
      );

      expect(event).toHaveProperty('id', 'verification-event-id');
      expect(event).toHaveProperty('kind', NIP_GC_KINDS.VERIFICATION);
      expect(event).toHaveProperty('content', 'Geocache verification for npub1finder');
      expect(event.tags).toContainEqual(['a', 'finder-pubkey:naddr1test']);
    });

    it('should handle invalid nsec format', async () => {
      const { nip19 } = await import('nostr-tools');
      (nip19.decode as any).mockReturnValue({
        type: 'npub',
        data: 'invalid'
      });

      await expect(createVerificationEvent(
        'invalid-nsec',
        'finder-pubkey',
        'geocache-pubkey',
        'geocache-dtag'
      )).rejects.toThrow('Invalid verification key format - must be nsec');
    });

    it('should handle missing parameters', async () => {
      await expect(createVerificationEvent(
        '',
        'finder-pubkey',
        'geocache-pubkey',
        'geocache-dtag'
      )).rejects.toThrow('Missing required parameters for verification event');
    });

    it('should handle decode errors', async () => {
      const { nip19 } = await import('nostr-tools');
      (nip19.decode as any).mockImplementation(() => {
        throw new Error('Invalid format');
      });

      await expect(createVerificationEvent(
        'invalid-nsec',
        'finder-pubkey',
        'geocache-pubkey',
        'geocache-dtag'
      )).rejects.toThrow('Could not decode verification key. Please check the QR code.');
    });
  });

  describe('parseVerificationFromHash', () => {
    it('should parse valid verification hash', () => {
      const { nip19 } = require('nostr-tools');
      (nip19.decode as any).mockReturnValue({
        type: 'nsec',
        data: new Uint8Array(32)
      });

      const result = parseVerificationFromHash('#verify=nsec1test');
      expect(result).toBe('nsec1test');
    });

    it('should return null for invalid hash prefix', () => {
      const result = parseVerificationFromHash('#invalid=nsec1test');
      expect(result).toBeNull();
    });

    it('should return null for invalid nsec', () => {
      const { nip19 } = require('nostr-tools');
      (nip19.decode as any).mockReturnValue({
        type: 'npub',
        data: 'invalid'
      });

      const result = parseVerificationFromHash('#verify=npub1test');
      expect(result).toBeNull();
    });

    it('should handle decode errors', () => {
      const { nip19 } = require('nostr-tools');
      (nip19.decode as any).mockImplementation(() => {
        throw new Error('Invalid format');
      });

      const result = parseVerificationFromHash('#verify=invalid');
      expect(result).toBeNull();
    });
  });

  describe('verifyKeyPair', () => {
    it('should verify matching key pair', async () => {
      const { nip19 } = await import('nostr-tools');
      (nip19.decode as any).mockReturnValue({
        type: 'nsec',
        data: new Uint8Array(32)
      });

      const result = await verifyKeyPair('nsec1test', 'test-pubkey');
      expect(result).toBe(true);
    });

    it('should reject non-matching key pair', async () => {
      const { nip19 } = await import('nostr-tools');
      (nip19.decode as any).mockReturnValue({
        type: 'nsec',
        data: new Uint8Array(32)
      });

      const result = await verifyKeyPair('nsec1test', 'different-pubkey');
      expect(result).toBe(false);
    });

    it('should handle invalid nsec', async () => {
      const { nip19 } = await import('nostr-tools');
      (nip19.decode as any).mockReturnValue({
        type: 'npub',
        data: 'invalid'
      });

      const result = await verifyKeyPair('npub1test', 'test-pubkey');
      expect(result).toBe(false);
    });

    it('should handle decode errors', async () => {
      const { nip19 } = await import('nostr-tools');
      (nip19.decode as any).mockImplementation(() => {
        throw new Error('Invalid format');
      });

      const result = await verifyKeyPair('invalid', 'test-pubkey');
      expect(result).toBe(false);
    });
  });

  describe('hasEmbeddedVerification', () => {
    it('should detect embedded verification', () => {
      const event: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [
          ['verification', JSON.stringify({
            id: 'verification-id',
            kind: 7517,
            pubkey: 'verification-pubkey',
            created_at: 1234567890,
            tags: [],
            content: 'verification content',
            sig: 'verification-sig'
          })]
        ],
        content: 'test content',
        sig: 'test-sig'
      };

      const result = hasEmbeddedVerification(event);
      expect(result).toBe(true);
    });

    it('should return false for no verification', () => {
      const event: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [],
        content: 'test content',
        sig: 'test-sig'
      };

      const result = hasEmbeddedVerification(event);
      expect(result).toBe(false);
    });

    it('should handle invalid verification data', () => {
      const event: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [
          ['verification', 'invalid-json']
        ],
        content: 'test content',
        sig: 'test-sig'
      };

      const result = hasEmbeddedVerification(event);
      expect(result).toBe(false);
    });
  });

  describe('getEmbeddedVerification', () => {
    it('should extract embedded verification event', () => {
      const verificationEvent = {
        id: 'verification-id',
        kind: 7517,
        pubkey: 'verification-pubkey',
        created_at: 1234567890,
        tags: [],
        content: 'verification content',
        sig: 'verification-sig'
      };

      const event: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [
          ['verification', JSON.stringify(verificationEvent)]
        ],
        content: 'test content',
        sig: 'test-sig'
      };

      const result = getEmbeddedVerification(event);
      expect(result).toEqual(verificationEvent);
    });

    it('should return null for no verification tag', () => {
      const event: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [],
        content: 'test content',
        sig: 'test-sig'
      };

      const result = getEmbeddedVerification(event);
      expect(result).toBeNull();
    });

    it('should handle invalid JSON', () => {
      const event: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [
          ['verification', 'invalid-json']
        ],
        content: 'test content',
        sig: 'test-sig'
      };

      const result = getEmbeddedVerification(event);
      expect(result).toBeNull();
    });
  });

  describe('verifyEmbeddedVerification', () => {
    it('should verify valid embedded verification', async () => {
      const verificationEvent = {
        id: 'verification-id',
        kind: 7517,
        pubkey: 'verification-pubkey',
        created_at: 1234567890,
        tags: [['a', 'test-pubkey:naddr1test']],
        content: 'Geocache verification for npub1test',
        sig: 'verification-sig'
      };

      const logEvent: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [
          ['verification', JSON.stringify(verificationEvent)]
        ],
        content: 'test content',
        sig: 'test-sig'
      };

      const { nip19 } = await import('nostr-tools');
      (nip19.npubEncode as any).mockReturnValue('npub1test');

      const result = await verifyEmbeddedVerification(logEvent, 'verification-pubkey');
      expect(result).toBe(true);
    });

    it('should reject verification with wrong pubkey', async () => {
      const verificationEvent = {
        id: 'verification-id',
        kind: 7517,
        pubkey: 'wrong-pubkey',
        created_at: 1234567890,
        tags: [['a', 'test-pubkey:naddr1test']],
        content: 'Geocache verification for npub1test',
        sig: 'verification-sig'
      };

      const logEvent: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [
          ['verification', JSON.stringify(verificationEvent)]
        ],
        content: 'test content',
        sig: 'test-sig'
      };

      const result = await verifyEmbeddedVerification(logEvent, 'verification-pubkey');
      expect(result).toBe(false);
    });

    it('should return false for no embedded verification', async () => {
      const logEvent: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [],
        content: 'test content',
        sig: 'test-sig'
      };

      const result = await verifyEmbeddedVerification(logEvent, 'verification-pubkey');
      expect(result).toBe(false);
    });

    it('should cache verification results', async () => {
      const verificationEvent = {
        id: 'verification-id',
        kind: 7517,
        pubkey: 'verification-pubkey',
        created_at: 1234567890,
        tags: [['a', 'test-pubkey:naddr1test']],
        content: 'Geocache verification for npub1test',
        sig: 'verification-sig'
      };

      const logEvent: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 7516,
        tags: [
          ['verification', JSON.stringify(verificationEvent)]
        ],
        content: 'test content',
        sig: 'test-sig'
      };

      const { nip19 } = await import('nostr-tools');
      (nip19.npubEncode as any).mockReturnValue('npub1test');

      // First call
      const result1 = await verifyEmbeddedVerification(logEvent, 'verification-pubkey');
      expect(result1).toBe(true);

      // Second call should use cache
      const result2 = await verifyEmbeddedVerification(logEvent, 'verification-pubkey');
      expect(result2).toBe(true);

      // Should only call npubEncode once due to caching
      expect(nip19.npubEncode).toHaveBeenCalledTimes(1);
    });
  });

  describe('isCurrentVerificationKey', () => {
    it('should return true for matching keys', () => {
      const result = isCurrentVerificationKey('test-key', 'test-key');
      expect(result).toBe(true);
    });

    it('should return false for different keys', () => {
      const result = isCurrentVerificationKey('test-key', 'different-key');
      expect(result).toBe(false);
    });
  });

  describe('isOutdatedVerificationKey', () => {
    it('should return true for outdated keys', () => {
      const result = isOutdatedVerificationKey('old-key', 'new-key');
      expect(result).toBe(true);
    });

    it('should return false for current keys', () => {
      const result = isOutdatedVerificationKey('current-key', 'current-key');
      expect(result).toBe(false);
    });
  });
});