import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from 'zustand';
import { HintDisplay } from "@/components/ui/hint-display";
import { Navigation, Calendar, User, ExternalLink, Zap, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BaseDialog } from "@/components/ui/base-dialog";
import { DetailsCard, StatsCard } from "@/components/ui/card-patterns";
import { TabsContent } from "@/components/ui/tabs";
import { CacheDetailTabs } from "@/components/ui/mobile-button-patterns";
import { GeocacheMap } from "@/features/map/components/GeocacheMap";
import { useGeocacheLogs } from "../hooks/useGeocacheLogs";
import { useZapStore } from "@/shared/stores/useZapStore";
import { ZapButton } from "@/components/ZapButton";
import { useSavedCaches } from "../hooks/useSavedCaches";
import { useToast } from "@/shared/hooks/useToast";

import { useAuthor } from "@/features/auth/hooks/useAuthor";
import { LogsSection } from "@/features/logging/components/LogsSection";
import { formatDistanceToNow } from "@/shared/utils/date";
import { useNavigate } from "react-router-dom";
import { geocacheToNaddr } from "@/shared/utils/naddr";
import { getTypeLabel, getSizeLabel } from "../utils/geocache-utils";
import { DifficultyTerrainRating } from "@/components/ui/difficulty-terrain-rating";
import type { Geocache, GeocacheLog } from "@/shared/types";

interface GeocacheDialogProps {
  geocache: Geocache | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

import { ImageGallery } from "@/components/ImageGallery";
import { BlurredImage } from "@/components/BlurredImage";
import { ProfileDialog } from "@/components/ProfileDialog";

export function GeocacheDialog({ geocache, isOpen, onOpenChange }: GeocacheDialogProps) {
  // All hooks must be called before any conditional logic
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: logsData = {} } = useGeocacheLogs(
    geocache ? `${geocache.pubkey}:${geocache.dTag}` : '', 
    geocache?.dTag,
    geocache?.pubkey,
    geocache?.relays,
    geocache?.verificationPubkey,
    geocache?.kind || 37516
  );
  
