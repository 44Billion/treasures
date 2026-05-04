import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  MapPin,
  CheckCircle,
  Edit,
  Bookmark
} from 'lucide-react';
import { Chest } from '@/config/cacheIconConstants';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/card-patterns';
import { DesktopHeader } from '@/components/DesktopHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FullPageLoading, ComponentLoading } from '@/components/ui/loading';

import { LoginRequiredCard } from '@/components/LoginRequiredCard';
import { GeocacheCard } from '@/components/ui/geocache-card';
import { GeocachePopupCard } from '@/components/GeocachePopupCard';
import { EditProfileForm } from '@/components/EditProfileForm';
import { ProfileHeader } from '@/components/ProfileHeader';
import { HeroBackground } from '@/components/HeroBackground';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTheme } from '@/hooks/useTheme';

import { useAuthor } from '@/hooks/useAuthor';
import { useUserGeocaches } from '@/hooks/useUserGeocaches';
import { useUserFoundCaches } from '@/hooks/useUserFoundCaches';
import { useSavedCaches } from '@/hooks/useSavedCaches';
import { useGeocaches } from '@/hooks/useGeocaches';


import { useGeolocation } from '@/hooks/useGeolocation';
import { useMyFoundCaches } from '@/hooks/useMyFoundCaches';
import { ProfileMap } from '@/components/ProfileMap';
import { useToast } from '@/hooks/useToast';
import { useTreasureDrafts, draftToGeocache } from '@/hooks/useTreasureDrafts';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import type { Geocache } from '@/types/geocache';

