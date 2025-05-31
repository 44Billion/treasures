import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MapPin, Trash2, Cloud, Loader2, MoreVertical } from 'lucide-react';
import { DetailedGeocacheCard } from '@/components/ui/geocache-card';
import { InfoCard, EmptyStateCard } from '@/components/ui/card-patterns';
import { DesktopHeader } from '@/components/DesktopHeader';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LoginRequiredCard } from '@/components/LoginRequiredCard';
import { useSavedCaches } from '@/hooks/useSavedCaches';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDistanceToNow } from '@/lib/date';
import { useGeolocation } from '@/hooks/useGeolocation';

export default function MyCaches() {
  const { user } = useCurrentUser();
  const { savedCaches, unsaveCache, clearAllSaved, isNostrEnabled, isLoading: isLoadingSaved } = useSavedCaches();
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

  const handleClearAll = () => {
    clearAllSaved();
    setShowClearDialog(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-8">
          <LoginRequiredCard
            icon={Bookmark}
            description="Please log in with your Nostr account to view your caches."
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
              Saved Caches
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
            Your saved caches are synced to your Nostr profile and available across all your devices.
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