import React from 'react';
import { useStore } from 'zustand';
import { useZapStore } from '@/shared/stores/useZapStore';
import { Navigation, Trophy, MessageSquare, EyeOff, CheckCircle, BookmarkX, Zap } from 'lucide-react';
import { InteractiveCard } from '@/components/ui/card-patterns';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SaveButton } from '@/shared/components/common/SaveButton';
import { CacheMenu } from '@/components/CacheMenu';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { useGeocacheNavigation } from '@/features/geocache/hooks/useGeocacheNavigation';
import { formatDistanceToNow } from '@/shared/utils/date';
import { formatDistance } from '@/features/map/utils/geo';
import { CacheIcon } from '@/features/geocache/utils/cacheIcons';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useTheme } from 'next-themes';
import type { Geocache } from '@/types/geocache';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

// Base interface for all geocache cards
interface BaseGeocacheCardProps {
  cache: {
    id: string;
    dTag: string;
    naddr?: string;
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
    hidden?: boolean;
    isOffline?: boolean;
    source?: 'synced' | 'manual';
  };
  distance?: number;
  variant?: 'compact' | 'default' | 'detailed' | 'featured';
  onClick?: () => void;
  actions?: React.ReactNode;
  metadata?: React.ReactNode;
  showAuthor?: boolean;
  showStats?: boolean;
  statsLoading?: boolean;
}

// Compact Card - Used in map sidebar and mobile views
interface CompactGeocacheCardProps extends BaseGeocacheCardProps {
  variant: 'compact';
  cache: BaseGeocacheCardProps['cache'] & {
    foundCount?: number;
    logCount?: number;
    zapTotal?: number;
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
    zapTotal?: number;
  };
}

// Detailed Card - Used in Saved Caches page for more info
interface DetailedGeocacheCardProps extends BaseGeocacheCardProps {
  variant: 'detailed';
  cache: BaseGeocacheCardProps['cache'] & {
    description?: string;
    created_at?: number;
    foundCount?: number;
    logCount?: number;
    zapTotal?: number;
    // Additional fields for saved/found caches
    savedAt?: number;
    foundAt?: number;
    logText?: string;
  };
}

// Featured Card - Used on home page for elegant recent caches display
interface FeaturedGeocacheCardProps extends BaseGeocacheCardProps {
  variant: 'featured';
  cache: BaseGeocacheCardProps['cache'] & {
    description?: string;
    created_at?: number;
    foundCount?: number;
    logCount?: number;
    zapTotal?: number;
  };
}

export type GeocacheCardProps = CompactGeocacheCardProps | DefaultGeocacheCardProps | DetailedGeocacheCardProps | FeaturedGeocacheCardProps;

