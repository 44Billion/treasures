import { describe, it, expect } from 'vitest';
import { parseLogEvent, NIP_GC_KINDS } from '@/lib/nip-gc';

describe('Verification Fix', () => {
  it('should not mark found logs as verified during parsing', () => {
    // Mock found log event with embedded kind 7517 verification event
    const mockFoundLogEvent = {
      id: "test-log-id",
      pubkey: "test-finder-pubkey",
      created_at: 1234567890,
      kind: NIP_GC_KINDS.FOUND_LOG, // 7516
      content: "Great find! TFTC",
      tags: [
        ["a", "37515:test-cache-owner-pubkey:test-cache-dtag"],
        ["verification", JSON.stringify({
          id: "test-verification-id",
          pubkey: "test-verification-pubkey",
          created_at: 1234567890,
          kind: NIP_GC_KINDS.VERIFICATION, // 7517
          content: "Geocache verification for npub123...",
          tags: [["a", "test-finder-pubkey:test-geocache-naddr"]],
          sig: "test-signature"
        })]
      ],
      sig: "test-log-signature"
    };

    const parsedLog = parseLogEvent(mockFoundLogEvent);
    
    // The log should be parsed successfully
    expect(parsedLog).toBeDefined();
    expect(parsedLog?.type).toBe('found');
    expect(parsedLog?.text).toBe('Great find! TFTC');
    
    // BUT it should NOT be marked as verified during parsing
    // Verification should happen later in useGeocacheLogs with proper signature validation
    expect(parsedLog?.isVerified).toBe(false);
  });

  it('should parse found logs without embedded verification as unverified', () => {
    const mockFoundLogEvent = {
      id: "test-log-id",
      pubkey: "test-finder-pubkey",
      created_at: 1234567890,
      kind: NIP_GC_KINDS.FOUND_LOG, // 7516
      content: "Great find! TFTC",
      tags: [
        ["a", "37515:test-cache-owner-pubkey:test-cache-dtag"]
      ],
      sig: "test-log-signature"
    };

    const parsedLog = parseLogEvent(mockFoundLogEvent);
    
    expect(parsedLog).toBeDefined();
    expect(parsedLog?.type).toBe('found');
    expect(parsedLog?.isVerified).toBe(false);
  });

  it('should parse found logs with invalid embedded verification as unverified', () => {
    const mockFoundLogEvent = {
      id: "test-log-id",
      pubkey: "test-finder-pubkey",
      created_at: 1234567890,
      kind: NIP_GC_KINDS.FOUND_LOG, // 7516
      content: "Great find! TFTC",
      tags: [
        ["a", "37515:test-cache-owner-pubkey:test-cache-dtag"],
        ["verification", "invalid-json"]
      ],
      sig: "test-log-signature"
    };

    const parsedLog = parseLogEvent(mockFoundLogEvent);
    
    expect(parsedLog).toBeDefined();
    expect(parsedLog?.type).toBe('found');
    expect(parsedLog?.isVerified).toBe(false);
  });
});