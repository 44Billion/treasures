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

import { Trophy, Palette, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { Geocache } from '@/types/geocache';
import { getActiveModifiers, type ActiveModifier } from '@/utils/modifiers';
import { cn } from '@/lib/utils';

export interface ModifierBadgesProps {
  cache: Pick<Geocache, 'mission' | 'modifiers'>;
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
  className?: string;
}

export function ModifierBadges({
  cache,
  ftfClaimed = false,
  size = 'default',
  inline = false,
  className,
}: ModifierBadgesProps) {
  const active = getActiveModifiers(cache);
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
