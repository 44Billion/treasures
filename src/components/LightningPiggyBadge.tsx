/**
 * Pig badge + explainer affordances for treasures created by the Lightning
 * Piggy client (`["client", "Lightning Piggy"]` tag).
 *
 * Two variants live here:
 *  - `LightningPiggyCallout` — an inline informational banner with the
 *    explanation and learn-more link directly visible. Used on the map
 *    popup card above the "View treasure" actions (compact) and on the
 *    treasure detail page below the badge row (default).
 *  - `LightningPiggyBadge` — small pig badge that opens the same explainer
 *    in a popover. Kept for tight layouts (badge rows) where a banner
 *    doesn't fit.
 *
 * Both complement the pig-on-pink map marker and the pink pig type glyph
 * on cards (see `cacheMapIcons.ts` / `cacheIcons.tsx`). All click targets
 * stop event propagation so taps don't activate the surrounding card /
 * map popup navigation.
 */

import { PiggyBank, ExternalLink } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Lightning Piggy's own explainer for pig treasure hunts. */
export const LIGHTNING_PIGGY_TREASURE_HUNT_URL = 'https://lightningpiggy.com/treasure-hunt/';

export interface LightningPiggyBadgeProps {
  size?: 'default' | 'compact';
  /**
   * Whether to render the "Lightning Piggy" text next to the pig. Defaults
   * to label-on for the `default` size (detail page) and pig-only for
   * `compact` (map popup rows).
   */
  showLabel?: boolean;
  className?: string;
}

export function LightningPiggyBadge({ size = 'default', showLabel, className }: LightningPiggyBadgeProps) {
  const { t } = useTranslation();
  const withLabel = showLabel ?? size === 'default';

  const iconSize = size === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const baseClass = cn(
    'w-fit gap-1',
    size === 'compact' && 'text-[10px] px-1.5 py-0',
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('inline-flex', className)}
          aria-label={t('lightningPiggy.badge')}
          onClick={(e) => {
            // Don't let the tap bubble into the surrounding card / map
            // popup click handlers (which navigate to the detail page).
            e.stopPropagation();
          }}
        >
          <Badge
            variant="outline"
            className={cn(
              baseClass,
              'border-pink-500/60 bg-pink-500/10 text-foreground cursor-pointer hover:bg-pink-500/20 transition-colors',
            )}
          >
            <PiggyBank className={cn(iconSize, 'text-pink-500')} />
            {withLabel && t('lightningPiggy.badge')}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium flex items-center gap-1.5">
          <PiggyBank className="h-4 w-4 text-pink-500 flex-shrink-0" />
          {t('lightningPiggy.popover.title')}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('lightningPiggy.popover.description')}
        </p>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-pink-500/40 text-pink-600 hover:bg-pink-500/10 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-400"
        >
          <a
            href={LIGHTNING_PIGGY_TREASURE_HUNT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('lightningPiggy.popover.learnMore')}
            <ExternalLink className="h-3 w-3 ml-1.5" />
          </a>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export interface LightningPiggyCalloutProps {
  /**
   * Both sizes render as a full-bleed horizontal strip (border-y, no
   * rounding) — pair with negative x-margins to stretch edge-to-edge in
   * padded containers.
   * `compact` — dense strip for the map popup card.
   * `default` — larger text/padding for the treasure detail page.
   */
  size?: 'default' | 'compact';
  className?: string;
}

/**
 * Inline informational banner for Lightning Piggy treasures.
 *
 * Shows a one-liner explanation and a "Learn more" link directly (no
 * popover indirection). Used on the map popup card above the action
 * buttons (compact) and on the treasure detail page below the badge row
 * (default), stretched edge-to-edge in both places.
 */
export function LightningPiggyCallout({ size = 'compact', className }: LightningPiggyCalloutProps) {
  const { t } = useTranslation();
  const isCompact = size === 'compact';

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-y border-pink-500/30 bg-pink-500/10',
        isCompact ? 'px-2.5 py-1' : 'gap-2.5 px-4 lg:px-6 py-3',
        className,
      )}
    >
      <PiggyBank className={cn('text-pink-500 flex-shrink-0', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
      <p
        className={cn(
          'text-muted-foreground flex-1 min-w-0',
          // Text sizes mirror the description copy next to each usage:
          // text-xs in the map popup card, text-base on the detail page.
          isCompact ? 'text-xs leading-snug' : 'text-base',
        )}
      >
        {/* The locale strings carry a <bold> placeholder around the
            "Lightning Piggy" name so it stays bold wherever the name
            lands in each translation. The compact popup strip gets the
            one-liner; the detail page has room for the fuller version. */}
        <Trans
          i18nKey={isCompact ? 'lightningPiggy.callout.text' : 'lightningPiggy.callout.textLong'}
          components={{ bold: <span className="font-medium text-foreground" /> }}
        />{' '}
        <a
          href={LIGHTNING_PIGGY_TREASURE_HUNT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 font-medium text-pink-600 dark:text-pink-400 hover:underline whitespace-nowrap"
        >
          {t('lightningPiggy.popover.learnMore')}
          <ExternalLink className={isCompact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} />
        </a>
      </p>
    </div>
  );
}
