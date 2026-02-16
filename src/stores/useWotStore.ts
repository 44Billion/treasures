import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nip19 } from 'nostr-tools';
import { type NostrContextType } from '@nostrify/react';

const MAX_WOT_PUBKEYS = 100000;

// --- Types ---
interface WotState {
  trustLevel: number; // 0: disabled, 1: Strict, 2: Normal, 3: Lax
  startingPoint: string; // hex pubkey
  wotPubkeys: Set<string>;
  isLoading: boolean;
  lastCalculated: number | null;
  progress: number; // 0-100
  abortController: AbortController | null;
  followLimit: number;
}

interface WotActions {
  setTrustLevel: (level: number) => void;
  setStartingPoint: (npubOrHex: string) => void;
  calculateWot: (nostr: NostrContextType["nostr"], currentUserPubkey?: string) => Promise<void>;
  cancelCalculation: () => void;
  clearWot: () => void;
  setFollowLimit: (followLimit: number) => void;
}

type WotStore = WotState & WotActions;

// --- Helper Functions ---
const getHexPubkey = (npubOrHex: string): string => {
  try {
    if (npubOrHex.startsWith('npub1')) {
      const { data } = nip19.decode(npubOrHex);
      return data as string;
    }
  } catch (e) {
    console.error(`Invalid npub: ${npubOrHex}`, e);
  }
  // Assume it's already a hex if it's not a valid npub
  return npubOrHex;
};

// --- Store Definition ---
export const useWotStore = create<WotStore>()(
  persist(
    (set, get) => ({
      // --- State ---
      trustLevel: 0, // Default to "disabled"
      startingPoint: '',
      wotPubkeys: new Set<string>(),
      isLoading: false,
      lastCalculated: null,
      progress: 0,
      abortController: null,
      followLimit: 0,

      // --- Actions ---
      setTrustLevel: (level) => set({ trustLevel: level }),
      setStartingPoint: (npubOrHex) => {
        const hex = getHexPubkey(npubOrHex);
        if (hex) {
          set({ startingPoint: hex });
        }
      },
      clearWot: () => set({ wotPubkeys: new Set(), lastCalculated: null, progress: 0 }),
      cancelCalculation: () => {
        get().abortController?.abort();
        set({ isLoading: false, progress: 0, abortController: null });
      },
      setFollowLimit: (followLimit) => set({ followLimit }),

      calculateWot: async (nostr, currentUserPubkey) => {
        const { trustLevel, startingPoint, abortController: existingAc, followLimit } = get();
        if (existingAc) {
          existingAc.abort();
        }
        const ac = new AbortController();

        const rootPubkey = startingPoint || currentUserPubkey;

        if (!rootPubkey) {
          console.warn('WoT calculation skipped: No starting point or current user.');
          return;
        }
        
        if (trustLevel === 0) {
          console.warn('WoT calculation skipped: filter is disabled.');
          set({ wotPubkeys: new Set(), lastCalculated: null, progress: 0 });
          return;
        }

        set({ isLoading: true, progress: 0, abortController: ac });

        try {
          let currentPubkeys = new Set([rootPubkey]);
          const allWotPubkeys = new Set([rootPubkey]);
          const BATCH_SIZE = 100;

          for (let i = 0; i < trustLevel; i++) {
            if (ac.signal.aborted) throw new Error('Aborted');
            if (currentPubkeys.size === 0) {
              set({ progress: 100 });
              break;
            }

            const pubkeyBatch = Array.from(currentPubkeys);
            const promises = [];
            
            if (trustLevel > 0) {
              set({ progress: (i / trustLevel) * 100 });
            }

            for (let j = 0; j < pubkeyBatch.length; j += BATCH_SIZE) {
              if (ac.signal.aborted) throw new Error('Aborted');
              const batch = pubkeyBatch.slice(j, j + BATCH_SIZE);
              promises.push(
                nostr.query([{
                  kinds: [3],
                  authors: batch,
                }], { signal: ac.signal })
              );
            }

            const results = await Promise.all(promises);
            const contactLists = results.flat();
            currentPubkeys = new Set();

            for (const event of contactLists) {
              const pTags = event.tags.filter(tag => tag[0] === 'p');
              if (i > 0 && followLimit > 0 && pTags.length > followLimit) {
                continue;
              }
              for (const tag of pTags) {
                const pubkey = tag && tag[1] ? tag[1] : '';
                if (!allWotPubkeys.has(pubkey)) {
                  currentPubkeys.add(pubkey);
                  allWotPubkeys.add(pubkey);
                  if (allWotPubkeys.size >= MAX_WOT_PUBKEYS) break;
                }
              }
              if (allWotPubkeys.size >= MAX_WOT_PUBKEYS) break;
            }
             if (allWotPubkeys.size >= MAX_WOT_PUBKEYS) break;
          }

          set({
            wotPubkeys: allWotPubkeys,
            lastCalculated: Date.now(),
            progress: 100,
          });
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error calculating Web of Trust:', error);
          }
        } finally {
          set({ isLoading: false, progress: 0, abortController: null });
        }
      },
    }),
    {
      name: 'wot-storage', // unique name for localStorage persistence
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const { state } = JSON.parse(str);
          return {
            state: {
              ...state,
              wotPubkeys: new Set(state.wotPubkeys),
            },
          };
        },
        setItem: (name, newValue) => {
          const str = JSON.stringify({
            state: {
              ...newValue.state,
              wotPubkeys: Array.from(newValue.state.wotPubkeys),
            },
          });
          localStorage.setItem(name, str);
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !['isLoading', 'progress', 'abortController'].includes(key)
          )
        ),
    }
  )
);