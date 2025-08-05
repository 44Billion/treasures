import { MapPin, User, MessageSquare } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { BaseDialog } from "@/shared/components/ui/base-dialog";
import { EmptyStateCard } from "@/shared/components/ui/card-patterns";
import { TabsContent } from "@/shared/components/ui/tabs";
import { useAuthor } from "@/features/auth/hooks/useAuthor";
import { useGeocaches } from "@/features/geocache/hooks/useGeocaches";
import { useUserFoundCaches } from "../hooks/useUserFoundCaches";
import { ProfileHeader } from "./ProfileHeader";
import { MobileTabs } from "@/shared/components/ui/mobile-button-patterns";
import { useNavigate } from "react-router-dom";
import { geocacheToNaddr } from "@/shared/utils/naddr";
import { GeocacheCard } from "@/features/geocache/components/geocache-card";
import type { ProfileDialogProps } from "../types";

export function ProfileDialog({ pubkey, isOpen, onOpenChange }: ProfileDialogProps) {
  const navigate = useNavigate();
  const author = useAuthor(pubkey || "");
  const { data: geocachesData = [], isStatsLoading } = useGeocaches();
  const geocaches = Array.isArray(geocachesData) ? geocachesData : [];
  const { data: foundCaches = [] } = useUserFoundCaches(pubkey || "");
  
  // Early return after all hooks
  if (!pubkey) return null;

  const metadata = author.data?.metadata;
  const displayName = metadata?.display_name || metadata?.name || pubkey.slice(0, 8);

  const createdAt = author.data?.event?.created_at;

  // Filter geocaches created by this user
  const userGeocaches = geocaches.filter(cache => 
    cache && 
    cache.pubkey === pubkey && 
    cache.id && 
    cache.dTag && 
    cache.name
  );

  const handleViewFullProfile = () => {
    onOpenChange(false);
    navigate(`/profile/${pubkey}`);
  };

  return (
    <BaseDialog 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      size="xl"
      className="max-h-[90vh] overflow-y-auto"
      title={displayName}
    >
      {/* Profile header */}
      <ProfileHeader
        pubkey={pubkey}
        metadata={metadata}
        createdAt={createdAt}
        hiddenCount={userGeocaches.length}
        foundCount={foundCaches.length}
        variant="dialog"
        className="-mt-2"
        showExtendedDetails={true}
      >
        {/* View Full Profile button in header */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleViewFullProfile}
          className="h-8"
        >
          <User className="h-4 w-4 mr-2" />
          View Full Profile
        </Button>
      </ProfileHeader>

      <div className="space-y-4">
          {/* Tabs */}
          <MobileTabs
            items={[
              {
                value: "caches",
                label: "Geocaches",
                icon: MapPin,
                count: userGeocaches.length
              },
              {
                value: "activity", 
                label: "Activity",
                icon: MessageSquare
              }
            ]}
            defaultValue="caches"
          >
            
            <TabsContent value="caches" className="space-y-3 max-h-80 overflow-y-auto">
              {userGeocaches.length > 0 ? (
                <div className="space-y-2">
                  {userGeocaches.slice(0, 10).map((geocache) => {
                    if (!geocache || !geocache.id || !geocache.dTag) {
                      return null;
                    }
                    return (
                      <GeocacheCard 
                        key={geocache.id} 
                        cache={geocache}
                        variant="compact"
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/${geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind)}`);
                        }}
                        statsLoading={isStatsLoading}
                      />
                    );
                  })}
                  {userGeocaches.length > 10 && (
                    <p className="text-xs text-gray-500 text-center py-2">
                      And {userGeocaches.length - 10} more...
                    </p>
                  )}
                </div>
              ) : (
                <EmptyStateCard
                  icon={MapPin}
                  title="No geocaches yet"
                  description="This user hasn't created any geocaches"
                />
              )}
            </TabsContent>
            
            <TabsContent value="activity" className="space-y-3 max-h-80 overflow-y-auto">
              <EmptyStateCard
                icon={MessageSquare}
                title="Activity coming soon"
                description="Recent logs and activity will be shown here"
              />
            </TabsContent>
          </MobileTabs>
        </div>
    </BaseDialog>
  );
}