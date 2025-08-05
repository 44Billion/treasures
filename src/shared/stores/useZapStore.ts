import { create } from 'zustand';
import { nip57 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

interface ZapStore {
  zaps: Record<string, NostrEvent[]>;
  getZapTotal: (key: string) => number;
  setZaps: (key: string, zaps: NostrEvent[]) => void;
}

// Helper function to extract zap amount from event
function getZapAmount(event: NostrEvent): number {
  const pTag = event.tags.find((t) => t[0] === 'p')?.[1];
  const PTag = event.tags.find((t) => t[0] === 'P')?.[1];
  
  // Skip self-zaps (where sender and receiver are the same)
  if (pTag && PTag && pTag === PTag) {
    return 0;
  }
  
  const bolt11 = event.tags.find((t) => t[0] === 'bolt11')?.[1];
  if (bolt11) {
    try {
      return nip57.getSatoshisAmountFromBolt11(bolt11);
    } catch (e) {
      console.error("Invalid bolt11 invoice", bolt11, e);
      return 0;
    }
  }
  return 0;
}

export const useZapStore = create<ZapStore>((set, get) => ({
  zaps: {},
  getZapTotal: (key) => {
    const zaps = get().zaps[key] || [];
    console.log('DEBUG: ZapStore.getZapTotal:', {
      key,
      zapCount: zaps.length,
      zaps: zaps.map(z => ({ id: z.id, amount: getZapAmount(z) }))
    });
    
    return zaps.reduce((total, zap) => {
      return total + getZapAmount(zap);
    }, 0);
  },
  setZaps: (key, zaps) => {
    set((state) => ({
      zaps: {
        ...state.zaps,
        [key]: zaps,
      },
    }));
  },
}));
