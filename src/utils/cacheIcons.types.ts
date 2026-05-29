export type CacheType = 'traditional' | 'multi' | 'mystery';

export interface CacheIconProps {
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: string;
  /**
   * When true, swap the per-type glyph for a Palette glyph to signal that
   * this treasure carries the `art` modifier. Mirrors the map marker
   * behavior in `cacheMapIcons.ts` so cards and markers stay in lockstep.
   */
  isArt?: boolean;
}