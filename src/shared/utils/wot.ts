import { useWotStore } from '@/shared/stores/useWotStore';

export const isWotEnabled = (trustLevel: number): boolean => trustLevel > 0;

export const useIsWotEnabled = (): boolean => {
  const trustLevel = useWotStore((state) => state.trustLevel);
  return isWotEnabled(trustLevel);
};