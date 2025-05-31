import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MapPin, Navigation, Trophy, MessageSquare, Trash2, Cloud, Loader2, MoreVertical, Plus, Edit, Eye, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailedGeocacheCard } from '@/components/ui/geocache-card';
import { InfoCard, EmptyStateCard } from '@/components/ui/card-patterns';
import { DesktopHeader } from '@/components/DesktopHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LoginArea } from '@/components/auth/LoginArea';
import { useSavedCaches } from '@/hooks/useSavedCaches';
import { useUserGeocaches } from '@/hooks/useUserGeocaches';
import { useUserFoundCaches, type FoundCache } from '@/hooks/useUserFoundCaches';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDistanceToNow } from '@/lib/date';
import { formatDistance } from '@/lib/geo';
import { useGeolocation } from '@/hooks/useGeolocation';

export default function MyCaches() {
  const { user } = useCurrentUser();
  const { savedCaches, unsaveCache, clearAllSaved, isNostrEnabled, isLoading: isLoadingSaved } = useSavedCaches();
  const { data: userCaches, isLoading: isLoadingUserCaches } = useUserGeocaches();
  const { data: foundCaches, isLoading: isLoadingFoundCaches } = useUserFoundCaches();
  const { coords } = useGeolocation();
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Calculate distances if location is available
  const savedCachesWithDistance = savedCaches.map(cache => {
    let distance: number | undefined;
    if (coords) {
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

  const userCachesWithDistance = (userCaches || []).map(cache => {
    let distance: number | undefined;
    if (coords) {
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
    if (coords) {
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

  const handleClearAll = () => {
    clearAllSaved();
    setShowClearDialog(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-8">
          <InfoCard
            icon={Bookmark}
            title="Login Required"
            description="Please log in with your Nostr account to view your caches."
            action={<LoginArea />}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40">
      <DesktopHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bookmark className="h-6 w-6" />
              My Caches
            </h1>
            
            {/* Nostr sync status */}
            {isNostrEnabled && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Cloud className="h-4 w-4" />
                <span>Synced</span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600">
            Your caches are synced to your Nostr profile and available across all your devices.
          </p>
        </div>

        <Tabs defaultValue="saved" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="saved" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
              <Bookmark className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Saved</span>
              <span className="text-xs sm:text-sm">({savedCaches.length})</span>
            </TabsTrigger>
            <TabsTrigger value="found" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Found</span>
              <span className="text-xs sm:text-sm">({foundCaches?.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="created" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
              <Trophy className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Created</span>
              <span className="text-xs sm:text-sm">({userCaches?.length || 0})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Caches you've saved for later exploration
              </p>
              {savedCaches.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:text-red-700">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear All Saved Caches
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear all saved caches?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently remove all {savedCaches.length} saved caches from your list.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearAll} className="bg-red-600 hover:bg-red-700">
                            Clear All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {isLoadingSaved ? (
              <InfoCard
                icon={Loader2}
                title="Loading saved caches..."
                description="Fetching your bookmarks from Nostr relays"
                className="text-center py-12"
              />
            ) : savedCaches.length === 0 ? (
              <EmptyStateCard
                icon={Bookmark}
                title="No saved caches yet"
                description="Start exploring and save interesting caches for later!"
                action={
                  <Link to="/map">
                    <Button>
                      <MapPin className="h-4 w-4 mr-2" />
                      View Map
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
                        • saved {formatDistanceToNow(new Date(cache.savedAt), { addSuffix: true })}
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
                        title="Remove from saved caches"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="found" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Caches you've successfully found and logged
              </p>
            </div>

            {isLoadingFoundCaches ? (
              <InfoCard
                icon={Loader2}
                title="Loading found caches..."
                description="Fetching your geocaching achievements"
                className="text-center py-12"
              />
            ) : !foundCaches || foundCaches.length === 0 ? (
              <EmptyStateCard
                icon={CheckCircle}
                title="No finds yet"
                description="Start exploring and log your first find!"
                action={
                  <Link to="/map">
                    <Button>
                      <MapPin className="h-4 w-4 mr-2" />
                      View Map
                    </Button>
                  </Link>
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
                        • found {formatDistanceToNow(new Date(cache.foundAt * 1000), { addSuffix: true })}
                      </>
                    }
                    actions={
                      <Link to={`/cache/${cache.dTag}`}>
                        <Button variant="outline" size="icon" title="View cache">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="created" className="mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <p className="text-sm text-gray-600">
                Geocaches you've hidden for others to find
              </p>
              <Link to="/create" className="shrink-0">
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Hide New Cache</span>
                  <span className="sm:hidden">New Cache</span>
                </Button>
              </Link>
            </div>

            {isLoadingUserCaches ? (
              <InfoCard
                icon={Loader2}
                title="Loading your caches..."
                description="Fetching caches you've created"
                className="text-center py-12"
              />
            ) : !userCaches || userCaches.length === 0 ? (
              <EmptyStateCard
                icon={Trophy}
                title="No caches created yet"
                description="Start your geocaching journey by hiding your first treasure!"
                action={
                  <Link to="/create">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Hide Your First Cache
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-4">
                {userCachesWithDistance.map((cache) => (
                  <DetailedGeocacheCard
                    key={cache.id}
                    cache={cache}
                    distance={cache.distance}
                    metadata={
                      <>
                        Created {formatDistanceToNow(new Date(cache.created_at * 1000), { addSuffix: true })}
                      </>
                    }
                    showAuthor={false}
                    actions={
                      <Link to={`/cache/${cache.dTag}`}>
                        <Button variant="outline" size="icon" title="View cache">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center pb-8 sm:pb-4">
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