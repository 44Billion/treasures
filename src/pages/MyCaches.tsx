import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MapPin, Navigation, Trophy, MessageSquare, Trash2, Cloud, Loader2, MoreVertical, Plus, Edit, Eye, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAuthor } from '@/hooks/useAuthor';
import { formatDistanceToNow } from '@/lib/date';
import { formatDistance } from '@/lib/geo';
import { useGeolocation } from '@/hooks/useGeolocation';

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    traditional: '📦',
    multi: '🔗',
    mystery: '❓',
    letterbox: '📮',
    event: '📅',
    virtual: '👻',
    earthcache: '🌍',
    wherigo: '📱',
  };
  return icons[type.toLowerCase()] || '📦';
}

interface SavedCacheCardProps {
  cache: {
    id: string;
    dTag: string;
    pubkey: string;
    name: string;
    savedAt: number;
    location: {
      lat: number;
      lng: number;
    };
    difficulty: number;
    terrain: number;
    size: string;
    type: string;
  };
  distance?: number;
  onRemove: (cacheId: string) => void;
}

function SavedCacheCard({ cache, distance, onRemove }: SavedCacheCardProps) {
  const author = useAuthor(cache.pubkey);
  const authorName = author.data?.metadata?.name || cache.pubkey.slice(0, 8);
  const profilePicture = author.data?.metadata?.picture;

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(cache.id);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link to={`/cache/${cache.dTag}`} className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
            <div className="text-2xl">{getTypeIcon(cache.type)}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate hover:text-green-600 transition-colors">{cache.name}</h3>
              <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                by {authorName}
                {profilePicture && (
                  <img 
                    src={profilePicture} 
                    alt={authorName}
                    className="h-3 w-3 rounded-full object-cover"
                  />
                )}
                • saved {formatDistanceToNow(new Date(cache.savedAt), { addSuffix: true })}
              </p>
              <div className="flex gap-2 mb-2">
                <Badge variant="outline">D{cache.difficulty}</Badge>
                <Badge variant="outline">T{cache.terrain}</Badge>
                <Badge variant="secondary">{cache.size}</Badge>
                {distance !== undefined && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Navigation className="h-3 w-3" />
                    {formatDistance(distance)}
                  </Badge>
                )}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRemove}
              title="Remove from saved caches"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface UserCacheCardProps {
  cache: {
    id: string;
    dTag: string;
    name: string;
    description: string;
    created_at: number;
    location: {
      lat: number;
      lng: number;
    };
    difficulty: number;
    terrain: number;
    size: string;
    type: string;
    foundCount?: number;
    logCount?: number;
  };
  distance?: number;
}

