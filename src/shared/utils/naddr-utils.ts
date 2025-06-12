import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';
import { nip19 } from 'nostr-tools';

/**
 * Convert geocache data to naddr format
 */
export function geocacheToNaddr(pubkey: string, dTag: string, relays: string[] = []): string {
  return nip19.naddrEncode({
    pubkey,
    kind: NIP_GC_KINDS.GEOCACHE, // Geocache kind
    identifier: dTag,
    relays,
  });
}

/**
 * Parse naddr to get geocache data
 */
export function naddrToGeocache(naddr: string) {
  try {
    const decoded = nip19.decode(naddr);
    if (decoded.type !== 'naddr') {
      throw new Error('Invalid naddr format');
    }
    return decoded.data;
  } catch (error) {
    throw new Error(`Failed to parse naddr: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}