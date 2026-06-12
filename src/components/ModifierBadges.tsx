/**
 * Shared visual badges for treasure modifiers.
 *
 * Renders one small badge per active modifier on a treasure, in the stable
 * ordering provided by `getActiveModifiers`. Used by the treasure detail page,
 * geocache cards, and the map popup so modifier indication is consistent.
 *
 * Sizing variants:
 *  - `default` — comfortable badge for the detail page.
 *  - `compact` — denser, smaller-icon badge for cards and map popups.
 *
 * Layout modes:
 *  - default — badges are wrapped in their own `flex flex-wrap` container.
 *    Use when ModifierBadges is the only badge content in its slot (detail
 *    page header, popup body).
 *  - `inline` — renders as a Fragment so each badge becomes a direct child
 *    of the caller's flex-wrap row. Use inside the card "badges + stats"
 *    rows so modifier badges share the parent row's gap and wrapping rules
 *    instead of becoming an oversized atomic flex item that forces the
 *    surrounding D/T/size badges onto extra lines.
 *
 * Optional FTF claimed-state: when a `first-to-find` modifier is present AND
 * the consumer passes `ftfClaimed`, the FTF badge swaps its label to "Claimed"
 * and adopts a muted variant so the treasure visibly reads as already won.
 */

import { useState } from 'react';
import { Trophy, Palette, KeyRound, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Geocache } from '@/types/geocache';
import { getActiveModifiers, type ActiveModifier, type ActiveModifierKind } from '@/utils/modifiers';
import { cn } from '@/lib/utils';

export interface ModifierBadgesProps {
  cache: Pick<Geocache, 'mission' | 'modifiers' | 'lightningEnabled'>;
  /**
   * If true and the cache has the `first-to-find` modifier, the FTF badge
   * renders in its "claimed" state (muted color, "Claimed" label).
   * Consumers compute this from `getFtfStatus(cache, logs)`.
   */
  ftfClaimed?: boolean;
  size?: 'default' | 'compact';
  /**
   * When true, renders the badges as a Fragment (no wrapping container) so
   * they flow into the caller's flex-wrap row. The caller is responsible
   * for layout and gap. See module doc for rationale.
   */
  inline?: boolean;
  /**
   * Modifier kinds the caller renders elsewhere itself (e.g. the map popup
   * places the lightning bolt inline in its D/T stats row instead of in the
   * modifier badge block). Excluded kinds are skipped here.
   */
  exclude?: ActiveModifierKind[];
  className?: string;
}

export function ModifierBadges({
  cache,
  ftfClaimed = false,
  size = 'default',
  inline = false,
  exclude,
  className,
}: ModifierBadgesProps) {
  let active = getActiveModifiers(cache);
  if (exclude && exclude.length > 0) {
    active = active.filter((m) => !exclude.includes(m.kind));
  }
  if (active.length === 0) return null;

  if (inline) {
    return (
      <>
        {active.map((m) => (
          <ModifierBadge key={m.kind} modifier={m} size={size} ftfClaimed={ftfClaimed} />
        ))}
      </>
    );
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {active.map((m) => (
        <ModifierBadge key={m.kind} modifier={m} size={size} ftfClaimed={ftfClaimed} />
      ))}
    </div>
  );
}

interface ModifierBadgeProps {
  modifier: ActiveModifier;
  size: 'default' | 'compact';
  ftfClaimed: boolean;
}

function ModifierBadge({ modifier, size, ftfClaimed }: ModifierBadgeProps) {
  const { t } = useTranslation();

  const iconSize = size === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const baseClass = cn(
    'w-fit gap-1',
    size === 'compact' && 'text-[10px] px-1.5 py-0',
  );

  switch (modifier.kind) {
    case 'key-quest':
      return (
        <Badge
          variant="outline"
          className={cn(baseClass, 'border-amber-500/60 bg-amber-500/10 text-foreground')}
        >
          <KeyRound className={iconSize} />
          {t('modifiers.badge.keyQuest')}
        </Badge>
      );

    case 'first-to-find':
      if (ftfClaimed) {
        return (
          <Badge
            variant="outline"
            className={cn(
              baseClass,
              'border-muted-foreground/40 bg-muted text-muted-foreground',
            )}
          >
            <Trophy className={iconSize} />
            {t('modifiers.badge.firstToFind.claimed')}
          </Badge>
        );
      }
      return (
        <Badge
          variant="outline"
          className={cn(baseClass, 'border-primary/60 bg-primary/10 text-foreground')}
        >
          <Trophy className={iconSize} />
          {t('modifiers.badge.firstToFind')}
        </Badge>
      );

    case 'lightning':
      // Cards/popups (compact) show the bolt glyph only ("tl;dr: lightning");
      // the detail page (default size) adds the label for a little more
      // context. The full payout explanation lives in the tooltip.
      return <LightningBadge size={size} />;

    case 'art':
      return (
        <Badge
          variant="outline"
          className={cn(baseClass, 'border-violet-500/60 bg-violet-500/10 text-foreground')}
        >
          <Palette className={iconSize} />
          {t('modifiers.badge.art')}
        </Badge>
      );
  }
}

export interface LightningBadgeProps {
  size?: 'default' | 'compact';
  /**
   * Whether to render the "Lightning" text next to the bolt. Defaults to
   * label-on for the `default` size (detail page) and bolt-only for
   * `compact` (cards, map popup rows).
   */
  showLabel?: boolean;
  className?: string;
}

/**
 * Bolt badge for lightning-enabled treasures (payout-lnurl-w label).
 *
 * Exported separately so layouts that don't use the modifier badge block can
 * place the bolt themselves (e.g. the map popup puts it in its D/T row —
 * pass `exclude={['lightning']}` to ModifierBadges there).
 *
 * Tooltip behavior is hover-driven on desktop. Hover doesn't exist on touch
 * devices, so the badge also opens the tooltip on click/tap: the click
 * handler calls `preventDefault()` (which suppresses Radix's internal
 * close-on-click trigger behavior) and `stopPropagation()` (so tapping the
 * bolt doesn't activate the surrounding card/popup navigation). Tapping
 * anywhere else dismisses it via Radix's outside-pointer handling.
 */
export function LightningBadge({ size = 'default', showLabel, className }: LightningBadgeProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const withLabel = showLabel ?? size === 'default';

  const iconSize = size === 'compact' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const baseClass = cn(
    'w-fit gap-1',
    size === 'compact' && 'text-[10px] px-1.5 py-0',
  );

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        {/* Badge doesn't forward refs, so the trigger wraps it in a span. */}
        <span
          className={cn('inline-flex', className)}
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Badge
            variant="outline"
            aria-label={t('modifiers.badge.lightning')}
            className={cn(
              baseClass,
              'border-yellow-500/60 bg-yellow-500/10 text-foreground cursor-default',
            )}
          >
            <Zap className={cn(iconSize, 'text-yellow-500 fill-yellow-500')} />
            {withLabel && t('modifiers.badge.lightning')}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px]">
        <p className="font-medium">{t('modifiers.badge.lightning')}</p>
        <p className="text-xs opacity-80">{t('modifiers.badge.lightning.tooltip')}</p>
      </TooltipContent>
    </Tooltip>
  );
}
