import { useState } from "react";
import { Calendar, MapPin, ExternalLink, User, Trophy, MessageSquare, ShieldCheck, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BaseDialog } from "@/components/ui/base-dialog";
import { DetailsCard, StatsCard, EmptyStateCard } from "@/components/ui/card-patterns";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthor } from "@/hooks/useAuthor";
import { useGeocaches } from "@/hooks/useGeocaches";
import { useGeocacheLogs } from "@/hooks/useGeocacheLogs";
import { useNip05Status } from "@/hooks/useNip05Verification";
import { useUserFoundCaches } from "@/hooks/useUserFoundCaches";
import { formatDistanceToNow } from "@/lib/date";
import { useNavigate } from "react-router-dom";
import { GeocacheCard } from "@/components/ui/geocache-card";

interface ProfileDialogProps {
  pubkey: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ pubkey, isOpen, onOpenChange }: ProfileDialogProps) {
  const navigate = useNavigate();
  const author = useAuthor(pubkey || "");
  const { data: geocaches = [] } = useGeocaches();
  const { data: foundCaches = [] } = useUserFoundCaches(pubkey || "");
  
  // Get metadata for NIP-05 verification
  const metadata = author.data?.metadata;
  const nip05 = metadata?.nip05;
  
  const { 
    isVerified, 
    isLoading: isLoadingNip05 
  } = useNip05Status(nip05, pubkey || "");
  
  // Early return after all hooks
  if (!pubkey) return null;

  const displayName = metadata?.display_name || metadata?.name || pubkey.slice(0, 8);
  const profilePicture = metadata?.picture;
  const about = metadata?.about;
  const website = metadata?.website;
  const createdAt = author.data?.created_at;

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
      <div className="relative -mt-2">
        {/* Banner */}
        {metadata?.banner ? (
          <div 
            className="h-24 rounded-lg bg-cover bg-center bg-gray-200"
            style={{ backgroundImage: `url(${metadata.banner})` }}
          />
        ) : (
          <div className="h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg" />
        )}
        
        {/* Profile info positioned below banner */}
        <div className="flex items-start gap-4 mt-4">
          {profilePicture ? (
            <img 
              src={profilePicture} 
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-white shadow-sm flex items-center justify-center">
              <User className="w-6 h-6 text-gray-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{displayName}</h2>
            {metadata?.name && metadata.display_name && (
              <p className="text-sm text-gray-600">@{metadata.name}</p>
            )}
            {nip05 && (
              <div className="flex items-center gap-1 text-xs">
                {isLoadingNip05 ? (
                  <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                ) : isVerified ? (
                  <ShieldCheck className="h-3 w-3 text-green-600" />
                ) : null}
                <span className="text-gray-700">{nip05}</span>
              </div>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              {createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {formatDistanceToNow(new Date(createdAt * 1000), { addSuffix: true })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {userGeocaches.length} Hidden
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                {foundCaches.length} Found
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* About section */}
          {about && (
            <div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{about}</p>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="caches" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="caches" className="text-sm">
                Geocaches ({userGeocaches.length})
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-sm">
                Activity
              </TabsTrigger>
            </TabsList>
            
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
                          navigate(`/cache/${geocache.dTag}`);
                        }}
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
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Profile Stats */}
          <StatsCard
            title="Profile Stats"
            stats={[
              {
                label: "Geocaches Created",
                value: userGeocaches.length
              },
              {
                label: "Total Finds",
                value: foundCaches.length
              }
            ]}
          />

          {/* Links */}
          {website && (
            <DetailsCard title="Links">
              <a 
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Website
              </a>
            </DetailsCard>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              size="sm"
              className="w-full"
              onClick={handleViewFullProfile}
            >
              <User className="h-4 w-4 mr-2" />
              View Full Profile
            </Button>
          </div>
        </div>
      </div>
    </BaseDialog>
  );
}