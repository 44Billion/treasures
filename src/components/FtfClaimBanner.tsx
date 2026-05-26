/**
 * Banner shown on first-to-find treasure pages once a claim has been recorded.
 *
 * Two states:
 *  - `provisional`: a verified found log exists but the owner has not yet
 *    locked in the winner via an `F` tag. The owner sees an "Archive & lock
 *    in winner" action that republishes the treasure with `status=archived`
 *    and the `F` tag set to the winner's pubkey.
 *  - `locked`: the treasure carries an `F` tag. Attribution is canonical and
 *    the action is hidden.
 *
 * Late verified logs are still allowed per NIP-GC; this banner is the
 * authoritative claim display, not a hard gate.
 */

import { Trophy, Archive, Loader2 } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthor } from '@/hooks/useAuthor';
import { cn } from '@/lib/utils';

export interface FtfClaimBannerProps {
  /**
   * Pubkey of the FTF winner (hex). When the claim is `locked`, this comes
   * straight from the treasure's `F` tag; when `provisional`, it comes from
   * the winning verified found log.
   */
  winnerPubkey: string;
  /**
   * Timestamp of the claim (winning verified found log's `created_at`).
   * Optional — omitted in the `locked` state when the matching log hasn't
   * been loaded yet.
   */
  claimedAt?: number;
  /**
   * `true` when the treasure carries an `F` tag (lock-in is canonical).
   * `false` when the claim is still provisional and the owner can act.
   */
  locked: boolean;
  /**
   * `true` when the current user is the treasure owner. Owner-only actions
   * (lock-in button) are gated on this.
   */
  isOwner: boolean;
  /**
   * Invoked when the owner confirms "Archive & lock in winner". Parent is
   * responsible for republishing the treasure with `status='archived'` and
   * `ftfWinner=<winnerPubkey>` set.
   */
  onLockClaim?: () => void;
  /** Disables the lock button while a publish is in flight. */
  isLocking?: boolean;
  className?: string;
}

export function FtfClaimBanner({
  winnerPubkey,
  claimedAt,
  locked,
  isOwner,
  onLockClaim,
  isLocking = false,
  className,
}: FtfClaimBannerProps) {
  const { t } = useTranslation();
  const author = useAuthor(winnerPubkey);
  const metadata = author.data?.metadata;

  const displayName =
    metadata?.display_name ||
    metadata?.name ||
    `${winnerPubkey.slice(0, 8)}…`;
  const avatarUrl = metadata?.picture;
  const fallbackInitial = (displayName?.[0] ?? '?').toUpperCase();

  const npub = nip19.npubEncode(winnerPubkey);

  const claimedDate = claimedAt
    ? new Date(claimedAt * 1000).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const canLockIn = isOwner && !locked && !!onLockClaim;

  return (
    <div
      className={cn(
        'rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 flex items-start gap-3',
        className,
      )}
      role="status"
    >
      <Trophy className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t('ftf.banner.title', 'Claimed')}
        </p>

        {/* Winner identity: avatar + display name as one link target. */}
        <Link
          to={`/${npub}`}
          className="inline-flex items-center gap-2 hover:underline"
        >
          <Avatar className="h-7 w-7">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="text-xs">{fallbackInitial}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground">{displayName}</span>
        </Link>

        {claimedDate && (
          <p className="text-xs text-muted-foreground">
            {t('ftf.banner.claimedOn', {
              defaultValue: 'Claimed on {{date}}',
              date: claimedDate,
            })}
          </p>
        )}

        {canLockIn && (
          <div className="pt-1">
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={isLocking}
              onClick={onLockClaim}
              className="gap-1.5"
            >
              {isLocking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              {t('ftf.banner.lockIn.button', 'Archive & lock in winner')}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t(
                'ftf.banner.lockIn.help',
                'Confirms this finder as the official winner and archives the listing.',
              )}
            </p>
          </div>
        )}

        {/* Universal explainer: clarifies what "Claimed" means on an FTF
            treasure for any viewer (owner or visitor). Late verified logs
            remain valid records of physical presence per NIP-GC but do not
            constitute additional claims. */}
        <p className="text-[11px] text-muted-foreground pt-1 border-t border-primary/20 mt-2">
          {t(
            'ftf.banner.explainer',
            'This is a first-to-find treasure: only one finder can claim the prize. Others may still log a visit, but the claim is settled.',
          )}
        </p>
      </div>
    </div>
  );
}
