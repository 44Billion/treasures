import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { useZapStore } from '@/shared/stores/useZapStore';
import { Navigation, Trophy, MessageSquare, EyeOff, CheckCircle, BookmarkX, Zap, MapPin } from 'lucide-react';
import { InteractiveCard } from '@/components/ui/card-patterns';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CacheMenu } from '@/components/CacheMenu';
import { BlurredImage } from '@/components/BlurredImage';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { useGeocacheNavigation } from '@/features/geocache/hooks/useGeocacheNavigation';
import { formatDistanceToNow } from '@/shared/utils/date';
import { formatDistance } from '@/features/map/utils/geo';
import { CacheIcon } from '@/features/geocache/utils/cacheIcons';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useTheme } from "@/shared/hooks/useTheme";
import { getSizeLabel } from '@/features/geocache/utils/geocache-utils';
import { offlineGeocode } from '@/features/map/utils/offlineGeocode';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
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
    images?: string[];
    contentWarning?: string;
    city?: string;
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
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const { navigateToGeocache } = useGeocacheNavigation();
  const author = useAuthor(cache.pubkey);
  const zapStoreKey = cache.naddr ? `naddr:${cache.naddr}` : `event:${cache.id}`;

  // Select the memoized zap total directly from store state
  const zapTotal = useStore(useZapStore, (state) => state.zapTotals[zapStoreKey] ?? 0);

  // Use zap total from cache data if available, otherwise fall back to memoized store value
  const totalZapAmount = cache.zapTotal ?? zapTotal;

  const authorName = author.data?.metadata?.name || cache.pubkey.slice(0, 8);
  const profilePicture = author.data?.metadata?.picture;

  // Handle avatar loading errors gracefully
  const [avatarError, setAvatarError] = React.useState(false);
  const handleAvatarError = React.useCallback(() => {
    setAvatarError(true);
    console.warn('Avatar failed to load for:', authorName);
  }, [authorName]);

  // Get city name with flag from coordinates (100% offline, synchronous)
  const cityName = cache.city || (cache.location ? offlineGeocode(cache.location.lat, cache.location.lng) : '');

  // Use stats that are now included in the geocache data from useGeocaches
  const stats = {
    foundCount: cache.foundCount || 0,
    logCount: cache.logCount || 0,
  };

  // Check if this cache is hidden and the current user is the creator
  const isHiddenByCreator = cache.hidden && cache.pubkey === user?.pubkey;

  // Check if adventure theme is active
  const isAdventureTheme = theme === 'adventure';

  // Optimized navigation handler
  // On mobile, always navigate directly to the details page
  // On desktop, use the onClick handler if provided (for modal behavior)
  const handleNavigate = (fromMap?: boolean) => {
    if (isMobile) {
      // Mobile: always navigate to the details page
      navigateToGeocache(cache as Geocache, { fromMap });
    } else if (onClick) {
      // Desktop: use custom onClick handler (may open modal or navigate)
      onClick();
    } else {
      // Desktop fallback: navigate to details page
      navigateToGeocache(cache as Geocache, { fromMap });
    }
  };


  // Shared components for all variants
  const renderAuthorInfo = () => showAuthor && (
    <div className="text-[13px] sm:text-sm text-muted-foreground mb-1.5">
      <div className="flex items-center gap-1 min-w-0">
        <span className="shrink-0">{t('geocacheCard.by')}</span>
        <span className="truncate font-medium">{authorName}</span>
        {profilePicture && !avatarError && (
          <img
            src={profilePicture}
            alt={authorName}
            className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full object-cover shrink-0 ml-1"
            onError={handleAvatarError}
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
    </div>
  );

  const renderCityName = () => cityName && (
    <div className="text-xs sm:text-xs text-muted-foreground/80 mb-2.5 flex items-center gap-1">
      <MapPin className="h-3 w-3 sm:h-3 sm:w-3" />
      {cityName}
    </div>
  );

  const renderDescription = () => 'description' in cache && cache.description && (
    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
      {cache.description}
    </p>
  );

  const renderStatsSkeleton = (isCompact = false) => {
    // Only show skeleton if we expect stats to load
    const hasAnyStats = totalZapAmount > 0 || stats.foundCount > 0 || stats.logCount > 0;
    if (!hasAnyStats) return null;

    return (
      <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground shrink-0">
        {totalZapAmount > 0 && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <Skeleton className={`h-3 w-6 ${isCompact ? '' : 'sm:w-8'}`} />
          </span>
        )}
        {stats.foundCount > 0 && (
          <span className="flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            <Skeleton className={`h-3 w-3 ${isCompact ? '' : 'sm:w-4'}`} />
          </span>
        )}
        {stats.logCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <Skeleton className={`h-3 w-3 ${isCompact ? '' : 'sm:w-4'}`} />
          </span>
        )}
      </div>
    );
  };

  const renderBadgesAndStats = (isCompact = false) => (
    <div className="flex items-center justify-between gap-2 mt-auto">
      <div className="flex flex-wrap gap-1 sm:gap-1.5 min-w-0">
        <Badge variant="outline" className={`text-xs ${isCompact ? 'py-0 px-1.5' : 'px-2 py-0.5 sm:px-2'} shrink-0`}>
          D{cache.difficulty}
        </Badge>
        <Badge variant="outline" className={`text-xs ${isCompact ? 'py-0 px-1.5' : 'px-2 py-0.5 sm:px-2'} shrink-0`}>
          T{cache.terrain}
        </Badge>
        <Badge variant="secondary" className={`text-xs ${isCompact ? 'py-0 px-1.5' : 'px-2 py-0.5 sm:px-2'} shrink-0`}>
          {getSizeLabel(cache.size)}
        </Badge>
        {distance !== undefined && (
          <Badge variant="outline" className={`text-xs ${isCompact ? 'py-0 px-1.5' : 'px-2 py-0.5 sm:px-2'} flex items-center gap-1 shrink-0`}>
            <Navigation className="h-2.5 w-2.5 sm:h-2.5 sm:w-2.5" />
            {isCompact ? (
              formatDistance(distance)
            ) : (
              <span>{formatDistance(distance)}</span>
            )}
          </Badge>
        )}
        {'foundAt' in cache && (
          <Badge variant="default" className={`flex items-center gap-1 bg-green-600 adventure:bg-stone-700 text-xs ${isCompact ? 'py-0 px-1.5' : 'px-2 py-0.5 sm:px-2'} shrink-0`}>
            <CheckCircle className="h-2.5 w-2.5 sm:h-2.5 sm:w-2.5" />
            {t('geocacheCard.found')}
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
                {totalZapAmount > 0 && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" />
                    <span>{totalZapAmount.toLocaleString()}</span>
                  </span>
                )}
                {stats.foundCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>{stats.foundCount}</span>
                  </span>
                )}
                {stats.logCount > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{stats.logCount}</span>
                  </span>
                )}
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
        <CacheMenu
          geocache={cache as any}
          variant="compact"
          className={buttonSize}
        />
      )}
    </div>
  );

  // Shared standard layout for default, detailed, and featured variants
  const renderStandardLayout = (buttonSize: string, showMetadata = false) => {
    // Get preview image (first image if available)
    const previewImage = cache.images && cache.images.length > 0 ? cache.images[0] : undefined;
    const hasSpoiler = !!cache.contentWarning;

    return (
      <InteractiveCard
        onClick={() => handleNavigate()}
        className="group hover:shadow-md transition-shadow duration-200 bg-card border border-border h-full flex flex-col overflow-hidden"
      >
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="flex relative flex-1">
            {/* Image container - always shown with pastel green background if no image */}
            <div className="shrink-0 w-24 sm:w-28 aspect-square overflow-hidden bg-green-100 dark:bg-green-900/20 adventure:bg-amber-100">
              <div className="relative w-full h-full">
                {previewImage && (
                  hasSpoiler ? (
                    <BlurredImage
                      src={previewImage}
                      alt={cache.name}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      blurIntensity="heavy"
                      showToggle={true}
                      defaultBlurred={true}
                    />
                  ) : (
                    <img
                      src={previewImage}
                      alt={cache.name}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  )
                )}
                {/* Icon with hidden indicator - overlaid at bottom left */}
                <div className="absolute bottom-2 left-2 z-10">
                  <div className="relative">
                    <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 ${isAdventureTheme ? '' : 'rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'} shadow-lg`}>
                      <CacheIcon type={cache.type} size="sm" className="w-4.5 h-4.5 sm:w-5 sm:h-5" theme={theme} />
                    </div>
                    {isHiddenByCreator && (
                      <div className="absolute -top-1 -right-1 w-4.5 h-4.5 sm:w-5 sm:h-5 bg-orange-500 rounded-full flex items-center justify-center shadow-md">
                        <EyeOff className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col relative z-10 p-3.5 sm:p-4 bg-card">
            {/* Title row with action buttons */}
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <h3 className="font-semibold text-[15px] sm:text-base leading-tight line-clamp-2 sm:line-clamp-1 group-hover:text-green-600 adventure:group-hover:text-red-900 transition-colors duration-150 min-w-0 flex-1">
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

            {/* City name */}
            {!showMetadata && renderCityName()}

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
  };

  // Compact variant - minimal layout for sidebars
  if (variant === 'compact') {
    const previewImage = cache.images && cache.images.length > 0 ? cache.images[0] : undefined;
    const hasSpoiler = !!cache.contentWarning;

    return (
      <InteractiveCard onClick={() => handleNavigate()} compact={true} className="group hover:shadow-md transition-shadow duration-200 overflow-hidden h-[120px]">
        <CardContent className="p-0 h-full">
          <div className="flex relative h-full">
            {/* Image container - always shown with pastel green background if no image */}
            <div className="shrink-0 w-16 sm:w-20 h-full overflow-hidden bg-green-100 dark:bg-green-900/20 adventure:bg-amber-100">
              <div className="relative w-full h-full">
                {previewImage && (
                  hasSpoiler ? (
                    <BlurredImage
                      src={previewImage}
                      alt={cache.name}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      blurIntensity="heavy"
                      showToggle={true}
                      defaultBlurred={true}
                    />
                  ) : (
                    <img
                      src={previewImage}
                      alt={cache.name}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  )
                )}
                {/* Icon at bottom left */}
                <div className="absolute bottom-1.5 left-1.5 z-10">
                  <div className="relative">
                    <div className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 ${isAdventureTheme ? '' : 'rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'} shadow-lg`}>
                      <CacheIcon type={cache.type} size="sm" className="w-3 h-3 sm:w-3.5 sm:h-3.5" theme={theme} />
                    </div>
                    {isHiddenByCreator && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full flex items-center justify-center shadow-md">
                        <EyeOff className="h-1.5 w-1.5 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col p-2.5 sm:p-3">
              {/* Title row with action buttons */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-green-600 adventure:group-hover:text-red-900 transition-colors min-w-0 flex-1" style={{ fontSize: cache.name.length > 20 ? '0.813rem' : '0.875rem' }}>
                  {cache.name}
                </h3>
                {renderActionButtons("h-4 w-4 sm:h-5 sm:w-5", false)}
              </div>

              {/* Author and metadata */}
              {showAuthor && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <span className="flex items-center gap-1">
                    {t('geocacheCard.by')} {authorName}
                    {profilePicture && !avatarError && (
                      <img
                        src={profilePicture}
                        alt={authorName}
                        className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full object-cover"
                        onError={handleAvatarError}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </span>
                  {metadata && <span>{metadata}</span>}
                </p>
              )}

              {/* Location only */}
              {cityName && (
                <div className="text-[9px] sm:text-[10px] text-muted-foreground/80 mt-0.5 flex items-center gap-0.5">
                  <MapPin className="h-2 w-2" />
                  {cityName}
                </div>
              )}

              {/* Spacer to push badges to bottom */}
              <div className="flex-1 min-h-0"></div>

              {/* Bottom row with badges and stats */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-0.5 sm:gap-1 min-w-0">
                  <Badge variant="outline" className="text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 shrink-0">
                    D{cache.difficulty}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 shrink-0">
                    T{cache.terrain}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 shrink-0">
                    {cache.size}
                  </Badge>
                  {distance !== undefined && (
                    <Badge variant="outline" className="text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 flex items-center gap-0.5 shrink-0">
                      <Navigation className="h-2 w-2" />
                      {formatDistance(distance)}
                    </Badge>
                  )}
                  {'foundAt' in cache && (
                    <Badge variant="default" className="flex items-center gap-0.5 bg-green-600 adventure:bg-stone-700 text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 shrink-0">
                      <CheckCircle className="h-2 w-2" />
                      {t('geocacheCard.found')}
                  </Badge>
                )}
              </div>

              {/* Stats on right side of badges row */}
              {showStats && (
                <div className="shrink-0">
                  {statsLoading ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                      {totalZapAmount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <Skeleton className="h-2.5 w-4 sm:h-3 sm:w-6" />
                        </span>
                      )}
                      {stats.foundCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Trophy className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <Skeleton className="h-2.5 w-2 sm:h-3 sm:w-3" />
                        </span>
                      )}
                      {stats.logCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <Skeleton className="h-2.5 w-2 sm:h-3 sm:w-3" />
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                      {totalZapAmount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span>{totalZapAmount.toLocaleString()}</span>
                        </span>
                      )}
                      {stats.foundCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Trophy className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span>{stats.foundCount}</span>
                        </span>
                      )}
                      {stats.logCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span>{stats.logCount}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>
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
  // On mobile, use larger images and better spacing like desktop
  return renderStandardLayout("h-5 w-5 sm:h-6 sm:w-6");
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