function UserCacheCard({ cache, distance }: UserCacheCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link to={`/cache/${cache.dTag}`} className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
            <div className="text-2xl">{getTypeIcon(cache.type)}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate hover:text-green-600 transition-colors">{cache.name}</h3>
              <p className="text-sm text-gray-600 mb-2">
                Created {formatDistanceToNow(new Date(cache.created_at * 1000), { addSuffix: true })}
              </p>
              <p className="text-sm text-gray-700 mb-2 line-clamp-2">{cache.description}</p>
              <div className="flex gap-2 mb-2">
                <Badge variant="outline">D{cache.difficulty}</Badge>
                <Badge variant="outline">T{cache.terrain}</Badge>
                <Badge variant="secondary">{cache.size}</Badge>
                {distance !== undefined && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Navigation className="h-3 w-3" />
                    {formatDistance(distance)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  {cache.foundCount || 0} finds
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {cache.logCount || 0} logs
                </span>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`/cache/${cache.dTag}`}>
              <Button variant="outline" size="icon" title="View cache">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FoundCacheCardProps {
  cache: FoundCache;
  distance?: number;
}

function FoundCacheCard({ cache, distance }: FoundCacheCardProps) {
  const author = useAuthor(cache.pubkey);
  const authorName = author.data?.metadata?.name || cache.pubkey.slice(0, 8);
  const profilePicture = author.data?.metadata?.picture;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link to={`/cache/${cache.dTag}`} className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
            <div className="text-2xl">{getTypeIcon(cache.type)}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate hover:text-green-600 transition-colors">{cache.name}</h3>
              <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                by {authorName}
                {profilePicture && (
                  <img 
                    src={profilePicture} 
                    alt={authorName}
                    className="h-3 w-3 rounded-full object-cover"
                  />
                )}
                • found {formatDistanceToNow(new Date(cache.foundAt * 1000), { addSuffix: true })}
              </p>
              {cache.logText && (
                <p className="text-sm text-gray-700 mb-2 line-clamp-2 italic">"{cache.logText}"</p>
              )}
              <div className="flex gap-2 mb-2">
                <Badge variant="outline">D{cache.difficulty}</Badge>
                <Badge variant="outline">T{cache.terrain}</Badge>
                <Badge variant="secondary">{cache.size}</Badge>
                <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Found
                </Badge>
                {distance !== undefined && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Navigation className="h-3 w-3" />
                    {formatDistance(distance)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  {cache.foundCount || 0} finds
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {cache.logCount || 0} logs
                </span>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`/cache/${cache.dTag}`}>
              <Button variant="outline" size="icon" title="View cache">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
        {/* Desktop Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 hidden md:block">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <MapPin className="h-8 w-8 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Treasures</h1>
              </Link>
              <nav className="flex items-center gap-4">
                <Link to="/map">
                  <Button variant="ghost" size="sm">
                    <MapPin className="h-4 w-4 mr-2" />
                    Explore Map
                  </Button>
                </Link>
                <LoginArea />
              </nav>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <Card className="text-center py-12">
            <CardContent>
              <Bookmark className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Login Required</h2>
              <p className="text-gray-600 mb-6">
                Please log in with your Nostr account to view your caches.
              </p>
              <div className="flex justify-center">
                <LoginArea />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40">
      {/* Desktop Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 hidden md:block">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <MapPin className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Treasures</h1>
            </Link>
            <nav className="flex items-center gap-4">
              <Link to="/map">
                <Button variant="ghost" size="sm">
                  <MapPin className="h-4 w-4 mr-2" />
                  Explore Map
                </Button>
              </Link>
              <Link to="/create">
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Hide a Treasure
                </Button>
              </Link>
              <LoginArea />
            </nav>
          </div>
        </div>
      </header>

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
              <Card className="text-center py-12">
                <CardContent>
                  <Loader2 className="h-16 w-16 mx-auto text-gray-400 mb-4 animate-spin" />
                  <h2 className="text-xl font-semibold mb-2">Loading saved caches...</h2>
                  <p className="text-gray-600">
                    Fetching your bookmarks from Nostr relays
                  </p>
                </CardContent>
              </Card>
            ) : savedCaches.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Bookmark className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No saved caches yet</h2>
                  <p className="text-gray-600 mb-6">
                    Start exploring and save interesting caches for later!
                  </p>
                  <Link to="/map">
                    <Button>
                      <MapPin className="h-4 w-4 mr-2" />
                      View Map
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {savedCachesWithDistance.map((cache) => (
                  <SavedCacheCard
                    key={cache.id}
                    cache={cache}
                    distance={cache.distance}
                    onRemove={unsaveCache}
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
              <Card className="text-center py-12">
                <CardContent>
                  <Loader2 className="h-16 w-16 mx-auto text-gray-400 mb-4 animate-spin" />
                  <h2 className="text-xl font-semibold mb-2">Loading found caches...</h2>
                  <p className="text-gray-600">
                    Fetching your geocaching achievements
                  </p>
                </CardContent>
              </Card>
            ) : !foundCaches || foundCaches.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <CheckCircle className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No finds yet</h2>
                  <p className="text-gray-600 mb-6">
                    Start exploring and log your first find!
                  </p>
                  <Link to="/map">
                    <Button>
                      <MapPin className="h-4 w-4 mr-2" />
                      View Map
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {foundCachesWithDistance.map((cache) => (
                  <FoundCacheCard
                    key={cache.logId}
                    cache={cache}
                    distance={cache.distance}
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
              <Card className="text-center py-12">
                <CardContent>
                  <Loader2 className="h-16 w-16 mx-auto text-gray-400 mb-4 animate-spin" />
                  <h2 className="text-xl font-semibold mb-2">Loading your caches...</h2>
                  <p className="text-gray-600">
                    Fetching caches you've created
                  </p>
                </CardContent>
              </Card>
            ) : !userCaches || userCaches.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Trophy className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No caches created yet</h2>
                  <p className="text-gray-600 mb-6">
                    Start your geocaching journey by hiding your first treasure!
                  </p>
                  <Link to="/create">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Hide Your First Cache
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {userCachesWithDistance.map((cache) => (
                  <UserCacheCard
                    key={cache.id}
                    cache={cache}
                    distance={cache.distance}
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