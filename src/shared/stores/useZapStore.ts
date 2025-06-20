import { create } from 'zustand';
import { nip57 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

interface ZapStore {
  zaps: Record<string, NostrEvent[]>;
  getZapTotal: (key: string) => number;
  setZaps: (key: string, zaps: NostrEvent[]) => void;
}

export const useZapStore = create<ZapStore>((set, get) => ({
  zaps: {},
  getZapTotal: (key) => {
    const zaps = get().zaps[key] || [];
    return zaps.reduce((total, zap) => {
      const pTag = zap.tags.find((t) => t[0] === 'p')?.[1];
      const PTag = zap.tags.find((t) => t[0] === 'P')?.[1];
      if (pTag && PTag && pTag === PTag) {
        return total;
      }
      
      const bolt11 = zap.tags.find((t) => t[0] === 'bolt11')?.[1];
      if (bolt11) {
        try {
          return total + nip57.getSatoshisAmountFromBolt11(bolt11);
        } catch (e) {
          console.error("Invalid bolt11 invoice", bolt11, e);
          return total;
        }
      }
      return total;
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
