import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Compass, Share2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import L from "leaflet";
import { GeocacheMap } from "@/components/GeocacheMap";
import { CompactGeocacheCard } from "@/components/ui/geocache-card";
import { GeocachePopupCard } from "@/components/GeocachePopupCard";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/loading";
import { LoginArea } from "@/components/auth/LoginArea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExploreMenuItems } from "@/components/ExploreMenuItems";
import { useAdventure } from "@/hooks/useAdventure";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAdventureProgress } from "@/hooks/useAdventureProgress";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useToast } from "@/hooks/useToast";
import { useTheme } from "@/hooks/useTheme";

import type { Geocache } from "@/types/geocache";

export default function AdventureDetail() {
  const { t } = useTranslation();
  const { naddr } = useParams<{ naddr: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [selectedGeocache, setSelectedGeocache] = useState<Geocache | null>(null);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
  const [highlightedGeocache, setHighlightedGeocache] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  const { data: adventure, isLoading, isError } = useAdventure(naddr || '');
  const author = useAuthor(adventure?.pubkey);
  const authorName = author.data?.metadata?.name || adventure?.pubkey.slice(0, 8);

  // Progress tracking
  const geocacheRefs = adventure?.geocacheRefs || [];
  const { foundSet, totalFound, totalCaches } = useAdventureProgress(geocacheRefs);

  // Temporarily apply the adventure's page theme, revert on unmount.
  // Saves and restores the user's real localStorage preference so it isn't corrupted.
  useEffect(() => {
    if (!adventure?.theme) return;

    const storageKey = 'ui-theme';
    const savedTheme = localStorage.getItem(storageKey);
    const savedResolvedTheme = theme;

    setTheme(adventure.theme);

    // Explicitly sync the native status bar with the adventure's theme
    // AdventureTheme is always 'adventure' which uses a dark status bar
    const isDarkTheme = adventure.theme === 'adventure';
    document.documentElement.setAttribute('data-status-bar', isDarkTheme ? 'dark' : 'light');

    // Immediately restore localStorage so the user's preference isn't lost on crash/nav
    if (savedTheme) {
      localStorage.setItem(storageKey, savedTheme);
    } else {
      localStorage.removeItem(storageKey);
    }

    return () => {
      setTheme(savedResolvedTheme ?? 'system');
      // Let MobileHeader take over status bar management again
      const wasItDark = savedResolvedTheme === 'dark' || savedResolvedTheme === 'adventure';
      document.documentElement.setAttribute('data-status-bar', wasItDark ? 'dark' : 'light');
      // Restore localStorage again on cleanup (setTheme overwrites it)
      if (savedTheme) {
        localStorage.setItem(storageKey, savedTheme);
      } else {
        localStorage.removeItem(storageKey);
      }
    };
  }, [adventure?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const geocaches = adventure?.geocaches || [];

  // Map center for initial render — fitBounds handles the actual zoom
  const mapCenter = geocaches.length > 0
    ? {
        lat: geocaches.reduce((sum, g) => sum + g.location.lat, 0) / geocaches.length,
        lng: geocaches.reduce((sum, g) => sum + g.location.lng, 0) / geocaches.length,
      }
    : adventure?.location || undefined;

  const isOwner = user?.pubkey === adventure?.pubkey;

  const handleMarkerClick = (geocache: Geocache, container?: HTMLDivElement) => {
    if (!geocache && !container) {
      setSelectedGeocache(null);
      setPopupContainer(null);
      return;
    }
    setSelectedGeocache(geocache);
    setPopupContainer(container || null);
    setHighlightedGeocache(null);
  };

  const handleCardClick = (geocache: Geocache) => {
    if (isMobile && drawerOpen) {
      setDrawerOpen(false);
    }
    setHighlightedGeocache(null);
    queueMicrotask(() => {
      setHighlightedGeocache(geocache.dTag);
    });
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).handleMapCardClick) {
      ((window as unknown as Record<string, unknown>).handleMapCardClick as (loc: { lat: number; lng: number }, zoom: number) => void)(
        { lat: geocache.location.lat, lng: geocache.location.lng },
        18
      );
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: adventure?.title, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: t('adventureDetail.linkCopied') });
    }
  };

  // Fit map to geocache bounds — polls until map ref is available
  const lastFittedKey = useRef<string | null>(null);

  useEffect(() => {
    if (geocaches.length === 0) return;

    const key = `${naddr}:${geocaches.length}`;
    if (lastFittedKey.current === key) return;

    const interval = setInterval(() => {
      if (!mapRef.current) return;
      const bounds = L.latLngBounds(
        geocaches.map(g => [g.location.lat, g.location.lng] as [number, number])
      );
      mapRef.current.fitBounds(bounds.pad(0.05));
      lastFittedKey.current = key;
      clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [naddr, geocaches]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <PageLoading title={t('adventureDetail.loading')} size="lg" />
      </div>
    );
  }

  // Error / not found
  if (isError || !adventure) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <Compass className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">{t('adventureDetail.notFoundTitle')}</h2>
          <p className="text-muted-foreground">{t('adventureDetail.notFoundDescription')}</p>
          <Button asChild variant="outline">
            <Link to="/adventures">{t('common.browseAdventures')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const renderActionButtons = (iconSize = "h-4 w-4") => (
    <>
      {isOwner && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`/edit-adventure/${naddr}`)}
        >
          <Pencil className={iconSize} />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleShare}
      >
        <Share2 className={iconSize} />
      </Button>
    </>
  );

  const renderProgressBar = () => {
    if (!user || totalCaches === 0) return null;
    return (
      <div className="p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{t('adventureDetail.yourProgress')}</span>
          <span className="text-sm text-muted-foreground">{t('adventureDetail.found', { found: totalFound, total: totalCaches })}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-500"
            style={{ width: `${(totalFound / totalCaches) * 100}%` }}
          />
        </div>
      </div>
    );
  };

  const renderCacheList = () => (
    <div className="space-y-3">
      {geocaches.map((cache) => {
        const cacheKey = `${cache.kind || 37516}:${cache.pubkey}:${cache.dTag}`;
        const isFound = foundSet.has(cacheKey);

        return (
          <CompactGeocacheCard
            key={cache.id}
            cache={cache}
            onClick={() => handleCardClick(cache)}
            isFound={isFound}
          />
        );
      })}

      {geocaches.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">{t('adventureDetail.noTreasures')}</p>
        </div>
      )}
    </div>
  );

  const mapProps = {
    geocaches,
    userLocation: null,
    searchLocation: null,
    searchRadius: undefined,
    center: mapCenter,
    zoom: 13,
    onMarkerClick: handleMarkerClick,
    onSearchInView: undefined,
    highlightedGeocache: highlightedGeocache || undefined,
    showStyleSelector: true,
    isNearMeActive: false,
    isMapCenterLocked: true,
    initialMapStyle: adventure?.mapStyle,
  } as const;

  return (
    <div className="h-screen flex flex-col">
      {/* Desktop View — no header, full height like Map.tsx */}
      <div className="hidden lg:flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-96 border-r bg-background flex flex-col">
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Banner with logo, title + actions overlaid */}
            <div className="relative">
              {adventure.image ? (
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  <img
                    src={adventure.image}
                    alt={adventure.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
                </div>
              ) : (
                <div className="aspect-[2/1] bg-gradient-to-br from-primary/20 to-primary/5" />
              )}
              {/* Logo + actions floating in banner top */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-2">
                <Link to="/" className="flex items-center gap-1.5">
                  <img src="/icon.svg" alt="Treasures" className="h-7 w-7 drop-shadow-md" />
                  <span className={`text-sm font-bold drop-shadow-sm ${adventure.image ? 'text-white' : 'text-foreground'}`}>{t('navigation.appName')}</span>
                </Link>
                <div className="flex items-center gap-1">
                  {isOwner && (
                    <button
                      onClick={() => navigate(`/edit-adventure/${naddr}`)}
                      className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={handleShare}
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {/* Title + description overlaid at bottom of banner */}
              <div className={`absolute bottom-0 left-0 right-0 px-4 pb-3 ${adventure.image ? '[text-shadow:0_1px_4px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.4)]' : ''}`}>
                <h1 className={`text-lg font-bold leading-tight truncate ${adventure.image ? 'text-white' : 'text-foreground'}`}>{adventure.title}</h1>
                <div className={`flex items-center gap-2 text-xs mt-0.5 ${adventure.image ? 'text-white/90' : 'text-muted-foreground'}`}>
                  <span>{t('common.by')} {authorName}</span>
                  <span>&middot;</span>
                  <span>{t('common.treasure', { count: geocaches.length })}</span>
                </div>
                {adventure.description && (
                  <p className={`text-xs mt-2 line-clamp-3 ${adventure.image ? 'text-white/80' : 'text-muted-foreground'}`}>{adventure.description}</p>
                )}
              </div>
            </div>

            {/* Progress + cache list */}
            <div className="px-4 pb-4 pt-2 space-y-3">
              {renderProgressBar()}
              {renderCacheList()}
            </div>
          </div>
        </div>

        {/* Map — fills remaining space */}
        <div className="flex-1 relative min-h-0">
          {mapCenter && !isMobile && <GeocacheMap {...mapProps} mapRef={mapRef} />}

          {/* Floating nav controls — upper-right over the map, matches Map.tsx */}
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-background/90 backdrop-blur-sm shadow-md">
                  <Compass className="h-4 w-4 mr-1.5" />
                  {t('adventureDetail.explore')}
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ExploreMenuItems />
              </DropdownMenuContent>
            </DropdownMenu>
            <LoginArea compact />
          </div>
        </div>
      </div>

      {/* Mobile View — full-screen map with slide-down drawer */}
      <div className="block lg:hidden fixed inset-0 flex flex-col" style={{ top: 'calc(3rem + env(safe-area-inset-top, 0px))', bottom: 'calc(3rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Full-screen map */}
        <div className="flex-1 relative overflow-hidden">
          {mapCenter && isMobile && <GeocacheMap {...mapProps} mapRef={mapRef} />}

          {/* Floating header — fades out when drawer opens */}
          <div className={`absolute top-0 left-0 right-0 z-[999] border-b overflow-hidden transition-opacity duration-250 ${drawerOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {adventure.image && (
              <img
                src={adventure.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div
              onClick={() => setDrawerOpen(true)}
              className={`relative flex items-center gap-2 px-3 py-2 cursor-pointer ${adventure.image ? 'bg-black/50 backdrop-blur-sm' : 'bg-background/90 backdrop-blur-sm'}`}
            >
              <div className={`flex-shrink-0 ${adventure.image ? 'text-white/80' : 'text-muted-foreground'}`}>
                <ChevronDown className="h-4 w-4" />
              </div>
              <span className={`text-sm font-semibold truncate flex-1 ${adventure.image ? 'text-white' : ''}`}>{adventure.title}</span>
              <div
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center gap-1 flex-shrink-0 ${adventure.image ? '[&_button]:text-white/80 [&_button]:hover:text-white [&_button]:hover:bg-white/10' : ''}`}
              >
                {renderActionButtons("h-3.5 w-3.5")}
              </div>
            </div>
          </div>

          {/* Backdrop — fades in */}
          <div
            className={`absolute inset-0 z-[998] bg-black/40 transition-opacity duration-250 ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setDrawerOpen(false)}
          />

          {/* Slide-down drawer panel */}
          <div className={`absolute inset-0 z-[999] bg-background overflow-y-auto transition-transform duration-300 ease-out ${drawerOpen ? 'translate-y-0' : '-translate-y-full'}`}>
            {/* Banner with title + actions overlaid */}
            <div className="relative">
              {adventure.image ? (
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  <img
                    src={adventure.image}
                    alt={adventure.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
                </div>
              ) : (
                <div className="aspect-[2/1] bg-gradient-to-br from-primary/20 to-primary/5" />
              )}
              {/* Close + actions floating in banner top */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 pt-2">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1">
                  {isOwner && (
                    <button
                      onClick={() => navigate(`/edit-adventure/${naddr}`)}
                      className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={handleShare}
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {/* Title + description overlaid at bottom of banner */}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 [text-shadow:0_1px_4px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.4)]">
                <h1 className="text-base font-bold text-white leading-tight">{adventure.title}</h1>
                <div className="flex items-center gap-2 text-xs text-white/90 mt-0.5">
                  <span>{t('common.by')} {authorName}</span>
                  <span>&middot;</span>
                  <span>{t('common.treasure', { count: geocaches.length })}</span>
                </div>
                {adventure.description && (
                  <p className="text-xs mt-2 line-clamp-3 text-white/80">{adventure.description}</p>
                )}
              </div>
            </div>

            {/* Progress + cache list */}
            <div className="p-4 space-y-3 pb-8">
              {renderProgressBar()}
              {renderCacheList()}
            </div>
          </div>
        </div>
      </div>

      {/* React portal into Leaflet popup */}
      {selectedGeocache && popupContainer && createPortal(
        <GeocachePopupCard
          geocache={selectedGeocache}
          onClose={() => {
            setSelectedGeocache(null);
            setPopupContainer(null);
            if (mapRef.current) {
              mapRef.current.closePopup();
            }
          }}
        />,
        popupContainer
      )}
    </div>
  );
}
