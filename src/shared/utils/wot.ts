import { useWotStore } from '@/shared/stores/useWotStore';

export const isWotEnabled = (trustLevel: number): boolean => trustLevel > 0;

export const useIsWotEnabled = (): boolean => {
  const trustLevel = useWotStore((state) => state.trustLevel);
  const wotPubkeys = useWotStore((state) => state.wotPubkeys);
  
  console.log('DEBUG: WoT state check:', {
    trustLevel,
    isWotEnabled: isWotEnabled(trustLevel),
    wotPubkeysSize: wotPubkeys.size,
    wotPubkeysArray: Array.from(wotPubkeys).slice(0, 5) // Show first 5 for debugging
  });
  
  return isWotEnabled(trustLevel);
};