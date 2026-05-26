/**
 * Banner shown on first-to-find treasure pages once a claim has been recorded.
 *
 * Surfaces the winning finder's identity and claim date, so visitors immediately
 * understand that the treasure is no longer claimable. Late verified logs are
 * still allowed per NIP-GC; the banner is informational, not a hard gate.
 */

import { Trophy } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthor } from '@/hooks/useAuthor';
import type { GeocacheLog } from '@/types/geocache';
import { cn } from '@/lib/utils';

export interface FtfClaimBannerProps {
  winner: GeocacheLog;
  className?: string;
}

export function FtfClaimBanner({ winner, className }: FtfClaimBannerProps) {
  const { t } = useTranslation();
  const author = useAuthor(winner.pubkey);
  const metadata = author.data?.metadata;

  const displayName =
    metadata?.display_name ||
    metadata?.name ||
    `${winner.pubkey.slice(0, 8)}…`;

  const claimedDate = new Date(winner.created_at * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const npub = nip19.npubEncode(winner.pubkey);

  return (
    <div
      className={cn(
        'rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 flex items-start gap-3',
        className,
      )}
      role="status"
    >
      <Trophy className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {t('ftf.banner.title', 'Claimed')}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('ftf.banner.body', {
            defaultValue: 'Won by {{name}} on {{date}}',
            name: displayName,
            date: claimedDate,
          })}
        </p>
        <Link
          to={`/${npub}`}
          className="text-xs text-primary hover:underline mt-1 inline-block"
        >
          {t('ftf.banner.viewProfile', 'View profile')}
        </Link>
      </div>
    </div>
  );
}
