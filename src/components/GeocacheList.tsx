import { Link, useNavigate } from "react-router-dom";
import { MapPin, Navigation, Trophy, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/SaveButton";
import { useAuthor } from "@/hooks/useAuthor";
import { formatDistanceToNow } from "@/lib/date";
import { formatDistance } from "@/lib/geo";
import type { Geocache } from "@/types/geocache";

interface GeocacheWithDistance extends Geocache {
  distance?: number;
}

interface GeocacheListProps {
  geocaches: (Geocache | GeocacheWithDistance)[];
  compact?: boolean;
}

export function GeocacheList({ geocaches, compact = false }: GeocacheListProps) {
  return (
    <div className={compact ? "space-y-2" : "grid md:grid-cols-2 lg:grid-cols-3 gap-4"}>
      {geocaches.map((geocache) => (
        <GeocacheCard key={geocache.id} geocache={geocache} compact={compact} />
      ))}
    </div>
  );
}

interface GeocacheCardProps {
  geocache: Geocache | GeocacheWithDistance;
  compact?: boolean;
}

function GeocacheCard({ geocache, compact }: GeocacheCardProps) {
  const navigate = useNavigate();
  const author = useAuthor(geocache.pubkey);
  const authorName = author.data?.metadata?.name || geocache.pubkey.slice(0, 8);
  const profilePicture = author.data?.metadata?.picture;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "traditional":
        return "📦";
      case "multi":
        return "🔄";
      case "mystery":
        return "❓";
      case "earth":
        return "🌍";
      default:
        return "📍";
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on a button or interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) {
      return;
    }
    navigate(`/cache/${geocache.dTag}`);
  };

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleCardClick}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">{getTypeIcon(geocache.type)}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{geocache.name}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                <span>D{geocache.difficulty}/T{geocache.terrain}</span>
                <span>{geocache.size}</span>
                <span className="flex items-center gap-1">
                  by {authorName}
                  {profilePicture && (
                    <img 
                      src={profilePicture} 
                      alt={authorName}
                      className="h-3 w-3 rounded-full object-cover"
                    />
                  )}
                </span>
                {'distance' in geocache && geocache.distance !== undefined && (
                  <Badge variant="secondary" className="text-xs">
                    <Navigation className="h-3 w-3 mr-1" />
                    {formatDistance(geocache.distance)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline">
                <Trophy className="h-3 w-3 mr-1" />
                {geocache.foundCount || 0}
              </Badge>
              <SaveButton geocache={geocache} size="icon" showText={false} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer" onClick={handleCardClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="text-3xl">{getTypeIcon(geocache.type)}</div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{geocache.size}</Badge>
            <SaveButton geocache={geocache} size="icon" showText={false} />
          </div>
        </div>
        <CardTitle className="line-clamp-2">{geocache.name}</CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            by {authorName}
            {profilePicture && (
              <img 
                src={profilePicture} 
                alt={authorName}
                className="h-3 w-3 rounded-full object-cover"
              />
            )}
            • {formatDistanceToNow(new Date(geocache.created_at * 1000), { addSuffix: true })}
          </span>
          {'distance' in geocache && geocache.distance !== undefined && (
            <Badge variant="secondary" className="text-xs ml-2">
              <Navigation className="h-3 w-3 mr-1" />
              {formatDistance(geocache.distance)}
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 line-clamp-3 mb-4">
          {geocache.description}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Badge variant="outline">D{geocache.difficulty}</Badge>
            <Badge variant="outline">T{geocache.terrain}</Badge>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Trophy className="h-4 w-4" />
              {geocache.foundCount || 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {geocache.logCount || 0}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}