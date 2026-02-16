import { create } from 'zustand';
import { nip57 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

interface ZapStore {
  zaps: Record<string, NostrEvent[]>;
  zapTotals: Record<string, number>;
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
  zapTotals: {},
  getZapTotal: (key) => {
    // Return memoized total if available, otherwise calculate and cache it
    const currentState = get();
    if (key in currentState.zapTotals) {
      return currentState.zapTotals[key];
    }
    
    const zaps = currentState.zaps[key] || [];
    const total = zaps.reduce((total, zap) => {
      return total + getZapAmount(zap);
    }, 0);
    
    // Cache the calculated total
    set((state) => ({
      zapTotals: {
        ...state.zapTotals,
        [key]: total,
      },
    }));
    
    return total;
  },
  setZaps: (key, zaps) => {
    // Calculate the new total and update both zaps and totals
    const total = zaps.reduce((sum, zap) => sum + getZapAmount(zap), 0);
    
    set((state) => ({
      zaps: {
        ...state.zaps,
        [key]: zaps,
      },
      zapTotals: {
        ...state.zapTotals,
        [key]: total,
      },
    }));
  },
}));
