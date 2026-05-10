import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';

import { DesktopHeader } from '@/components/DesktopHeader';
import { DetailedGeocacheCard } from '@/components/geocache-card';
import { EmptyStateCard } from '@/components/ui/card-patterns';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/loading';
import { GeocacheLoading } from '@/components/GeocacheLoading';
import { useGeocachesByDTag } from '@/hooks/useGeocachesByDTag';
import { geocacheToNaddr } from '@/utils/naddr';

/**
 * Look up treasures by their `d` tag. Because a `d` tag is only unique per
 * author, multiple treasures may share the same identifier — in that case we
 * list every match and let the user pick.
 *
 * When exactly ONE match is found we redirect to `/<naddr>` so the canonical
 * NIP-19 address shows in the URL bar (and direct deep-links continue to work
 * across the rest of the app).
 *
 * Routed at `/d/:dTag`.
 */
export default function CacheByDTag() {
  const { t } = useTranslation();
  const { dTag } = useParams<{ dTag: string }>();
  const queryClient = useQueryClient();
  const { data: geocaches, isLoading, isError, error, refetch } = useGeocachesByDTag(dTag);

  // Compute the naddr for the sole match (if any). Memoised so we can both
  // pre-populate the per-naddr query cache and forward it to the redirect
  // without recomputing on every render.
  const soleMatch = useMemo(() => {
    if (!geocaches || geocaches.length !== 1) return null;
    const only = geocaches[0]!;
    return {
      geocache: only,
      naddr: geocacheToNaddr(only.pubkey, only.dTag, only.relays, only.kind),
    };
  }, [geocaches]);

  // Pre-populate the per-naddr cache so the destination CacheDetail page
  // renders instantly from already-fetched data instead of issuing another
  // relay round-trip.
  useEffect(() => {
    if (soleMatch) {
      queryClient.setQueryData(['geocache-by-naddr', soleMatch.naddr], soleMatch.geocache);
    }
  }, [soleMatch, queryClient]);

  // Show a neutral cache-loading screen while the lookup is in-flight. We do
  // NOT render the "Treasures matching identifier" heading here because in the
  // common case there'll be exactly one match and we'll redirect — flashing a
  // list-page heading first would be jarring.
  if (isLoading) {
    return (
      <GeocacheLoading
        title={t('cacheDetail.loading.title')}
        description={t('cacheDetail.loading.description')}
      />
    );
  }

  if (soleMatch) {
    // Pass the already-fetched geocache via navigation state so <CacheDetail/>
    // renders instantly from `passedGeocacheData` and skips its own loader.
    // The query-cache pre-population above is the belt; this is the suspenders.
    return (
      <Navigate
        to={`/${soleMatch.naddr}`}
        replace
        state={{ geocacheData: soleMatch.geocache }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-background dark:via-primary-50 dark:to-background adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70 mojave:from-background mojave:via-background mojave:to-background relative">
      <div className="absolute inset-0 -z-20 hidden adventure:block" style={{
        backgroundImage: 'url(/parchment-300.jpg)',
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        opacity: 0.25,
      }} />

      <DesktopHeader />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('common.back', 'Back')}
            </Button>
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {t('cacheByDTag.title', 'Treasures matching identifier')}
          </h1>
          <p className="text-sm text-muted-foreground break-all">
            <span className="font-mono px-2 py-1 rounded bg-muted">{dTag}</span>
          </p>
        </div>

        {isError ? (
          <ErrorState
            title={t('cacheByDTag.error.title', 'Lookup failed')}
            description={(error as Error)?.message || t('cacheByDTag.error.description', 'Unable to look up that identifier.')}
            onRetry={() => refetch()}
          />
        ) : !geocaches || geocaches.length === 0 ? (
          <EmptyStateCard
            icon={Search}
            title={t('cacheByDTag.empty.title', 'No treasures found')}
            description={t(
              'cacheByDTag.empty.description',
              'No treasure was found with that identifier. It may have been deleted, or the link may be incorrect.',
            )}
            action={
              <Link to="/map">
                <Button>
                  {t('cacheByDTag.empty.browseMap', 'Browse the map')}
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {t('cacheByDTag.results.count', {
                count: geocaches.length,
                defaultValue: '{{count}} treasures share this identifier. Pick one to view it.',
              })}
            </p>
            <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              {geocaches.map((cache) => (
                <DetailedGeocacheCard key={`${cache.pubkey}:${cache.dTag}`} cache={cache} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
