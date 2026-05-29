import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { useZapStore } from '@/stores/useZapStore';
import { Navigation, Trophy, MessageSquare, EyeOff, CheckCircle, Zap, MapPin, Trash2, Archive, Wrench, CloudOff } from 'lucide-react';
import { InteractiveCard } from '@/components/ui/card-patterns';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModifierBadges } from '@/components/ModifierBadges';
import { CacheMenu } from '@/components/CacheMenu';
import { BlurredImage } from '@/components/BlurredImage';
import { useAuthor } from '@/hooks/useAuthor';
import { useGeocacheNavigation } from '@/hooks/useGeocacheNavigation';
import { formatDistance } from '@/utils/geo';
import { CacheIcon } from '@/utils/cacheIcons';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTheme } from "@/hooks/useTheme";
import { getSizeLabel } from '@/utils/geocache-utils';
import { offlineGeocode } from '@/utils/offlineGeocode';
import { cn } from '@/utils/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Geocache } from '@/types/geocache';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { Skeleton } from '@/components/ui/skeleton';
import { useThumbnailUrl } from '@/hooks/useThumbnailUrl';

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
    kind?: number;
    relays?: string[];
    hidden?: boolean;
    status?: 'archived' | 'maintenance';
    images?: string[];
    contentWarning?: string;
    city?: string;
    /** Key Quest mission (NIP-GC `mission` tag). Surfaced as a modifier badge. */
    mission?: string;
    /** NIP-GC `n` tag modifiers. Surfaced as modifier badges. */
    modifiers?: ('first-to-find' | 'art')[];
    /**
     * Locked-in FTF winner pubkey (NIP-GC `F` tag). When present we render
     * the FTF badge in its "claimed" state on the card without needing logs.
     */
    ftfWinner?: string;
    /**
     * For draft cards only: whether the draft has been confirmed on the
     * relay (`'synced'`) or still lives only in this device's localStorage
     * because a previous Save Draft couldn't reach the relay (`'local'`).
     * Used to render a "Not synced" badge.
     */
    syncStatus?: 'synced' | 'local';
  };
  distance?: number;
  withinRadius?: boolean;
  variant?: 'compact' | 'default' | 'detailed' | 'featured';
  onClick?: () => void;
  onDelete?: () => void;
  actions?: React.ReactNode;
  metadata?: React.ReactNode;
  showAuthor?: boolean;
  showStats?: boolean;
  statsLoading?: boolean;
  isFound?: boolean;
  /**
   * Override for the FTF "claimed" visual state. When undefined the card
   * falls back to `!!cache.ftfWinner` (only true once an owner has locked
   * in the F tag). Adventure views pass in the provisional claim status
   * computed from verified found logs so the badge flips as soon as the
   * cache is genuinely won, not only on lock-in.
   */
  ftfClaimed?: boolean;
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
  withinRadius,
  variant = 'default',
  onClick,
  onDelete,
  actions,
  metadata,
  showAuthor = true,
  showStats = true,
  statsLoading = false,
  isFound = false,
  ftfClaimed,
}: GeocacheCardProps) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user } = useCurrentUser();
  const { theme, resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const { navigateToGeocache, getGeocacheUrl } = useGeocacheNavigation();
  const author = useAuthor(cache.pubkey);
  const thumbnail = useThumbnailUrl();
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
  }, []);

  // Get city name with flag from coordinates (100% offline, lazy-loaded)
  const [cityName, setCityName] = useState<string>(cache.city || '');

  useEffect(() => {
    if (cache.city) {
      setCityName(cache.city);
    } else if (cache.location) {
      offlineGeocode(cache.location.lat, cache.location.lng).then(setCityName);
    }
  }, [cache.city, cache.location]);

  // Use stats that are now included in the geocache data from useGeocaches
  const stats = {
    foundCount: cache.foundCount || 0,
    logCount: cache.logCount || 0,
  };

  // Check if this cache is hidden and the current user is the creator
  const isHiddenByCreator = cache.hidden && cache.pubkey === user?.pubkey;

  // Treasures carrying the `art` modifier swap their type glyph for a
  // Palette glyph wherever the icon appears, mirroring the map marker
  // behavior in `cacheMapIcons.ts` so cards and pins stay in lockstep.
  const isArt = cache.modifiers?.includes('art') ?? false;

  // Resolve the effective FTF claimed flag once. Explicit prop wins (used by
  // adventure views to surface provisional verified-found claims); otherwise
  // fall back to the locked-in F tag which every card already had access to.
  const resolvedFtfClaimed = ftfClaimed ?? !!cache.ftfWinner;

  // Owner-set lifecycle status. Archived and maintenance caches are de-emphasized
  // (dimmed) in lists and carry a status badge so seekers immediately see the state.
  const status = cache.status;
  const hasStatus = status === 'archived' || status === 'maintenance';

  // Check if adventure theme is active
  const isAdventureTheme = theme === 'adventure';

  // Theme-aware styling for the empty-image fallback area. Mirrors how the
  // home page hero handles its background and logo tinting:
  //   - light: pastel green, multiply blend so the green logo tints the bg
  //   - dark: muted dark token, no blend (multiply disappears on dark)
  //   - adventure: amber + sepia logo, multiply works on the warm pastel bg
  //   - mojave / ditto: theme background, with the logo retinted via the
  //     scoped `.mojave-logo` / `.ditto-logo` filters; multiply disabled so
  //     the retinted logo is actually visible against dark theme surfaces.
  const emptyImageBgClass =
    resolvedTheme === 'ditto' || resolvedTheme === 'mojave'
      ? 'bg-background'
      : 'bg-green-100 dark:bg-primary-50 adventure:bg-amber-100';
  const emptyImageLogoFilterClass =
    resolvedTheme === 'ditto' ? 'ditto-logo'
      : resolvedTheme === 'mojave' ? 'mojave-logo'
      : resolvedTheme === 'adventure' ? 'sepia'
      : '';
  // Use multiply only on light pastel surfaces. On dark / themed surfaces
  // multiply collapses the logo into the background, so we render normally
  // and bump opacity slightly to keep the mark legible.
  const emptyImageLogoBlendClass =
    resolvedTheme === 'ditto' || resolvedTheme === 'mojave' || resolvedTheme === 'dark'
      ? 'opacity-30 mix-blend-normal'
      : 'opacity-20 mix-blend-multiply';
  const emptyImageLogoClass = cn(emptyImageLogoFilterClass, emptyImageLogoBlendClass);

  const isDraft = cache.kind === NIP_GC_KINDS.DRAFT;
  const isUnsyncedDraft = isDraft && cache.syncStatus === 'local';

  // Small "Not synced" pill rendered under the title for drafts whose last
  // save couldn't reach the relay. Tapping the card still navigates into the
  // create wizard to continue editing — the next successful Save Draft will
  // sync and remove the pill.
  const renderUnsyncedBadge = () => {
    if (!isUnsyncedDraft) return null;
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-medium px-1.5 py-0.5 leading-none border border-amber-300/60 dark:border-amber-700/60"
        title={t('createCache.draft.notSyncedTooltip')}
      >
        <CloudOff className="h-2.5 w-2.5" />
        {t('createCache.draft.notSyncedBadge')}
      </span>
    );
  };

  // Resolve the in-app URL this card should navigate to. Drafts open the
  // creation wizard; everything else points at the geocache details page.
  const cardUrl = (fromMap?: boolean): string => {
    if (isDraft) {
      return `/create-cache?draft=${encodeURIComponent(cache.dTag)}`;
    }
    return getGeocacheUrl(cache as Geocache, { fromMap });
  };

  // Optimized navigation handler
  // On mobile, always navigate directly to the details page
  // On desktop, use the onClick handler if provided (for modal behavior)
  const handleNavigate = (fromMap?: boolean) => {
    // Drafts navigate to the creation wizard to continue editing
    if (isDraft) {
      nav(cardUrl(fromMap));
      return;
    }

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

  // True when the click should open the card in a new browser tab. Matches
  // standard link behavior: middle-click (button 1), Ctrl+click (Win/Linux),
  // Cmd+click (macOS), or Shift+click for a new window.
  const isOpenInNewTabClick = (e: { button: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) =>
    e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey;

  // Primary-button click: respect modifier keys to open in a new tab; otherwise
  // fall through to the existing handleNavigate flow (which honors the
  // mobile-vs-desktop and onClick branching).
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>, fromMap?: boolean) => {
    if (isOpenInNewTabClick(e)) {
      e.preventDefault();
      e.stopPropagation();
      window.open(cardUrl(fromMap), '_blank', 'noopener,noreferrer');
      return;
    }
    handleNavigate(fromMap);
  };

  // Aux-button click (typically middle-click): always open in a new tab so the
  // card behaves like a real link even though it's a div.
  const handleCardAuxClick = (e: React.MouseEvent<HTMLDivElement>, fromMap?: boolean) => {
    if (e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(cardUrl(fromMap), '_blank', 'noopener,noreferrer');
  };

  // Suppress the browser's middle-click autoscroll so users get a clean
  // open-in-new-tab interaction instead of a scroll cursor.
  const handleCardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1) e.preventDefault();
  };


  // Shared components for all variants
  const renderAuthorInfo = () => showAuthor && (
    <div className="text-[13px] sm:text-sm text-muted-foreground mb-1.5">
      <div className="flex items-center gap-1 min-w-0">
        {profilePicture && !avatarError && (
          <img
            src={thumbnail(profilePicture, 32)}
            alt={authorName}
            className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full object-cover shrink-0"
            onError={handleAvatarError}
            loading="lazy"
            decoding="async"
          />
        )}
        <span className="truncate font-medium">{authorName}</span>
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

  const renderStatusBadge = (isCompact = false) => {
    if (!hasStatus) return null;
    const isArchived = status === 'archived';
    const Icon = isArchived ? Archive : Wrench;
    const label = isArchived
      ? t('geocache.status.archived', 'Archived')
      : t('geocache.status.maintenance', 'Maintenance');
    return (
      <Badge
        variant="outline"
        className={cn(
          'flex items-center gap-1 shrink-0',
          isCompact ? 'text-[10px] sm:text-xs py-0 px-1 sm:px-1.5' : 'text-xs px-2 py-0.5 sm:px-2',
          isArchived
            ? 'border-muted-foreground/40 bg-muted text-muted-foreground'
            : 'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        )}
      >
        <Icon className={isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
        {label}
      </Badge>
    );
  };

  const renderBadgesAndStats = (isCompact = false) => (
    <div className="flex items-center justify-between gap-2 mt-auto">
      <div className="flex flex-wrap gap-1 sm:gap-1.5 min-w-0">
        {renderStatusBadge(isCompact)}
        <ModifierBadges cache={cache} size="compact" inline ftfClaimed={resolvedFtfClaimed} />
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
          <Badge variant="default" className={`flex items-center gap-1 bg-primary adventure:bg-stone-700 text-xs ${isCompact ? 'py-0 px-1.5' : 'px-2 py-0.5 sm:px-2'} shrink-0`}>
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

  const renderActionButtons = (buttonSize: string, showOnHover = true, absoluteOnMobile = false) => (
    <div className={`flex items-center gap-0.5 sm:gap-1 shrink-0 ${absoluteOnMobile ? 'absolute top-2 right-2 md:relative md:top-auto md:right-auto' : ''} ${showOnHover ? 'md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150' : ''}`}>
      {actions || (isDraft && onDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className={buttonSize}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
          <span className="sr-only">Delete draft</span>
        </Button>
      ) : (
        <CacheMenu
          geocache={cache as any}
          variant="compact"
          className={buttonSize}
        />
      ))}
    </div>
  );

  // Shared standard layout for default, detailed, and featured variants
  const renderStandardLayout = (buttonSize: string, showMetadata = false) => {
    // Get preview image (first image if available)
    const previewImage = cache.images && cache.images.length > 0 ? cache.images[0] : undefined;
    const hasSpoiler = !!cache.contentWarning;

    return (
      <InteractiveCard
        onClick={(e) => handleCardClick(e)}
        onAuxClick={(e) => handleCardAuxClick(e)}
        onMouseDown={handleCardMouseDown}
        className={cn(
          "group hover:shadow-md transition-shadow duration-200 bg-card border border-border h-full flex flex-col overflow-hidden",
          hasStatus && "opacity-70 hover:opacity-90"
        )}
      >
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="flex relative flex-1">
            {/* Image container - always shown with theme-aware background if no image */}
            <div className={cn("shrink-0 w-24 sm:w-28 aspect-square overflow-hidden", emptyImageBgClass)}>
              <div className="relative w-full h-full">
                {!previewImage && (
                  // Decorative half-logo bleed when no image is available. The
                  // image is sized to twice the container width and shifted so
                  // its right half spills outside the overflow-hidden parent,
                  // leaving the left half visible. mix-blend-multiply lets the
                  // logo tint the background; the per-theme filter class
                  // matches the Home hero logo so the look is consistent
                  // across themes (sepia for adventure, ditto/mojave filters
                  // for those themes).
                  <img
                    src="/icon.svg"
                    alt=""
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none select-none absolute top-1/2 left-0 h-[120%] w-auto max-w-none -translate-y-1/2",
                      emptyImageLogoClass,
                    )}
                  />
                )}
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
                      src={thumbnail(previewImage, 224)}
                      alt={cache.name}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                      width={112}
                      height={112}
                    />
                  )
                )}
                {/* Icon with hidden indicator - overlaid at bottom left */}
                <div className="absolute bottom-2 left-2 z-10">
                  <div className="relative">
                    <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 ${isAdventureTheme ? '' : 'rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'} shadow-lg`}>
                      <CacheIcon type={cache.type} size="sm" className="w-4.5 h-4.5 sm:w-5 sm:h-5" theme={theme} isArt={isArt} />
                    </div>
                    {isHiddenByCreator && (
                      <div className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] sm:w-6 sm:h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-800">
                        <EyeOff className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                {/* Found overlay */}
                {isFound && (
                  <div className="absolute inset-0 z-20 bg-green-500/40 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-white drop-shadow-md" />
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col relative z-10 p-3.5 sm:p-4 bg-card">
            {/* Title row with action buttons */}
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h3 className="font-semibold text-[15px] sm:text-base leading-tight truncate group-hover:text-primary adventure:group-hover:text-red-900 transition-colors duration-150 min-w-0">
                  {cache.name}
                </h3>
                {renderUnsyncedBadge()}
              </div>
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

            {/* City name — shown when no caller-supplied metadata is occupying
                that slot. The detailed variant otherwise hid this entirely
                because `showMetadata` was always true, even when no metadata
                was provided. */}
            {!metadata && renderCityName()}

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
      <InteractiveCard onClick={(e) => handleCardClick(e)} onAuxClick={(e) => handleCardAuxClick(e)} onMouseDown={handleCardMouseDown} compact={true} className={cn(`group hover:shadow-md transition-all duration-200 overflow-hidden min-h-[120px]${withinRadius === true ? ' bg-primary/10 border-primary/30' : ''}`, hasStatus && 'opacity-70 hover:opacity-90')}>
        <CardContent className="p-0 h-full">
          <div className="flex relative min-h-[120px]">
            {/* Image container - always shown with theme-aware background if no
                 image. The card uses min-h (not a fixed height) so it can grow
                 with badge wrap. We mirror that min-h on the flex row and make
                 the image column the positioned ancestor so the absolutely-
                 positioned image fills the column's full stretched height
                 (default flex `items-stretch`) regardless of whether the card
                 grew past the minimum. */}
            <div className={cn("shrink-0 w-16 sm:w-20 overflow-hidden relative", emptyImageBgClass)}>
              <div className="absolute inset-0">
                {!previewImage && (
                  // Decorative half-logo bleed for compact cards (see standard
                  // layout for full rationale).
                  <img
                    src="/icon.svg"
                    alt=""
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none select-none absolute top-1/2 left-0 h-[120%] w-auto max-w-none -translate-y-1/2",
                      emptyImageLogoClass,
                    )}
                  />
                )}
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
                      src={thumbnail(previewImage, 160)}
                      alt={cache.name}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                      width={80}
                      height={120}
                    />
                  )
                )}
                {/* Icon at bottom left */}
                <div className="absolute bottom-1.5 left-1.5 z-10">
                  <div className="relative">
                    <div className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 ${isAdventureTheme ? '' : 'rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'} shadow-lg`}>
                      <CacheIcon type={cache.type} size="sm" className="w-3 h-3 sm:w-3.5 sm:h-3.5" theme={theme} isArt={isArt} />
                    </div>
                    {isHiddenByCreator && (
                      <div className="absolute -top-1 -right-1 w-[15px] h-[15px] bg-orange-500 rounded-full flex items-center justify-center shadow-md ring-1 ring-white dark:ring-slate-800">
                        <EyeOff className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                </div>
                {/* Found overlay */}
                {isFound && (
                  <div className="absolute inset-0 z-20 bg-green-500/40 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-white drop-shadow-md" />
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col p-2.5 sm:p-3">
              {/* Title row with action buttons */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-8 md:pr-0">
                  <h3 className="font-semibold leading-tight truncate group-hover:text-primary adventure:group-hover:text-red-900 transition-colors min-w-0" style={{ fontSize: cache.name.length > 20 ? '0.813rem' : '0.875rem' }}>
                    {cache.name}
                  </h3>
                  {renderUnsyncedBadge()}
                </div>
                {renderActionButtons("h-4 w-4 sm:h-5 sm:w-5", true, true)}
              </div>

              {/* Author info */}
              {renderAuthorInfo()}

              {/* Metadata for compact variant */}
              {metadata && (
                <p className="text-xs text-muted-foreground/80 mb-1.5">
                  {metadata}
                </p>
              )}

              {/* City name */}
              {renderCityName()}

              {/* Spacer to push badges to bottom */}
              <div className="flex-1 min-h-0"></div>

              {/* Bottom row with badges and stats */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-0.5 sm:gap-1 min-w-0">
                  {renderStatusBadge(true)}
                  <ModifierBadges cache={cache} size="compact" inline ftfClaimed={resolvedFtfClaimed} />
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
                    <Badge variant="default" className="flex items-center gap-0.5 bg-primary adventure:bg-stone-700 text-[10px] sm:text-xs py-0 px-1 sm:px-1.5 shrink-0">
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
