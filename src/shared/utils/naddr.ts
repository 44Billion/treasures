import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';
import { nip19 } from 'nostr-tools';

/**
 * Convert geocache data to naddr (Nostr address)
 */
export function geocacheToNaddr(pubkey: string, dTag: string, relays?: string[], kind?: number): string {
  return nip19.naddrEncode({
    pubkey,
    kind: kind || NIP_GC_KINDS.GEOCACHE, // Use actual kind if provided, otherwise default to new kind
    identifier: dTag,
    relays: relays || []
  });
}

/**
 * Parse naddr to get geocache coordinates
 */
export function parseNaddr(naddr: string): { pubkey: string; dTag: string; relays?: string[]; kind?: number } | null {
  try {
    const decoded = nip19.decode(naddr);
    
    if (decoded.type !== 'naddr') {
      throw new Error('Not an naddr');
    }
    
    const data = decoded.data;
    
    // Accept NIP-GC standard (37516 and legacy 37515)
    if (data.kind !== NIP_GC_KINDS.GEOCACHE && data.kind !== NIP_GC_KINDS.GEOCACHE_LEGACY) {
      throw new Error('Not a geocache naddr');
    }
    
    return {
      pubkey: data.pubkey,
      dTag: data.identifier,
      relays: data.relays,
      kind: data.kind
    };
  } catch (error) {
    return null;
  }
}

/**
 * Check if a string is a valid naddr
 */
export function isValidNaddr(value: string): boolean {
  return parseNaddr(value) !== null;
}