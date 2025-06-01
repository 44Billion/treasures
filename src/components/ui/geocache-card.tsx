import React from 'react';
import { Link } from 'react-router-dom';
import { Navigation, Trophy, MessageSquare, Trash2, Eye, CheckCircle, Edit } from 'lucide-react';
import { InteractiveCard } from '@/components/ui/card-patterns';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SaveButton } from '@/components/SaveButton';
import { useAuthor } from '@/hooks/useAuthor';
import { formatDistanceToNow } from '@/lib/date';
import { formatDistance } from '@/lib/geo';
import { geocacheToNaddr } from '@/lib/naddr-utils';
import { getCacheIcon } from '@/lib/cacheIcons';
import type { Geocache } from '@/types/geocache';

// Base interface for all geocache cards
interface BaseGeocacheCardProps {
  cache: {
    id: string;
    dTag: string;
    pubkey: string;
    name: string;
    location: {
      lat: number;
      lng: number;
    };
    difficulty: number;
    terrain: number;
    size: string;
    type: string;
    relays?: string[];
  };
  distance?: number;
  variant?: 'compact' | 'default' | 'detailed';
  onClick?: () => void;
  actions?: React.ReactNode;
  metadata?: React.ReactNode;
  showAuthor?: boolean;
  showStats?: boolean;
}

// Compact Card - Used in map sidebar and mobile views
interface CompactGeocacheCardProps extends BaseGeocacheCardProps {
  variant: 'compact';
  cache: BaseGeocacheCardProps['cache'] & {
    foundCount?: number;
  };
}

// Default Card - Used in general listings (Home page, etc)
interface DefaultGeocacheCardProps extends BaseGeocacheCardProps {
  variant: 'default';
  cache: BaseGeocacheCardProps['cache'] & {
    description?: string;
    created_at?: number;
    foundCount?: number;
    logCount?: number;
  };
}

// Detailed Card - Used in My Caches page for more info
interface DetailedGeocacheCardProps extends BaseGeocacheCardProps {
  variant: 'detailed';
  cache: BaseGeocacheCardProps['cache'] & {
    description?: string;
    created_at?: number;
    foundCount?: number;
    logCount?: number;
    // Additional fields for saved/found caches
    savedAt?: number;
    foundAt?: number;
    logText?: string;
  };
}

export type GeocacheCardProps = CompactGeocacheCardProps | DefaultGeocacheCardProps | DetailedGeocacheCardProps;

