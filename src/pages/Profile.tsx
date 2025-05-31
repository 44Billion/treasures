import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  Trophy, 
  CheckCircle, 
  Globe, 
  ShieldCheck, 
  ShieldX, 
  ExternalLink, 
  Calendar,
  Loader2,
  Edit,
  Copy,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoCard, EmptyStateCard } from '@/components/ui/card-patterns';
import { DesktopHeader } from '@/components/DesktopHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { LoginArea } from '@/components/auth/LoginArea';
import { DetailedGeocacheCard } from '@/components/ui/geocache-card';
import { EditProfileForm } from '@/components/EditProfileForm';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useUserGeocaches } from '@/hooks/useUserGeocaches';
import { useUserFoundCaches } from '@/hooks/useUserFoundCaches';
import { useNip05Status } from '@/hooks/useNip05Verification';
import { formatDistanceToNow } from '@/lib/date';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/useToast';

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
  const { 
    isVerified, 
    isLoading: isLoadingNip05, 
    error: nip05Error 
  } = useNip05Status(authorData?.metadata?.nip05, targetPubkey);

  const metadata = authorData?.metadata;

  // Calculate distances if location is available
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
      <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-8">
          <InfoCard
            icon={User}
            title="Login Required"
            description="Please log in with your Nostr account to view your profile."
            action={<LoginArea />}
          />
        </div>
      </div>
    );
  }

  if (isLoadingAuthor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-8">
          <InfoCard
            icon={Loader2}
            title="Loading profile..."
            description="Fetching user information from Nostr relays"
            className="text-center py-12"
          />
        </div>
      </div>
    );
  }

  const displayName = metadata?.name || metadata?.display_name || targetPubkey.slice(0, 8) + '...';
  const shortPubkey = targetPubkey.slice(0, 8) + '...' + targetPubkey.slice(-8);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40">
      <DesktopHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="mb-4">
          <CardContent className="p-4">
            {/* Banner */}
            {metadata?.banner && (
              <div className="relative w-full h-24 sm:h-32 mb-4 rounded-lg overflow-hidden bg-gradient-to-r from-green-100 to-emerald-100">
                <img 
                  src={metadata.banner} 
                  alt="Profile banner"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex gap-3 items-start">
              {/* Avatar */}
              <Avatar className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-white shadow-md flex-shrink-0">
                <AvatarImage src={metadata?.picture} alt={displayName} />
                <AvatarFallback className="text-sm">
                  {metadata?.name?.charAt(0) || <User className="w-5 h-5" />}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <h1 className="text-lg font-bold flex items-center gap-2">
                      {displayName}
                      {metadata?.bot && (
                        <Badge variant="secondary" className="text-xs">
                          Bot
                        </Badge>
                      )}
                    </h1>
                    <button
                      onClick={() => copyToClipboard(targetPubkey, 'Public Key')}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors group"
                      title="Click to copy full public key"
                    >
                      <span className="font-mono">{shortPubkey}</span>
                      {copiedField === 'Public Key' ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  </div>

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
                </div>

                {/* Bio */}
                {metadata?.about && (
                  <p className="text-sm text-gray-700 mb-2 line-clamp-1">
                    {metadata.about}
                  </p>
                )}

                {/* Profile Details - Simple clean layout */}
                <div className="space-y-1 text-xs">
                  {metadata?.nip05 && (
                    <div className="flex items-center gap-1">
                      {isLoadingNip05 ? (
                        <Loader2 className="h-3 w-3 animate-spin text-gray-400" title="Verifying NIP-05..." />
                      ) : isVerified ? (
                        <ShieldCheck className="h-3 w-3 text-green-600" title="NIP-05 verified" />
                      ) : (
                        <ShieldX className="h-3 w-3 text-red-500" title={`NIP-05 verification failed${nip05Error ? `: ${nip05Error}` : ''}`} />
                      )}
                      <button
                        onClick={() => copyToClipboard(metadata.nip05, 'NIP-05')}
                        className="text-gray-700 hover:text-gray-900 transition-colors"
                        title="Click to copy NIP-05 identifier"
                      >
                        {metadata.nip05}
                      </button>
                      {isVerified && (
                        <span className="text-green-600 ml-1">✓</span>
                      )}
                    </div>
                  )}

                  {metadata?.website && (
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <a
                        href={metadata.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 transition-colors truncate"
                      >
                        {metadata.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}

                  {(metadata?.lud16 || metadata?.lud06) && (
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500 flex-shrink-0">⚡</span>
                      <button
                        onClick={() => copyToClipboard(metadata.lud16 || metadata.lud06 || '', 'Lightning Address')}
                        className="text-gray-700 hover:text-gray-900 transition-colors font-mono truncate"
                        title="Click to copy Lightning address"
                      >
                        {metadata.lud16 || metadata.lud06}
                      </button>
                    </div>
                  )}

                  {authorData?.event && (
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>
                        Joined {formatDistanceToNow(new Date(authorData.event.created_at * 1000), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Caches Created</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCaches?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Hidden for others to find
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Caches Found</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{foundCaches?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Successfully discovered
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cache Tabs */}
        <Tabs defaultValue="created" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="created" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
              <Trophy className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Created</span>
              <span className="text-xs sm:text-sm">({userCaches?.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="found" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-3 sm:px-3 sm:py-2 min-h-[3rem] sm:min-h-[2.5rem]">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Found</span>
              <span className="text-xs sm:text-sm">({foundCaches?.length || 0})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                {isOwnProfile ? 'Geocaches you\'ve hidden for others to find' : `Geocaches hidden by ${displayName}`}
              </p>
            </div>

            {isLoadingUserCaches ? (
              <InfoCard
                icon={Loader2}
                title="Loading caches..."
                description="Fetching created caches"
                className="text-center py-12"
              />
            ) : !userCaches || userCaches.length === 0 ? (
              <EmptyStateCard
                icon={Trophy}
                title={isOwnProfile ? "No caches created yet" : "No caches found"}
                description={isOwnProfile ? "Start your geocaching journey by hiding your first treasure!" : `${displayName} hasn't created any caches yet.`}
                action={
                  isOwnProfile ? (
                    <Link to="/create">
                      <Button>
                        <Trophy className="h-4 w-4 mr-2" />
                        Hide Your First Cache
                      </Button>
                    </Link>
                  ) : undefined
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
                    showAuthor={!isOwnProfile}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="found" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                {isOwnProfile ? 'Caches you\'ve successfully found and logged' : `Caches found by ${displayName}`}
              </p>
            </div>

            {isLoadingFoundCaches ? (
              <InfoCard
                icon={Loader2}
                title="Loading found caches..."
                description="Fetching geocaching achievements"
                className="text-center py-12"
              />
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