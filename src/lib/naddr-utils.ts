import { nip19 } from 'nostr-tools';

/**
 * Convert geocache data to naddr (Nostr address)
 */
export function geocacheToNaddr(pubkey: string, dTag: string, relays?: string[]): string {
  return nip19.naddrEncode({
    pubkey,
    kind: 37515, // Geocache kind
    identifier: dTag,
    relays: relays || []
  });
}

/**
 * Parse naddr to get geocache coordinates
 */
export function parseNaddr(naddr: string): { pubkey: string; dTag: string; relays?: string[] } | null {
  try {
    const decoded = nip19.decode(naddr);
    
    if (decoded.type !== 'naddr') {
      throw new Error('Not an naddr');
    }
    
    const data = decoded.data;
    
    // Verify it's a geocache kind
    if (data.kind !== 37515) {
      throw new Error('Not a geocache naddr');
    }
    
    return {
      pubkey: data.pubkey,
      dTag: data.identifier,
      relays: data.relays
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