  // Safely handle logs data
  const logs: GeocacheLog[] = Array.isArray(logsData) ? logsData : [];
  const author = useAuthor(geocache?.pubkey || "");
  const naddr = geocache ? geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind || 37516) : "";
  const zapStoreKey = naddr ? `naddr:${naddr}` : `event:${geocache?.id}`;
  
  // Use memoized zap totals from store for better performance
  const zapTotal = useStore(useZapStore, (state) => state.zapTotals[zapStoreKey] ?? 0);
  const totalSats = geocache?.zapTotal ?? zapTotal;
  const { isCacheSaved, toggleSaveCache, isNostrEnabled } = useSavedCaches();
  const { toast } = useToast();

  
  // Image gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  
  // Profile dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfilePubkey, setSelectedProfilePubkey] = useState<string | null>(null);

  // Early return after all hooks
  if (!geocache) return null;

  const authorName = author.data?.metadata?.name || geocache.pubkey.slice(0, 8);
  const profilePicture = author.data?.metadata?.picture;

  const handleViewFullDetails = () => {
    onOpenChange(false);
    navigate(`/${geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind || 37516)}?fromMap=true`);
  };

  const handleImageClick = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const handleProfileClick = (pubkey: string) => {
    setSelectedProfilePubkey(pubkey);
    setProfileDialogOpen(true);
  };

  const handleSaveToggle = async () => {
    if (!geocache) return;

    if (!isNostrEnabled) {
      toast({
        title: t('geocacheDialog.toast.loginRequired.title'),
        description: t('geocacheDialog.toast.loginRequired.description'),
        variant: 'destructive',
      });
      return;
    }

    const isSaved = isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey);

    try {
      await toggleSaveCache(geocache);
      
      toast({
        title: isSaved ? t('geocacheDialog.toast.removed.title') : t('geocacheDialog.toast.saved.title'),
        description: isSaved 
          ? t('geocacheDialog.toast.removed.description', { name: geocache.name })
          : t('geocacheDialog.toast.saved.description', { name: geocache.name }),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('geocacheDialog.toast.error.description');
      toast({
        title: t('geocacheDialog.toast.error.title'),
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <BaseDialog 
        isOpen={isOpen} 
        onOpenChange={onOpenChange}
        size="xl"
        className="max-h-[90vh] overflow-y-auto"
        title={geocache.name}
      >
        {/* Author and date info below title */}
        <div className="text-gray-600 dark:text-gray-400 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm mb-2 -mt-2">
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {t('cacheDetail.author.hiddenBy')}{' '}
            <button
              onClick={() => handleProfileClick(geocache.pubkey)}
              className="hover:underline cursor-pointer"
            >
              {authorName}
            </button>
            {profilePicture && (
              <img 
                src={profilePicture} 
                alt={authorName}
                className="h-4 w-4 rounded-full object-cover"
              />
            )}
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDistanceToNow(new Date(geocache.created_at * 1000), { addSuffix: true })}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              {totalSats.toLocaleString()} sats
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Cache Details */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline">D{geocache.difficulty}</Badge>
                <Badge variant="outline">T{geocache.terrain}</Badge>
                <Badge variant="secondary">{getSizeLabel(geocache.size)}</Badge>
                <Badge variant="secondary">{getTypeLabel(geocache.type)}</Badge>
              </div>
              
              <div className="prose max-w-none">
                <p className="text-foreground whitespace-pre-wrap text-sm">{geocache.description}</p>
                
                {geocache.hint && (
                  <HintDisplay hint={geocache.hint} className="mt-3" />
                )}
              </div>

              {geocache.images && geocache.images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {geocache.images.slice(0, 4).map((url, index) => (
                    <BlurredImage
                      key={index}
                      src={url}
                      alt={`Cache image ${index + 1}`}
                      className="rounded w-full h-24"
                      onClick={() => handleImageClick(index)}
                      blurIntensity="medium"
                      defaultBlurred={true}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <CacheDetailTabs logCount={logs.length}>
              <TabsContent value="logs" className="space-y-4 max-h-96 lg:max-h-[26rem] overflow-y-auto border rounded-md p-2">
                <LogsSection 
                  logs={logs}
                  geocache={geocache}
                  onProfileClick={handleProfileClick}
                  compact
                  hideForm
                />
              </TabsContent>
              
              <TabsContent value="map">
                <div className="h-64 rounded-lg overflow-hidden">
                  <GeocacheMap 
                    geocaches={[geocache]} 
                    center={geocache.location}
                    zoom={15}
                  />
                </div>
              </TabsContent>
            </CacheDetailTabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:-mt-4">
            {/* Cache Details Card */}
            <DetailsCard title={t('cacheDetail.details.title')}>
              <DifficultyTerrainRating 
                difficulty={geocache.difficulty}
                terrain={geocache.terrain}
                cacheSize={geocache.size}
                
              />
              
              <div>
                <p className="text-xs font-medium text-gray-600">{t('cacheDetail.details.coordinates')}</p>
                <p className="text-xs font-mono mt-1">
                  {geocache.location.lat.toFixed(6)}, {geocache.location.lng.toFixed(6)}
                </p>
              </div>
            </DetailsCard>

            {/* Statistics Card */}
            <StatsCard
              title={t('cacheDetail.stats.title')}
              stats={[
                {
                  label: t('cacheDetail.stats.totalFinds'),
                  value: logs.filter(log => log.type === "found").length
                },
                {
                  label: t('cacheDetail.stats.dnfs'),
                  value: logs.filter(log => log.type === "dnf").length
                },
                {
                  label: t('cacheDetail.stats.totalLogs'),
                  value: logs.length
                }
              ]}
            />

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                size="sm"
                className="w-full"
                onClick={handleViewFullDetails}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('geocacheDialog.actions.viewFullDetails')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.open(
                    `https://www.openstreetmap.org/directions?from=&to=${geocache.location.lat}%2C${geocache.location.lng}#map=15/${geocache.location.lat}/${geocache.location.lng}`,
                    "_blank"
                  );
                }}
              >
                <Navigation className="h-4 w-4 mr-2" />
                {t('cacheDetail.details.getDirections')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleSaveToggle}
              >
                {isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey) ? (
                  <>
                    <BookmarkCheck className="h-4 w-4 mr-2" />
                    {t('geocacheDialog.actions.removeFromSaved')}
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4 mr-2" />
                    {t('geocacheDialog.actions.saveForLater')}
                  </>
                )}
              </Button>
              <ZapButton
                target={geocache}
                className="w-full"
              >
                {t('geocacheDialog.actions.support')}
              </ZapButton>
            </div>
          </div>
        </div>
      </BaseDialog>
      
      {/* Image Gallery */}
      {geocache.images && (
        <ImageGallery
          images={geocache.images}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          initialIndex={galleryIndex}
        />
      )}
      
      {/* Profile Dialog */}
      <ProfileDialog
        pubkey={selectedProfilePubkey}
        isOpen={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
      />

    </>
  );
}