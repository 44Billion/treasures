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
  /**
   * When true, swap the glyph for a PiggyBank glyph to signal that this
   * treasure was created by Lightning Piggy (`client` tag). Takes
   * precedence over `isArt`. In the default theme the glyph renders pink
   * (`text-pink-500`) on the caller's normal backdrop; the pink-background
   * treatment lives on the map marker (`PIGGY_PINK` in `cacheMapIcons.ts`).
   */
  isPiggy?: boolean;
}