export type CacheType = 'traditional' | 'multi' | 'mystery';

export interface CacheIconProps {
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: string;
}