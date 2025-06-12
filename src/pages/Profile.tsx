import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  CheckCircle,
  Edit,
  Bookmark
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyStateCard } from '@/components/ui/card-patterns';
import { DesktopHeader } from '@/components/DesktopHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FullPageLoading, ComponentLoading } from '@/components/ui/loading';

import { LoginRequiredCard } from '@/components/LoginRequiredCard';
import { DetailedGeocacheCard } from '@/components/ui/geocache-card';
import { EditProfileForm } from '@/features/profile/components/EditProfileForm';
import { ProfileHeader } from '@/features/profile/components/ProfileHeader';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { useUserGeocaches } from '@/features/geocache/hooks/useUserGeocaches';
import { useUserFoundCaches } from '@/features/profile/hooks/useUserFoundCaches';
import { useSavedCaches } from '@/features/geocache/hooks/useSavedCaches';
import { useNip05Status } from '@/features/profile/hooks/useNip05Verification';
import { formatDistanceToNow } from '@/shared/utils/date';
import { useGeolocation } from '@/features/map/hooks/useGeolocation';
import { useToast } from '@/shared/hooks/useToast';

export default function Profile() {
  const { pubkey } = useParams<{ pubkey: string }>();
  const { user: currentUser } = useCurrentUser();
  const { coords } = useGeolocation();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Use current user's pubkey if no pubkey in URL
  const targetPubkey = pubkey || currentUser?.pubkey;
  const isOwnProfile = targetPubkey === currentUser?.pubkey;

  const { data: authorData, isLoading: isLoadingAuthor } = useAuthor(targetPubkey);
  const { data: userCaches, isLoading: isLoadingUserCaches } = useUserGeocaches(targetPubkey);
  const { data: foundCaches, isLoading: isLoadingFoundCaches } = useUserFoundCaches(targetPubkey);
  const { savedCaches, isLoading: isLoadingSavedCaches } = useSavedCaches();
  const { 
    isVerified, 
    isLoading: isLoadingNip05, 
    error: nip05Error 
  } = useNip05Status(authorData?.metadata?.nip05, targetPubkey);

  const metadata = authorData?.metadata;

  // Calculate distances if location is available
  const userCachesWithDistance = (userCaches || []).map(cache => {
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
        title: 'Copied!',
        description: `${field} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  if (!targetPubkey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-green-950/40 dark:via-emerald-950/30 dark:to-teal-950/20 adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70 max-md:h-mobile-fit max-md:overflow-hidden relative">
        {/* Parchment background for adventure mode only - behind everything */}
        <div className="absolute inset-0 -z-20 hidden adventure:block" style={{
          backgroundImage: 'url(/parchment-300.jpg)',
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          opacity: 0.25
        }}></div>
        
        <DesktopHeader />
        <div className="container mx-auto px-4 py-8 max-md:h-mobile-content max-md:flex max-md:items-center max-md:justify-center">
          <LoginRequiredCard
            icon={User}
            description="Please log in with your Nostr account to view your profile."
          />
        </div>
      </div>
    );
  }

  // Only show loading when we have no author data to display (optimization for instant pages)
  if (isLoadingAuthor && !authorData) {
    return (
      <FullPageLoading
        title="Loading profile..."
        description="Fetching user information from Nostr relays"
      />
    );
  }

  const displayName = metadata?.name || metadata?.display_name || targetPubkey.slice(0, 8) + '...';
  const shortPubkey = targetPubkey.slice(0, 8) + '...' + targetPubkey.slice(-8);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-green-950/40 dark:via-emerald-950/30 dark:to-teal-950/20 adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70 relative">
      {/* Parchment background for adventure mode only - behind everything */}
      <div className="absolute inset-0 -z-20 hidden adventure:block" style={{
        backgroundImage: 'url(/parchment-300.jpg)',
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        opacity: 0.25
      }}></div>
      
      <DesktopHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <ProfileHeader
              pubkey={targetPubkey}
              metadata={metadata}
              createdAt={authorData?.event?.created_at}
              hiddenCount={userCaches?.length || 0}
              foundCount={foundCaches?.length || 0}
              savedCount={isOwnProfile ? savedCaches?.length || 0 : undefined}
              variant="page"
              onCopy={copyToClipboard}
              showExtendedDetails={true}
            >
              {/* Edit Button - Opens modal */}
              {isOwnProfile && (
                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 sm:w-auto sm:h-auto p-0 sm:px-3 sm:py-2">
                      <Edit className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Edit Profile</DialogTitle>
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
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Created</span>
              <span className="text-xs sm:text-sm">({userCaches?.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="found" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Found</span>
              <span className="text-xs sm:text-sm">({foundCaches?.length || 0})</span>
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="saved" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
                <Bookmark className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm">Saved</span>
                <span className="text-xs sm:text-sm">({savedCaches?.length || 0})</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="created" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {isOwnProfile ? 'Geocaches you\'ve hidden for others to find' : `Geocaches hidden by ${displayName}`}
              </p>
            </div>

            {isLoadingUserCaches ? (
              <div className="flex items-center justify-center py-12">
                <ComponentLoading size="sm" title="Loading caches..." description="Fetching created caches" />
              </div>
            ) : !userCaches || userCaches.length === 0 ? (
              <EmptyStateCard
                icon={MapPin}
                title={isOwnProfile ? "No caches created yet" : "No caches found"}
                description={isOwnProfile ? "Start your geocaching journey by hiding your first treasure!" : `${displayName} hasn't created any caches yet.`}
                action={
                  isOwnProfile ? (
                    <Link to="/create">
                      <Button>
                        <MapPin className="h-4 w-4 mr-2" />
                        Hide Your First Cache
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                {userCachesWithDistance
                  .filter(cache => cache.id && cache.dTag && cache.pubkey && cache.name && cache.location)
                  .map((cache) => (
                    <DetailedGeocacheCard
                      key={cache.id}
                      cache={cache}
                      distance={cache.distance}
                      metadata={
                        <>
                          Created {formatDistanceToNow(new Date((cache.created_at || 0) * 1000), { addSuffix: true })}
                        </>
                      }
                      showAuthor={!isOwnProfile}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="found" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {isOwnProfile ? 'Caches you\'ve successfully found and logged' : `Caches found by ${displayName}`}
              </p>
            </div>

            {isLoadingFoundCaches ? (
              <div className="flex items-center justify-center py-12">
                <ComponentLoading size="sm" title="Loading found caches..." description="Fetching geocaching achievements" />
              </div>
            ) : !foundCaches || foundCaches.length === 0 ? (
              <EmptyStateCard
                icon={CheckCircle}
                title={isOwnProfile ? "No finds yet" : "No finds found"}
                description={isOwnProfile ? "Start exploring and log your first find!" : `${displayName} hasn't logged any finds yet.`}
                action={
                  isOwnProfile ? (
                    <Link to="/map">
                      <Button>
                        <MapPin className="h-4 w-4 mr-2" />
                        View Map
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                {foundCachesWithDistance.map((cache) => (
                  <DetailedGeocacheCard
                    key={cache.logId}
                    cache={cache}
                    distance={cache.distance}
                    metadata={
                      <>
                        Found {formatDistanceToNow(new Date(cache.foundAt * 1000), { addSuffix: true })}
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="saved" className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Caches you've saved for later exploration
                </p>
              </div>

              {isLoadingSavedCaches ? (
                <div className="flex items-center justify-center py-12">
                  <ComponentLoading size="sm" title="Loading saved caches..." description="Fetching your bookmarked caches" />
                </div>
              ) : !savedCaches || savedCaches.length === 0 ? (
                <EmptyStateCard
                  icon={Bookmark}
                  title="No saved caches yet"
                  description="Save interesting caches to find them easily later!"
                  action={
                    <Link to="/map">
                      <Button>
                        <MapPin className="h-4 w-4 mr-2" />
                        Explore Caches
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {savedCachesWithDistance.map((cache) => (
                    <DetailedGeocacheCard
                      key={cache.id}
                      cache={cache}
                      distance={cache.distance}
                      metadata={
                        <>
                          Saved {formatDistanceToNow(new Date(cache.savedAt), { addSuffix: true })}
                        </>
                      }
                      showAuthor={true}
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
              Browse More Caches
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}