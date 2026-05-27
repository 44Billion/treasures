import { useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { useTranslation } from 'react-i18next';

import { useAuthor } from '@/hooks/useAuthor';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Skeleton } from './ui/skeleton';

interface NaddrAuthorCardProps {
  /** The naddr identifier for the geocache listing */
  naddr: string | undefined;
  /** Optional className for the wrapping Card */
  className?: string;
}

/**
 * Decodes the author pubkey from a geocache naddr and displays a compact
 * author card (avatar + display name + truncated npub) along with a label
 * indicating who hid the treasure. Used on the lookup loading screen and
 * the "Treasure Not Found" state so the user can see who owns the listing
 * even before (or without) the event being retrieved from a relay.
 */
export function NaddrAuthorCard({ naddr, className }: NaddrAuthorCardProps) {
  const { t } = useTranslation();

  const authorPubkey = useMemo(() => {
    if (!naddr || !naddr.startsWith('naddr1')) return '';
    try {
      const decoded = nip19.decode(naddr);
      if (decoded.type !== 'naddr') return '';
      return decoded.data.pubkey;
    } catch {
      return '';
    }
  }, [naddr]);

  const { data: author, isLoading } = useAuthor(authorPubkey);

  if (!authorPubkey) {
    return null;
  }

  const label = t('cacheDetail.author.hiddenBy');

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center gap-4 p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-[140px]" />
            <Skeleton className="h-3 w-[110px]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const metadata = author?.metadata;
  const displayName =
    metadata?.display_name ||
    metadata?.name ||
    `${authorPubkey.slice(0, 8)}…`;
  const truncatedNpub = (() => {
    try {
      const npub = nip19.npubEncode(authorPubkey);
      return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
    } catch {
      return '';
    }
  })();

  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4 p-4 text-left">
        <Avatar className="h-12 w-12">
          <AvatarImage src={metadata?.picture} alt={displayName} />
          <AvatarFallback>
            {(metadata?.name || metadata?.display_name || '?').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="font-semibold truncate">
            {displayName}
            {metadata?.nip05 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({metadata.nip05})
              </span>
            )}
          </p>
          {truncatedNpub && (
            <p className="text-xs text-muted-foreground truncate">
              {truncatedNpub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
