import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bookmark, MapPin, Trash2, Cloud, MoreVertical, RefreshCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DetailedGeocacheCard } from '@/components/geocache-card';
import { EmptyStateCard } from '@/components/ui/card-patterns';
import { DesktopHeader } from '@/components/DesktopHeader';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LoginRequiredCard } from '@/components/LoginRequiredCard';
import { useSavedCaches } from '@/hooks/useSavedCaches';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDistanceToNow } from '@/utils/date';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ComponentLoading } from '@/components/ui/loading';


export default function MyCaches() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { savedCaches, unsaveCache, clearAllSaved, isNostrEnabled, isLoading: isLoadingSaved, isSyncing } = useSavedCaches();
  const { coords } = useGeolocation();
  const queryClient = useQueryClient();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cache-bookmark-list'] }),
        queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate distances if location is available
  const savedCachesWithDistance = savedCaches.map(cache => {
    let distance: number | undefined;
    if (coords) {
      const R = 6371; // Earth's radius in kilometers
      const dLat = (cache.location.lat - coords.latitude) * Math.PI / 180;
      const dLon = (cache.location.lng - coords.longitude) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coords.latitude * Math.PI / 180) * Math.cos(cache.location.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance = R * c * 1000; // Convert to meters
    }
    return { ...cache, distance };
  });

  const handleClearAll = () => {
    clearAllSaved();
    setShowClearDialog(false);
  };

  const validCaches = savedCachesWithDistance.filter(cache => cache.id && cache.pubkey);
  const uniqueCaches = validCaches.filter(
    (cache, index, self) => index === self.findIndex((c) => c.id === cache.id)
  );

  if (!user) {
    return (
      <div className="h-mobile-page md:min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-background dark:via-primary-50 dark:to-background adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70 flex flex-col relative">
        {/* Parchment background for adventure mode only - behind everything */}
        <div className="absolute inset-0 -z-20 hidden adventure:block" style={{
          backgroundImage: 'url(/parchment-300.jpg)',
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          opacity: 0.25
        }}></div>

        <DesktopHeader />
        <div className="flex-1 flex flex-col justify-center">
          <div className="container mx-auto px-4 py-8">
            <LoginRequiredCard
              icon={Bookmark}
              description={t('myCaches.loginRequired')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-background dark:via-primary-50 dark:to-background adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70 ${savedCaches.length === 0 ? 'max-md:h-mobile-fit max-md:overflow-hidden' : ''} relative`}>
      {/* Parchment background for adventure mode only - behind everything */}
      <div className="absolute inset-0 -z-20 hidden adventure:block" style={{
        backgroundImage: 'url(/parchment-300.jpg)',
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        opacity: 0.25
      }}></div>

      <DesktopHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
              <Bookmark className="h-6 w-6" />
              {t('myCaches.title')}
            </h1>

            {/* Nostr sync status */}
            {isNostrEnabled && (
              <div className="flex items-center gap-2">
                <div
                  role="status"
                  aria-live="polite"
                  className={`flex items-center gap-2 text-sm ${
                    isSyncing || isRefreshing ? 'text-blue-600 dark:text-blue-400' : 'text-primary'
                  }`}
                >
                  {isSyncing || isRefreshing ? (
                    <>
                      <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>{t('myCaches.syncing')}</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4" aria-hidden="true" />
                      <span>{t('myCaches.synced')}</span>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleRefresh}
                  disabled={isSyncing || isRefreshing}
                  aria-label={t('myCaches.refresh', 'Refresh saved caches')}
                  title={t('myCaches.refresh', 'Refresh saved caches')}
                >
                  <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('myCaches.description')}
          </p>
        </div>

        {/* Saved Caches Section */}
        <div className="flex justify-end mb-4">
          {savedCaches.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={8}
                avoidCollisions={true}
                collisionPadding={{ bottom: 80 }}
              >
                
                <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:text-red-700">
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('myCaches.clearAll')}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('myCaches.clearAllConfirm.title')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('myCaches.clearAllConfirm.description', { count: savedCaches.length })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('myCaches.clearAllConfirm.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAll} className="bg-red-600 hover:bg-red-700">
                        {t('myCaches.clearAllConfirm.confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isLoadingSaved && savedCaches.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <ComponentLoading
              size="sm"
              title={t('myCaches.loading.title')}
              description={t('myCaches.loading.description')}
            />
          </div>
        ) : savedCaches.length === 0 ? (
          <EmptyStateCard
            icon={Bookmark}
            title={t('myCaches.empty.title')}
            description={t('myCaches.empty.description')}
            action={
              <Link to="/map">
                <Button>
                  <MapPin className="h-4 w-4 mr-2" />
                  {t('myCaches.empty.viewMap')}
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {uniqueCaches.map((cache) => (
              <DetailedGeocacheCard
                key={cache.id}
                cache={cache}
                distance={cache.distance}
                metadata={
                  <>
                    • {t('myCaches.savedPrefix')} {formatDistanceToNow(new Date(cache.savedAt), { addSuffix: true })}
                  </>
                }
                actions={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      unsaveCache(cache.id);
                    }}
                    title={t('myCaches.removeFromSaved')}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
              />
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to="/map">
            <Button variant="outline">
              <MapPin className="h-4 w-4 mr-2" />
              {t('myCaches.browseMore')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