export default function Profile() {
  const { t } = useTranslation();
  const { pubkey } = useParams<{ pubkey: string }>();
  const { user: currentUser } = useCurrentUser();
  const { resolvedTheme } = useTheme();
  const isDitto = resolvedTheme === 'ditto';
  const { coords } = useGeolocation();
  const { toast } = useToast();
  const myFoundCaches = useMyFoundCaches();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [_copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedPopupGeocache, setSelectedPopupGeocache] = useState<Geocache | null>(null);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
  const [deletingDraft, setDeletingDraft] = useState<{ dTag: string; name: string; eventId: string } | null>(null);
  const [optimisticallyDeleted, setOptimisticallyDeleted] = useState<Set<string>>(new Set());

  // Handler for marker clicks from the profile map (React popup portal)
  const handleMarkerClick = (geocache: Geocache, container?: HTMLDivElement) => {
    if (!geocache && !container) {
      // Popup closed
      setSelectedPopupGeocache(null);
      setPopupContainer(null);
      return;
    }
    setSelectedPopupGeocache(geocache);
    setPopupContainer(container || null);
  };

  // Use current user's pubkey if no pubkey in URL
  const targetPubkey = pubkey || currentUser?.pubkey;
  const isOwnProfile = targetPubkey === currentUser?.pubkey;

  const { data: authorData, isLoading: isLoadingAuthor } = useAuthor(targetPubkey);
  const { data: userCaches, isLoading: isLoadingUserCaches } = useUserGeocaches(targetPubkey);
  const { savedCaches, isLoading: isLoadingSavedCaches } = useSavedCaches();

  // NIP-37 encrypted drafts — only queried on own profile
  const { relayDrafts, deleteDraft } = useTreasureDrafts();
  const draftGeocaches: Geocache[] = isOwnProfile && currentUser
    ? (relayDrafts.data || []).map(d => draftToGeocache(d, currentUser.pubkey))
    : [];

  // Use the same stats query/store system as index/map page for created caches
  const { data: allGeocaches, isStatsLoading } = useGeocaches();

  // Now use the allGeocaches data for found caches
  const { data: foundCaches, isLoading: isLoadingFoundCaches } = useUserFoundCaches(targetPubkey, allGeocaches);


  const metadata = authorData?.metadata;

  // Merge published caches with drafts (drafts first, then published, all sorted by date)
  // Filter out optimistically deleted drafts
  const userGeocachesWithStats = [
    ...draftGeocaches.filter(d => !optimisticallyDeleted.has(d.dTag)),
    ...(userCaches || []),
  ].sort((a, b) => b.created_at - a.created_at);

  // Calculate distances if location is available
  const userCachesWithDistance = (userGeocachesWithStats || []).map(cache => {
    let distance: number | undefined;
    if (coords && cache.location) {
      const R = 6371; // Earth's radius in kilometers
      const dLat = (cache.location.lat - coords.latitude) * Math.PI / 180;
      const dLon = (cache.location.lng - coords.longitude) * Math.PI / 180;
      const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(coords.latitude * Math.PI / 180) * Math.cos(cache.location.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distance = R * c * 1000; // Convert to meters
    }
    return { ...cache, distance };
  });

  const foundCachesWithDistance = (foundCaches || []).map(cache => {
    let distance: number | undefined;
    if (coords && cache.location) {
      const R = 6371; // Earth's radius in kilometers
      const dLat = (cache.location.lat - coords.latitude) * Math.PI / 180;
      const dLon = (cache.location.lng - coords.longitude) * Math.PI / 180;
      const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(coords.latitude * Math.PI / 180) * Math.cos(cache.location.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distance = R * c * 1000; // Convert to meters
    }
    return { ...cache, distance };
  });

  const savedCachesWithDistance = (savedCaches || []).map(cache => {
    let distance: number | undefined;
    if (coords && cache.location) {
      const R = 6371; // Earth's radius in kilometers
      const dLat = (cache.location.lat - coords.latitude) * Math.PI / 180;
      const dLon = (cache.location.lng - coords.longitude) * Math.PI / 180;
      const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(coords.latitude * Math.PI / 180) * Math.cos(cache.location.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distance = R * c * 1000; // Convert to meters
    }
    return { ...cache, distance };
  });

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: t('profile.clipboard.copied'),
        description: t('profile.clipboard.copiedDescription', { field }),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('profile.clipboard.error'),
        variant: 'destructive',
      });
    }
  };

  if (!targetPubkey) {
    return (
      <div className={`min-h-screen max-md:h-mobile-fit max-md:overflow-hidden relative ${isDitto ? '' : 'bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-background dark:via-primary-50 dark:to-background adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70'}`}>
        {isDitto && <HeroBackground />}
        {/* Parchment background for adventure mode only - behind everything */}
        <div className="absolute inset-0 -z-20 hidden adventure:block" style={{
          backgroundImage: 'url(/parchment-300.jpg)',
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          opacity: 0.25
        }}></div>

        <div className={isDitto ? 'relative z-10' : ''}>
          <DesktopHeader />
          <div className="container mx-auto px-4 py-8 max-md:h-mobile-content max-md:flex max-md:items-center max-md:justify-center">
            <LoginRequiredCard
              icon={User}
              description={t('profile.loginRequired')}
            />
          </div>
        </div>
      </div>
    );
  }

  // Only show loading when we have no author data to display (optimization for instant pages)
  if (isLoadingAuthor && !authorData) {
    return (
      <FullPageLoading
        title={t('profile.loadingTitle')}
        description={t('profile.loadingDescription')}
      />
    );
  }

  const displayName = metadata?.name || metadata?.display_name || targetPubkey.slice(0, 8) + '...';

  return (
    <div className={`min-h-screen relative ${isDitto ? '' : 'bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-background dark:via-primary-50 dark:to-background adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70'}`}>
      {isDitto && <HeroBackground />}
      {/* Parchment background for adventure mode only - behind everything */}
      <div className="absolute inset-0 -z-20 hidden adventure:block" style={{
        backgroundImage: 'url(/parchment-300.jpg)',
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        opacity: 0.25
      }}></div>

      <div className={isDitto ? 'relative z-10' : ''}>
      <DesktopHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <ProfileHeader
              pubkey={targetPubkey}
              metadata={metadata}

              hiddenCount={isLoadingUserCaches ? undefined : (userGeocachesWithStats?.length || 0)}
              foundCount={isLoadingFoundCaches ? undefined : (foundCaches?.length || 0)}
              savedCount={isOwnProfile ? (isLoadingSavedCaches ? undefined : (savedCaches?.length || 0)) : undefined}
              variant="page"
              onCopy={copyToClipboard}
              showExtendedDetails={true}
            >
              {/* Edit Button - Opens modal */}
              {isOwnProfile && (
                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 min-w-11 p-0 sm:px-3 sm:py-2 sm:min-w-0"
                      aria-label={t('common.edit')}
                    >
                      <Edit className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                      <span className="hidden sm:inline">{t('common.edit')}</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{t('profile.editProfile')}</DialogTitle>
                    </DialogHeader>
                    <EditProfileForm onSuccess={() => setIsEditModalOpen(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </ProfileHeader>
          </CardContent>
        </Card>

        {/* Cache Tabs */}
        <Tabs defaultValue="created" className="w-full">
          <TabsList className={`grid w-full h-auto ${isOwnProfile ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="created" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
              <Chest className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{t('profile.tabs.created')}</span>
              <span className="text-xs sm:text-sm">({userGeocachesWithStats?.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="found" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{t('profile.tabs.found')}</span>
              <span className="text-xs sm:text-sm">({foundCaches?.length || 0})</span>
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="saved" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
                <Bookmark className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm">{t('profile.tabs.saved')}</span>
                <span className="text-xs sm:text-sm">({savedCaches?.length || 0})</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="created" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {isOwnProfile ? t('profile.created.descriptionOwn') : t('profile.created.descriptionOther', { name: displayName })}
              </p>
            </div>

            {/* Profile Map - shows user's hidden geocaches */}
            {!isLoadingUserCaches && userGeocachesWithStats && userGeocachesWithStats.length > 0 && (
              <div className="mb-6">
                <ProfileMap
                  geocaches={userGeocachesWithStats}
                  onMarkerClick={handleMarkerClick}
                />
              </div>
            )}

            {isLoadingUserCaches ? (
              <div className="flex items-center justify-center py-12">
                <ComponentLoading size="sm" title={t('profile.created.loadingTitle')} description={t('profile.created.loadingDescription')} />
              </div>
            ) : !userGeocachesWithStats || userGeocachesWithStats.length === 0 ? (
              <EmptyStateCard
                icon={Chest}
                title={isOwnProfile ? t('profile.created.emptyTitleOwn') : t('profile.created.emptyTitleOther')}
                description={isOwnProfile ? t('profile.created.emptyDescriptionOwn') : t('profile.created.emptyDescriptionOther', { name: displayName })}
                action={
                  isOwnProfile ? (
                    <Link to="/create">
                      <Button>
                        <Chest className="h-4 w-4 mr-2" />
                        {t('profile.created.actionButton')}
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {userCachesWithDistance
                  .filter(cache => cache.id && cache.dTag && cache.pubkey && cache.name && cache.location)
                  .map((cache, index) => (
                    <GeocacheCard
                      key={`${cache.id}-${index}`}
                      cache={cache}
                      distance={cache.distance}
                      variant="featured"
                      statsLoading={isStatsLoading}
                      isFound={myFoundCaches.has(`${cache.kind || 37516}:${cache.pubkey}:${cache.dTag}`)}
                      onDelete={cache.kind === NIP_GC_KINDS.DRAFT ? () => {
                        setDeletingDraft({ dTag: cache.dTag, name: cache.name, eventId: cache.id });
                      } : undefined}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="found" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {isOwnProfile ? t('profile.found.descriptionOwn') : t('profile.found.descriptionOther', { name: displayName })}
              </p>
            </div>

            {isLoadingFoundCaches ? (
              <div className="flex items-center justify-center py-12">
                <ComponentLoading size="sm" title={t('profile.found.loadingTitle')} description={t('profile.found.loadingDescription')} />
              </div>
            ) : !foundCaches || foundCaches.length === 0 ? (
              <EmptyStateCard
                icon={CheckCircle}
                title={isOwnProfile ? t('profile.found.emptyTitleOwn') : t('profile.found.emptyTitleOther')}
                description={isOwnProfile ? t('profile.found.emptyDescriptionOwn') : t('profile.found.emptyDescriptionOther', { name: displayName })}
                action={
                  isOwnProfile ? (
                    <Link to="/map">
                      <Button>
                        <MapPin className="h-4 w-4 mr-2" />
                        {t('profile.found.actionButton')}
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {foundCachesWithDistance
                  .filter(cache => cache.id && cache.dTag && cache.pubkey && cache.name && cache.location)
                  .map((cache, index) => (
                  <GeocacheCard
                    key={`${cache.id}-${index}`}
                    cache={cache}
                    distance={cache.distance}
                    variant="featured"
                    statsLoading={isStatsLoading}
                    isFound={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="saved" className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {t('profile.saved.description')}
                </p>
              </div>

              {isLoadingSavedCaches ? (
                <div className="flex items-center justify-center py-12">
                  <ComponentLoading size="sm" title={t('profile.saved.loadingTitle')} description={t('profile.saved.loadingDescription')} />
                </div>
              ) : !savedCaches || savedCaches.length === 0 ? (
                <EmptyStateCard
                  icon={Bookmark}
                  title={t('profile.saved.emptyTitle')}
                  description={t('profile.saved.emptyDescription')}
                  action={
                    <Link to="/map">
                      <Button>
                        <MapPin className="h-4 w-4 mr-2" />
                        {t('profile.saved.actionButton')}
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {savedCachesWithDistance
                    .filter(cache => cache.id && cache.dTag && cache.pubkey && cache.name && cache.location)
                    .map((cache, index) => (
                    <GeocacheCard
                      key={`${cache.id}-${index}`}
                      cache={cache}
                      distance={cache.distance}
                      variant="featured"
                      isFound={myFoundCaches.has(`${(cache as Record<string, unknown>).kind || 37516}:${cache.pubkey}:${cache.dTag}`)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        <div className="mt-8 text-center">
          <Link to="/map">
            <Button variant="outline">
              <MapPin className="h-4 w-4 mr-2" />
              {t('profile.browseMore')}
            </Button>
          </Link>
        </div>
      </div>
      </div>

      {/* React portal into Leaflet popup - same system as main map */}
      {selectedPopupGeocache && popupContainer && createPortal(
        <GeocachePopupCard
          geocache={selectedPopupGeocache}
          compact
          onClose={() => {
            setSelectedPopupGeocache(null);
            setPopupContainer(null);
          }}
        />,
        popupContainer
      )}

      {/* Delete draft confirmation */}
      <AlertDialog open={!!deletingDraft} onOpenChange={(open) => { if (!open) setDeletingDraft(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.draft.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.draft.deleteDescription', { name: deletingDraft?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deletingDraft) return;
                const { dTag, name, eventId } = deletingDraft;
                // Optimistic removal
                setOptimisticallyDeleted(prev => new Set(prev).add(dTag));
                setDeletingDraft(null);
                // Fire relay deletion
                deleteDraft.mutate({ slug: dTag, eventId }, {
                  onError: () => {
                    // Rollback on failure
                    setOptimisticallyDeleted(prev => {
                      const next = new Set(prev);
                      next.delete(dTag);
                      return next;
                    });
                    toast({
                      title: t('profile.draft.deleteFailed'),
                      description: t('profile.draft.deleteFailedDescription'),
                      variant: "destructive",
                    });
                  },
                  onSuccess: () => {
                    toast({
                      title: t('profile.draft.deleted'),
                      description: t('profile.draft.deletedDescription', { name }),
                    });
                  },
                });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