export function GeocacheCard({
  cache,
  distance,
  variant = 'default',
  onClick,
  actions,
  metadata,
  showAuthor = true,
  showStats = true,
  statsLoading = false
}: GeocacheCardProps) {
  const { user } = useCurrentUser();
  const { theme } = useTheme();
  const { navigateToGeocache } = useGeocacheNavigation();
  const author = useAuthor(cache.pubkey);
  const getZapTotal = useStore(useZapStore, (state) => state.getZapTotal);

  const authorName = author.data?.metadata?.name || cache.pubkey.slice(0, 8);
  const profilePicture = author.data?.metadata?.picture;
  
  // Handle avatar loading errors gracefully
  const [avatarError, setAvatarError] = React.useState(false);
  const handleAvatarError = React.useCallback(() => {
    setAvatarError(true);
    console.warn('Avatar failed to load for:', authorName);
  }, [authorName]);

  // Use stats that are now included in the geocache data from useGeocaches
  const stats = {
    foundCount: cache.foundCount || 0,
    logCount: cache.logCount || 0,
  };
  
  // Use zap total from cache data if available, otherwise fall back to store
  const zapStoreKey = cache.naddr ? `naddr:${cache.naddr}` : `event:${cache.id}`;
  const totalZapAmount = cache.zapTotal ?? getZapTotal(zapStoreKey);
  
  // Debug logging to see what's happening
  console.log('DEBUG: GeocacheCard zap data:', {
    cacheName: cache.name,
    cacheZapTotal: cache.zapTotal,
    zapStoreKey,
    storeZapTotal: getZapTotal(zapStoreKey),
    finalZapAmount: totalZapAmount,
    cacheNaddr: cache.naddr,
    cacheId: cache.id
  });

  // Check if this cache is hidden and the current user is the creator
  const isHiddenByCreator = cache.hidden && cache.pubkey === user?.pubkey;

  // Check if adventure theme is active
  const isAdventureTheme = theme === 'adventure';

  // Optimized navigation handler
  const handleNavigate = (fromMap?: boolean) => {
    if (onClick) {
      onClick();
    } else {
      navigateToGeocache(cache as Geocache, { fromMap });
    }
  };


  // Shared components for all variants
  const renderAuthorInfo = () => showAuthor && (
    <div className="text-xs sm:text-sm text-muted-foreground mb-1">
      <div className="flex items-center gap-1 min-w-0">
        <span className="shrink-0">by</span>
        <span className="truncate font-medium">{authorName}</span>
        {profilePicture && !avatarError && (
          <img
            src={profilePicture}
            alt={authorName}
            className="h-3 w-3 sm:h-4 sm:w-4 rounded-full object-cover shrink-0 ml-1"
            onError={handleAvatarError}
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
    </div>
  );

  const renderCreatedTime = () => 'created_at' in cache && cache.created_at && (
    <div className="text-xs sm:text-sm text-muted-foreground/80 mb-3">
      {formatDistanceToNow(new Date(cache.created_at * 1000), { addSuffix: true })}
    </div>
  );

  const renderDescription = () => 'description' in cache && cache.description && (
    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
      {cache.description}
    </p>
  );

  const renderStatsSkeleton = (isCompact = false) => (
    <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground shrink-0">
      <span className="flex items-center gap-1">
        <Zap className="h-3 w-3" />
        <Skeleton className={`h-3 w-6 ${isCompact ? '' : 'sm:w-8'}`} />
      </span>
      <span className="flex items-center gap-1">
        <Trophy className="h-3 w-3" />
        <Skeleton className={`h-3 w-3 ${isCompact ? '' : 'sm:w-4'}`} />
      </span>
      <span className="flex items-center gap-1">
        <MessageSquare className="h-3 w-3" />
        <Skeleton className={`h-3 w-3 ${isCompact ? '' : 'sm:w-4'}`} />
      </span>
    </div>
  );

  const renderBadgesAndStats = (isCompact = false) => (
    <div className="flex items-center justify-between gap-2 mt-auto">
      <div className="flex flex-wrap gap-1 sm:gap-1.5 min-w-0">
        <Badge variant="outline" className={`text-xs ${isCompact ? 'py-0 px-1.5' : 'px-1.5 py-0.5 sm:px-2'} shrink-0`}>
          D{cache.difficulty}
        </Badge>
        <Badge variant="outline" className={`text-xs ${isCompact ? 'py-0 px-1.5' : 'px-1.5 py-0.5 sm:px-2'} shrink-0`}>
          T{cache.terrain}
        </Badge>
        <Badge variant="secondary" className={`text-xs ${isCompact ? 'py-0 px-1.5' : 'px-1.5 py-0.5 sm:px-2'} shrink-0`}>
          {cache.size}
        </Badge>
        {distance !== undefined && (
          <Badge variant="outline" className={`text-xs ${isCompact ? 'py-0 px-1.5' : 'px-1.5 py-0.5 sm:px-2'} flex items-center gap-1 shrink-0`}>
            <Navigation className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
            {isCompact ? (
              formatDistance(distance)
            ) : (
              <>
                <span className="hidden sm:inline">{formatDistance(distance)}</span>
                <span className="sm:hidden">{formatDistance(distance).replace(' away', '')}</span>
              </>
            )}
          </Badge>
        )}
        {'foundAt' in cache && (
          <Badge variant="default" className={`flex items-center gap-1 bg-green-600 adventure:bg-stone-700 text-xs ${isCompact ? 'py-0 px-1.5' : 'px-1.5 py-0.5 sm:px-2'} shrink-0`}>
            <CheckCircle className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Found
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground shrink-0">
        {showStats && (
          <>
            {statsLoading ? (
              renderStatsSkeleton(isCompact)
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  <span>{totalZapAmount.toLocaleString()}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  <span>{stats.foundCount}</span>
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>{stats.logCount}</span>
                </span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderActionButtons = (buttonSize: string, showOnHover = true) => (
    <div className={`flex items-center gap-0.5 sm:gap-1 shrink-0 ${showOnHover ? 'md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150' : ''}`}>
      {actions || (
        <>
          <SaveButton
            geocache={cache as any}
            size="icon"
            showText={false}
            className={buttonSize}
          />
          <CacheMenu
            geocache={cache as any}
            variant="compact"
            className={buttonSize}
          />
        </>
      )}
    </div>
  );

  // Shared standard layout for default, detailed, and featured variants
  const renderStandardLayout = (buttonSize: string, showMetadata = false) => (
    <InteractiveCard
      onClick={() => handleNavigate()}
      className="group hover:shadow-md transition-shadow duration-200 bg-card border border-border h-full flex flex-col"
    >
      <CardContent className="p-3 sm:p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-3 sm:gap-4 h-full">
          {/* Icon with hidden indicator */}
          <div className="relative shrink-0">
            <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 ${isAdventureTheme ? '' : 'rounded-full bg-muted'}`}>
              <CacheIcon type={cache.type} size="sm" className="sm:w-5 sm:h-5" theme={theme} />
            </div>
            {isHiddenByCreator && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                <EyeOff className="h-3 w-3 text-white" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col h-full">
            {/* Title row with action buttons */}
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <h3 className="font-semibold text-base leading-tight line-clamp-2 sm:line-clamp-1 group-hover:text-green-600 adventure:group-hover:text-red-900 transition-colors duration-150 min-w-0 flex-1">
                {cache.isOffline && cache.source === 'manual' && (
                  <TooltipProvider key="tooltip-provider">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BookmarkX className="h-4 w-4 mr-2 inline-block" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Saved offline</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {cache.name}
              </h3>
              {variant !== 'detailed' && renderActionButtons(buttonSize)}
            </div>

            {/* Creator name */}
            {renderAuthorInfo()}

            {/* Metadata for detailed variant */}
            {showMetadata && metadata && (
              <p className="text-xs sm:text-sm text-muted-foreground/80 mb-3">
                {metadata}
              </p>
            )}

            {/* Created time */}
            {!showMetadata && renderCreatedTime()}

            {/* Description */}
            {renderDescription()}

            {/* Log text for found caches */}
            {'logText' in cache && cache.logText && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3 italic">"{cache.logText}"</p>
            )}

            {/* Spacer to push badges to bottom */}
            <div className="flex-1 min-h-0"></div>

            {/* Badges and stats row */}
            {renderBadgesAndStats()}
          </div>

          {/* Action buttons for detailed variant */}
          {variant === 'detailed' && (
            <div className="flex items-center gap-2 shrink-0">
              {renderActionButtons(buttonSize)}
            </div>
          )}
        </div>
      </CardContent>
    </InteractiveCard>
  );

  // Compact variant - minimal layout for sidebars
  if (variant === 'compact') {
    return (
      <InteractiveCard onClick={() => handleNavigate()} compact={true} className="group hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-3">
          <div className="flex flex-col h-full">
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <div className={`flex items-center justify-center w-8 h-8 ${isAdventureTheme ? '' : 'rounded-full bg-muted'}`}>
                  <CacheIcon type={cache.type} size="sm" theme={theme} />
                </div>
                {isHiddenByCreator && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                    <EyeOff className="h-2 w-2 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-green-600 adventure:group-hover:text-red-900 transition-colors">
                  {cache.isOffline && cache.source === 'manual' && (
                    <TooltipProvider key="tooltip-provider-compact">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <BookmarkX className="h-4 w-4 mr-2 inline-block" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Saved offline</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {cache.name}
                </h3>

                {/* Author and metadata */}
                {showAuthor && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <span className="flex items-center gap-1">
                      by {authorName}
                      {profilePicture && !avatarError && (
                        <img
                          src={profilePicture}
                          alt={authorName}
                          className="h-3 w-3 rounded-full object-cover"
                          onError={handleAvatarError}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </span>
                    {metadata && <span>{metadata}</span>}
                  </p>
                )}

                {/* Created time */}
                {renderCreatedTime()}
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                {renderActionButtons("h-4 w-4 sm:h-5 sm:w-5")}
              </div>
            </div>

            {/* Bottom row with badges and stats */}
            <div className="flex items-center justify-between gap-2 mt-3">
              <div className="flex flex-wrap gap-1 min-w-0">
                <Badge variant="outline" className="text-xs py-0 px-1.5 shrink-0">
                  D{cache.difficulty}
                </Badge>
                <Badge variant="outline" className="text-xs py-0 px-1.5 shrink-0">
                  T{cache.terrain}
                </Badge>
                <Badge variant="secondary" className="text-xs py-0 px-1.5 shrink-0">
                  {cache.size}
                </Badge>
                {distance !== undefined && (
                  <Badge variant="outline" className="text-xs py-0 px-1.5 flex items-center gap-1 shrink-0">
                    <Navigation className="h-2 w-2" />
                    {formatDistance(distance)}
                  </Badge>
                )}
                {'foundAt' in cache && (
                  <Badge variant="default" className="flex items-center gap-1 bg-green-600 adventure:bg-stone-700 text-xs py-0 px-1.5 shrink-0">
                    <CheckCircle className="h-2 w-2" />
                    Found
                  </Badge>
                )}
              </div>

              {/* Stats in bottom right */}
              {showStats && (
                <>
                  {statsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        <Skeleton className="h-3 w-6" />
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        <Skeleton className="h-3 w-3" />
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <Skeleton className="h-3 w-3" />
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        <span>{totalZapAmount.toLocaleString()}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        <span>{stats.foundCount}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{stats.logCount}</span>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </InteractiveCard>
    );
  }

  // Detailed variant - comprehensive layout for profile pages
  if (variant === 'detailed') {
    return renderStandardLayout("h-4 w-4 sm:h-6 sm:w-6", true);
  }

  // Featured variant - elegant layout for home page
  if (variant === 'featured') {
    return renderStandardLayout("h-4 w-4 sm:h-6 sm:w-6");
  }

  // Default variant - standard card layout for general use
  return renderStandardLayout("h-4 w-4 sm:h-6 sm:w-6");
}

// Convenience exports for common use cases
export function CompactGeocacheCard(props: Omit<CompactGeocacheCardProps, 'variant'>) {
  return <GeocacheCard {...props} variant="compact" />;
}

export function DetailedGeocacheCard(props: Omit<DetailedGeocacheCardProps, 'variant'>) {
  return <GeocacheCard {...props} variant="detailed" />;
}

export function FeaturedGeocacheCard(props: Omit<FeaturedGeocacheCardProps, 'variant'>) {
  return <GeocacheCard {...props} variant="featured" />;
}
