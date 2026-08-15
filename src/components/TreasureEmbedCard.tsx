import { Link } from 'react-router-dom';
import { useGeocacheByNaddr } from '@/hooks/useGeocacheByNaddr';
import { parseNaddr } from '@/utils/naddr';
import { GeocachePopupCard } from '@/components/GeocachePopupCard';
import { NaddrAuthorCard } from '@/components/NaddrAuthorCard';
import { Skeleton } from '@/components/ui/skeleton';

interface TreasureEmbedCardProps {
  /** A geocache naddr (with or without the `nostr:` prefix). */
  naddr: string;
  /** Optional extra classes for the wrapping container. */
  className?: string;
}

/** Shared shell so the loading, fallback and loaded states share one frame. */
const SHELL_CLASS =
  'not-prose my-4 block w-[min(340px,100%)] overflow-hidden rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm align-top adventure:border-stone-400/30 adventure:bg-stone-100/20';

/**
 * Renders a rich preview card for a treasure (geocache) listing referenced by
 * its `naddr`. Used to turn inline `nostr:naddr1…` references inside blog posts
 * and logs into a self-contained card showing the treasure's hero image,
 * title, difficulty/terrain, author and find/zap counts.
 *
 * Fetches the listing via {@link useGeocacheByNaddr}. While loading it shows a
 * skeleton; if the listing can't be found on any relay it falls back to a
 * compact author card that still links through to the detail page.
 */
export function TreasureEmbedCard({ naddr, className }: TreasureEmbedCardProps) {
  // Normalize away an optional `nostr:` prefix so decoding works either way.
  const normalized = naddr.replace(/^nostr:/, '');

  // Only geocache naddrs are supported here; bail early for anything else so
  // callers can fall back to a plain link.
  const isGeocacheNaddr = !!parseNaddr(normalized);

  const { data: geocache, isLoading } = useGeocacheByNaddr(
    isGeocacheNaddr ? normalized : '',
  );

  if (!isGeocacheNaddr) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={SHELL_CLASS}>
        <div className="flex items-center gap-3 p-3">
          <Skeleton className="h-14 w-14 flex-shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // Not found on any relay — still let the reader navigate to the detail page,
  // which runs its own multi-relay lookup, and show who hid it.
  if (!geocache) {
    return (
      <Link to={`/${normalized}`} className="not-prose my-4 block no-underline">
        <NaddrAuthorCard naddr={normalized} className={className} />
      </Link>
    );
  }

  return (
    <div className={className ? `${SHELL_CLASS} ${className}` : SHELL_CLASS}>
      <GeocachePopupCard geocache={geocache} />
    </div>
  );
}
