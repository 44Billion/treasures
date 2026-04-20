import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import { TIMEOUTS } from '@/config';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/utils/nip-gc';
import type { Geocache } from '@/types/geocache';

/**
 * Hand-curated naddr identifiers for the homepage showcase.
 * These are editorially selected treasures from around the world.
 */
const CURATED_NADDRS = [
  'naddr1qvzqqqyj3spzpyexz3t34l966ngh5xg7u2q788hthdqmj0av3lv8s2tz9t43zt6dqyt8wumn8ghj7un9d3shjtnswf5k6ctv9ehx2aqqy9ekzen994kkzem9de6xztt8wfshxumgdac8qetj95unxv3kxy6r2dcyc5sxz',
  'naddr1qvzqqqyj3vpzpyexz3t34l966ngh5xg7u2q788hthdqmj0av3lv8s2tz9t43zt6dqyt8wumn8ghj7un9d3shjtnswf5k6ctv9ehx2aqqr4mxzuned9hxwttzv45kwefdvd6kx6m0duknjvejxccngdfhjtmdv6',
  'naddr1qvzqqqyj3spzpyexz3t34l966ngh5xg7u2q788hthdqmj0av3lv8s2tz9t43zt6dqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsqfnswfhkwun9wdekjan994shqunfvdhhgttrdpsk6etvv4hkutfexvervvf5x5ms5pltzh',
  'naddr1qvzqqqyj3spzqgynh25xy8zmy40g7n7zcm7lcyxc54vc5f23wejwl2agvpe47ypsqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsqp35xumryve3v8qhcg',
  'naddr1qvzqqqyj3spzqprpljlvcnpnw3pejvkkhrc3y6wvmd7vjuad0fg2ud3dky66gaxaqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsqxmxv9hxx7fddaexzmn8v5kkxmmjv9kz6vp5xcckvcmzv5xp5x46',
  'naddr1qvzqqqyj3spzpn5hxe78t47er7umcw7xladm80d49svfgxluuteksctde0c2mlf0qy28wumn8ghj7un9d3shjtnyv9kh2uewd9hsq8t8wfskgatpdskkx7tpdckkcmmzwd6x2u3dvdjnjdenxcmkxfcpj0e',
] as const;

interface DecodedNaddr {
  pubkey: string;
  identifier: string;
  kind: number;
  naddr: string;
}

/** Pre-decode all naddr values at module load time. */
function decodeCuratedNaddrs(): DecodedNaddr[] {
  const results: DecodedNaddr[] = [];
  for (const naddr of CURATED_NADDRS) {
    try {
      const decoded = nip19.decode(naddr);
      if (decoded.type === 'naddr') {
        results.push({
          pubkey: decoded.data.pubkey,
          identifier: decoded.data.identifier,
          kind: decoded.data.kind,
          naddr,
        });
      }
    } catch {
      // Skip invalid naddrs
    }
  }
  return results;
}

const DECODED_CURATED = decodeCuratedNaddrs();

/**
 * Fetches a hand-curated set of treasures for the homepage showcase.
 * Groups queries by pubkey for efficiency.
 */
export function useCuratedTreasures() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['curated-treasures'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      // Group by pubkey+kind for efficient batched queries
      const groups = new Map<string, { pubkey: string; kind: number; identifiers: string[] }>();
      for (const item of DECODED_CURATED) {
        const key = `${item.pubkey}:${item.kind}`;
        if (!groups.has(key)) {
          groups.set(key, { pubkey: item.pubkey, kind: item.kind, identifiers: [] });
        }
        groups.get(key)!.identifiers.push(item.identifier);
      }

      // Build one filter per group
      const filters = Array.from(groups.values()).map(g => ({
        kinds: [g.kind],
        authors: [g.pubkey],
        '#d': g.identifiers,
      }));

      const events = await nostr.query(filters, { signal });

      // Parse events into Geocache objects
      const geocacheMap = new Map<string, Geocache>();
      for (const event of events) {
        const parsed = parseGeocacheEvent(event);
        if (parsed) {
          // Key by pubkey:dTag for matching back to curated order
          geocacheMap.set(`${parsed.pubkey}:${parsed.dTag}`, parsed);
        }
      }

      // Return in the curated order, filtering out any that weren't found
      const ordered: Geocache[] = [];
      for (const item of DECODED_CURATED) {
        const geocache = geocacheMap.get(`${item.pubkey}:${item.identifier}`);
        if (geocache) {
          ordered.push(geocache);
        }
      }

      return ordered;
    },
    staleTime: 600000, // 10 minutes
    gcTime: 1800000, // 30 minutes
  });
}
