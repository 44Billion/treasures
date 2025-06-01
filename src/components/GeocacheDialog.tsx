import { useState } from "react";
import { HintDisplay } from "@/components/ui/hint-display";
import { MapPin, Navigation, Calendar, User, Trophy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BaseDialog } from "@/components/ui/base-dialog";
import { DetailsCard, StatsCard, InteractiveCard } from "@/components/ui/card-patterns";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CacheDetailTabs } from "@/components/ui/mobile-button-patterns";
import { GeocacheMap } from "@/components/GeocacheMap";
import { useGeocacheLogs } from "@/hooks/useGeocacheLogs";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { LogsSection } from "@/components/LogsSection";
import { formatDistanceToNow } from "@/lib/date";
import { useNavigate } from "react-router-dom";
import { geocacheToNaddr } from "@/lib/naddr-utils";
import { getDifficultyLabel, getTypeLabel, getSizeLabel } from "@/lib/geocache-utils";
import { DifficultyTerrainRating } from "@/components/ui/difficulty-terrain-rating";
import type { Geocache } from "@/types/geocache";

interface GeocacheDialogProps {
  geocache: Geocache | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

import { ImageGallery } from "@/components/ImageGallery";
import { ProfileDialog } from "@/components/ProfileDialog";

export function GeocacheDialog({ geocache, isOpen, onOpenChange }: GeocacheDialogProps) {
  // All hooks must be called before any conditional logic
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: logs = [], refetch: refetchLogs } = useGeocacheLogs(
    geocache ? `${geocache.pubkey}:${geocache.dTag}` : '', 
    geocache?.dTag,
    geocache?.pubkey
  );
  const author = useAuthor(geocache?.pubkey || "");
  
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
    navigate(`/${geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays)}`);
  };

  const handleImageClick = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const handleProfileClick = (pubkey: string) => {
    setSelectedProfilePubkey(pubkey);
    setProfileDialogOpen(true);
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
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-6 -mt-2">
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            Hidden by{' '}
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
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDistanceToNow(new Date(geocache.created_at * 1000), { addSuffix: true })}
          </span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
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
                <p className="whitespace-pre-wrap text-sm">{geocache.description}</p>
                
                {geocache.hint && (
                  <HintDisplay hint={geocache.hint} className="mt-3" />
                )}
              </div>

              {geocache.images && geocache.images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {geocache.images.slice(0, 4).map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Cache image ${index + 1}`}
                      className="rounded w-full h-24 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => handleImageClick(index)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <CacheDetailTabs logCount={logs?.length || 0}>
              <TabsContent value="logs" className="space-y-4 max-h-60 overflow-y-auto">
                <LogsSection 
                  logs={logs}
                  geocache={geocache}
                  onProfileClick={handleProfileClick}
                  compact
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
          <div className="space-y-4">
            {/* Cache Details Card */}
            <DetailsCard title="Cache Details">
              <DifficultyTerrainRating 
                difficulty={geocache.difficulty}
                terrain={geocache.terrain}
                cacheSize={geocache.size}
                
              />
              
              <div>
                <p className="text-xs font-medium text-gray-600">Coordinates</p>
                <p className="text-xs font-mono mt-1">
                  {geocache.location.lat.toFixed(6)}, {geocache.location.lng.toFixed(6)}
                </p>
              </div>
            </DetailsCard>

            {/* Statistics Card */}
            <StatsCard
              title="Statistics"
              stats={[
                {
                  label: "Total Finds",
                  value: logs?.filter(log => log.type === "found").length || 0
                },
                {
                  label: "DNFs",
                  value: logs?.filter(log => log.type === "dnf").length || 0
                },
                {
                  label: "Total Logs",
                  value: logs?.length || 0
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
                View Full Details
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
                Get Directions
              </Button>
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