export function GeocacheCard({ 
  cache, 
  distance, 
  variant = 'default', 
  onClick,
  actions,
  metadata,
  showAuthor = true,
  showStats = true
}: GeocacheCardProps) {
  const author = useAuthor(cache.pubkey);
  const authorName = author.data?.metadata?.name || cache.pubkey.slice(0, 8);
  const profilePicture = author.data?.metadata?.picture;


  const authorInfo = showAuthor && (
    <span className="flex items-center gap-1">
      by {authorName}
      {profilePicture && (
        <img 
          src={profilePicture} 
          alt={authorName}
          className="h-4 w-4 rounded-full object-cover"
        />
      )}
    </span>
  );

  const difficultyTerrainBadges = (
    <div className="flex gap-2">
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
  );

  const statsInfo = showStats && 'foundCount' in cache && (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <span className="flex items-center gap-1">
        <Trophy className="h-4 w-4" />
        {cache.foundCount || 0}
      </span>
      {'logCount' in cache && (
        <span className="flex items-center gap-1">
          <MessageSquare className="h-4 w-4" />
          {cache.logCount || 0}
        </span>
      )}
    </div>
  );

  // Compact variant - minimal layout for sidebars with consistent styling
  if (variant === 'compact') {
    return (
      <InteractiveCard onClick={onClick} compact={true}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 shrink-0">
              {getCacheIcon(cache.type, 'sm')}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate hover:text-green-600 transition-colors">{cache.name}</h3>
              
              {/* Author info */}
              {showAuthor && (
                <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                  <span className="flex items-center gap-1">
                    by {authorName}
                    {profilePicture && (
                      <img 
                        src={profilePicture} 
                        alt={authorName}
                        className="h-4 w-4 rounded-full object-cover"
                      />
                    )}
                  </span>
                  {metadata && <span>{metadata}</span>}
                </p>
              )}
              
              {/* Badges row */}
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant="outline" className="text-xs py-0 px-1.5">D{cache.difficulty}</Badge>
                <Badge variant="outline" className="text-xs py-0 px-1.5">T{cache.terrain}</Badge>
                <Badge variant="secondary" className="text-xs py-0 px-1.5">{cache.size}</Badge>
                {distance !== undefined && (
                  <Badge variant="outline" className="text-xs py-0 px-1.5 flex items-center gap-1">
                    <Navigation className="h-2.5 w-2.5" />
                    {formatDistance(distance)}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1 shrink-0">
              {'foundCount' in cache && showStats && (
                <Badge variant="outline" className="text-xs py-0 px-1.5">
                  <Trophy className="h-2.5 w-2.5 mr-1" />
                  {cache.foundCount || 0}
                </Badge>
              )}
              {actions || (
                <SaveButton geocache={cache as any} size="icon" showText={false} className="h-7 w-7" />
              )}
            </div>
          </div>
        </CardContent>
      </InteractiveCard>
    );
  }

  // Detailed variant - comprehensive layout for My Caches page
  if (variant === 'detailed') {
    return (
      <InteractiveCard>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Link to={`/${geocacheToNaddr(cache.pubkey, cache.dTag, cache.relays)}`} className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 shrink-0">
                {getCacheIcon(cache.type, 'md')}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate hover:text-green-600 transition-colors">{cache.name}</h3>
                
                {/* Metadata line */}
                <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                  {showAuthor && authorInfo}
                  {metadata}
                </p>

                {/* Description for created caches */}
                {'description' in cache && cache.description && (
                  <p className="text-sm text-gray-700 mb-2 line-clamp-2">{cache.description}</p>
                )}

                {/* Log text for found caches */}
                {'logText' in cache && cache.logText && (
                  <p className="text-sm text-gray-700 mb-2 line-clamp-2 italic">"{cache.logText}"</p>
                )}

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {difficultyTerrainBadges}
                  {'foundAt' in cache && (
                    <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Found
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                {statsInfo}
              </div>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          </div>
        </CardContent>
      </InteractiveCard>
    );
  }

  // Default variant - standard card layout for general use
  return (
    <InteractiveCard onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 shrink-0">
            {getCacheIcon(cache.type, 'lg')}
          </div>
          <div className="flex items-center gap-2">
            {actions || (
              <SaveButton geocache={cache as any} size="icon" showText={false} />
            )}
          </div>
        </div>
        <CardTitle className="line-clamp-2">{cache.name}</CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            {showAuthor && authorInfo}
            {'created_at' in cache && cache.created_at && (
              <>
                • {formatDistanceToNow(new Date(cache.created_at * 1000), { addSuffix: true })}
              </>
            )}
          </span>
          {distance !== undefined && (
            <Badge variant="secondary" className="text-xs ml-2">
              <Navigation className="h-3 w-3 mr-1" />
              {formatDistance(distance)}
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {'description' in cache && cache.description && (
          <p className="text-sm text-gray-600 line-clamp-3 mb-4">
            {cache.description}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          {difficultyTerrainBadges}
          {statsInfo}
        </div>
      </CardContent>
    </InteractiveCard>
  );
}

// Convenience exports for common use cases
export function CompactGeocacheCard(props: Omit<CompactGeocacheCardProps, 'variant'>) {
  return <GeocacheCard {...props} variant="compact" />;
}

export function DetailedGeocacheCard(props: Omit<DetailedGeocacheCardProps, 'variant'>) {
  return <GeocacheCard {...props} variant="detailed" />;
}