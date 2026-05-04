import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, X } from "lucide-react";
import { chest } from '@lucide/lab';
import { NRelay1 } from '@nostrify/nostrify';
import { CompassSpinner } from "@/components/ui/loading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getEffectiveSearchRelays } from "@/lib/appRelays";
import { useAppContext } from "@/hooks/useAppContext";
import { TIMEOUTS } from "@/config";
import { NIP_GC_KINDS, parseGeocacheEvent } from "@/utils/nip-gc";
import type { Geocache } from "@/types/geocache";

const ChestIcon = ({ className, ...props }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {chest.map(([element, attrs], index) => {
      const Element = element as React.ElementType;
      const { key, ...restAttrs } = attrs as Record<string, unknown>;
      return <Element key={key as string || index} {...restAttrs} />;
    })}
  </svg>
);

interface OmniSearchProps {
  onLocationSelect: (location: { lat: number; lng: number; name: string }) => void;
  onGeocacheSelect: (geocache: Geocache) => void;
  onTextSearch: (query: string) => void;
  geocaches: Geocache[];
  placeholder?: string;
  mobilePlaceholder?: string;
  containerRef?: React.RefObject<HTMLElement | null>;
}

interface LocationResult {
  type: 'location';
  name: string;
  lat: number;
  lng: number;
  display_name?: string;
  importance?: number;
  locationtype?: string;
  warning?: string;
}

interface GeocacheResult {
  type: 'geocache';
  geocache: Geocache;
}

type SearchResult = LocationResult | GeocacheResult;

export function OmniSearch({
  onLocationSelect,
  onGeocacheSelect,
  onTextSearch,
  geocaches,
  placeholder = "Search caches, locations, or coordinates...",
  mobilePlaceholder,
  containerRef
}: OmniSearchProps) {
  const navigate = useNavigate();
  const { config } = useAppContext();
  const searchRelays = getEffectiveSearchRelays(config.searchRelayMetadata?.relays, config.useAppSearchRelays);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const listboxId = useRef(`omnisearch-listbox-${Math.random().toString(36).slice(2, 9)}`).current;

  // Reset keyboard highlight whenever the result set changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  // Scroll the active option into view when keyboard navigation moves it
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = document.getElementById(`${listboxId}-opt-${activeIndex}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listboxId]);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholder);
  const searchTimeout = useRef<NodeJS.Timeout>(undefined);
  const abortController = useRef<AbortController>(undefined);
  const locationAbortController = useRef<AbortController>(undefined);
  const inputRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Update placeholder based on screen size
  useEffect(() => {
    const updatePlaceholder = () => {
      if (window.innerWidth < 640 && mobilePlaceholder) {
        setCurrentPlaceholder(mobilePlaceholder);
      } else {
        setCurrentPlaceholder(placeholder);
      }
    };

    updatePlaceholder();
    window.addEventListener('resize', updatePlaceholder);

    return () => {
      window.removeEventListener('resize', updatePlaceholder);
    };
  }, [placeholder, mobilePlaceholder]);

  // Update dropdown position when showing results or on scroll/resize
  useEffect(() => {
    const updatePosition = () => {
      if (!showResults) return;
      // Use containerRef for width/left if provided, inputRef for vertical position
      const widthEl = containerRef?.current || inputRef.current;
      const posEl = inputRef.current;
      if (widthEl && posEl) {
        const widthRect = widthEl.getBoundingClientRect();
        const posRect = posEl.getBoundingClientRect();
        setDropdownPosition({
          top: posRect.bottom + window.scrollY,
          left: widthRect.left + window.scrollX,
          width: widthRect.width,
        });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showResults, containerRef]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside both the input and the dropdown
      const isOutsideInput = inputRef.current && !inputRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);

      if (showResults && isOutsideInput && isOutsideDropdown) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showResults]);

  const parseCoordinates = (input: string): { lat: number; lng: number; warning?: string } | null => {
    // Clean input: remove extra spaces, normalize separators
    const cleaned = input.trim()
      .replace(/[,;]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/['′]/g, "'")
      .replace(/["″]/g, '"')
      .replace(/[°º]/g, '°');

    // Try to parse various coordinate formats
    const patterns = [
      // Decimal degrees: 40.7128, -74.0060 or 40.7128 -74.0060
      /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
      // Degrees with N/S E/W: 40.7128N 74.0060W
      /^(\d+\.?\d*)\s*([NS])\s+(\d+\.?\d*)\s*([EW])$/i,
      // Degrees minutes seconds: 40°42'46"N 74°00'22"W
      /^(\d+)°(\d+)'(\d+\.?\d*)"?\s*([NS])\s+(\d+)°(\d+)'(\d+\.?\d*)"?\s*([EW])$/i,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let lat: number, lng: number;
        let warning: string | undefined;

        if (pattern === patterns[0]) {
          lat = parseFloat(match[1] || '0');
          lng = parseFloat(match[2] || '0');
        } else if (pattern === patterns[1]) {
          lat = parseFloat(match[1] || '0') * (match[2]?.toUpperCase() === 'S' ? -1 : 1);
          lng = parseFloat(match[3] || '0') * (match[4]?.toUpperCase() === 'W' ? -1 : 1);
        } else if (pattern === patterns[2]) {
          const latDeg = parseInt(match[1] || '0');
          const latMin = parseInt(match[2] || '0');
          const latSec = parseFloat(match[3] || '0');
          const latDir = match[4]?.toUpperCase() === 'S' ? -1 : 1;

          const lngDeg = parseInt(match[5] || '0');
          const lngMin = parseInt(match[6] || '0');
          const lngSec = parseFloat(match[7] || '0');
          const lngDir = match[8]?.toUpperCase() === 'W' ? -1 : 1;

          lat = (latDeg + latMin / 60 + latSec / 3600) * latDir;
          lng = (lngDeg + lngMin / 60 + lngSec / 3600) * lngDir;
        } else {
          continue;
        }

        // Validate coordinates and generate warnings
        if (!isNaN(lat) && !isNaN(lng)) {
          if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
            warning = '⚠️ Latitude appears invalid (must be between -90 and 90). Did you swap lat/lng?';
          } else if (Math.abs(lat) > 90) {
            warning = '⚠️ Latitude must be between -90 and 90 degrees';
          } else if (Math.abs(lng) > 180) {
            warning = '⚠️ Longitude must be between -180 and 180 degrees';
          } else if (Math.abs(lat) < 1 && Math.abs(lng) < 1) {
            warning = '⚠️ Coordinates near 0,0 (Gulf of Guinea). Is this correct?';
          }

          return { lat, lng, warning };
        }
      }
    }

    return null;
  };

  const searchGeocachesLocal = (searchQuery: string): GeocacheResult[] => {
    if (!searchQuery.trim()) return [];

    const searchLower = searchQuery.toLowerCase();
    const matchingCaches = geocaches.filter(cache =>
      cache.name.toLowerCase().includes(searchLower) ||
      cache.description.toLowerCase().includes(searchLower)
    );

    return matchingCaches.slice(0, 3).map(cache => ({
      type: 'geocache' as const,
      geocache: cache
    }));
  };

  const searchGeocachesRelay = async (searchQuery: string, signal: AbortSignal): Promise<GeocacheResult[]> => {
    if (!searchQuery.trim()) return [];

    const results: GeocacheResult[] = [];
    const seenIds = new Set<string>();

    // Query all search relays in parallel
    const relayPromises = searchRelays.map(async (url) => {
      try {
        const relay = new NRelay1(url);
        try {
          const events = await relay.query(
            [{ kinds: [NIP_GC_KINDS.GEOCACHE], search: searchQuery, limit: 5 }],
            { signal },
          );
          for (const event of events) {
            if (seenIds.has(event.id)) continue;
            seenIds.add(event.id);
            const geocache = parseGeocacheEvent(event);
            if (geocache) {
              results.push({ type: 'geocache' as const, geocache });
            }
          }
        } finally {
          relay.close();
        }
      } catch (error: unknown) {
        const errorObj = error as { name?: string };
        if (errorObj.name !== 'AbortError') {
          console.warn(`NIP-50 search failed on ${url}:`, error);
        }
      }
    });

    await Promise.allSettled(relayPromises);
    return results.slice(0, 5);
  };

  const searchGeocaches = async (searchQuery: string, signal: AbortSignal): Promise<GeocacheResult[]> => {
    // Start with local results for instant feedback
    const localResults = searchGeocachesLocal(searchQuery);
    const seenIds = new Set(localResults.map(r => r.geocache.id));

    // Fetch relay results and merge, deduplicating
    const relayResults = await searchGeocachesRelay(searchQuery, signal);
    for (const result of relayResults) {
      if (!seenIds.has(result.geocache.id)) {
        seenIds.add(result.geocache.id);
        localResults.push(result);
      }
    }

    return localResults.slice(0, 5);
  };

  const searchLocations = async (searchQuery: string): Promise<LocationResult[]> => {
    // Cancel previous location request if any
    if (locationAbortController.current) {
      locationAbortController.current.abort();
    }

    // Create new abort controller for location search
    locationAbortController.current = new AbortController();

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: searchQuery,
          format: 'json',
          limit: '3',
          addressdetails: '1'
        }),
        {
          signal: locationAbortController.current.signal,
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();

      return data.map((item: unknown) => {
        const obj = item as Record<string, unknown>;
        return {
          type: 'location' as const,
          name: (obj.display_name as string)?.split(',')[0] || '',
          lat: parseFloat(obj.lat as string),
          lng: parseFloat(obj.lon as string),
          display_name: obj.display_name as string,
          importance: obj.importance as number,
          locationtype: (obj.type as string) || (obj.class as string) || 'place'
        };
      });
    } catch (error: unknown) {
      const errorObj = error as { name?: string };
      if (errorObj.name !== 'AbortError') {
        console.error('Location search error:', error);
      }
      return [];
    }
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      // Trigger text search with empty query to clear filters
      onTextSearch("");
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    // First check if it's coordinates
    const coords = parseCoordinates(searchQuery);
    if (coords) {
      setResults([{
        type: 'location',
        name: `Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
        lat: coords.lat,
        lng: coords.lng,
        locationtype: 'coordinates',
        warning: coords.warning
      }]);
      setIsSearching(false);
      return;
    }

    // Cancel previous request if any
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();
    const signal = AbortSignal.any([
      abortController.current.signal,
      AbortSignal.timeout(TIMEOUTS.QUERY),
    ]);

    // Search both geocaches and locations in parallel
    const [geocacheResults, locationResults] = await Promise.all([
      searchGeocaches(searchQuery, signal),
      searchLocations(searchQuery)
    ]);

    // Combine and prioritize results
    // If we have geocache matches, show them first
    // Otherwise, show location results
    const combinedResults: SearchResult[] = [];

    if (geocacheResults.length > 0) {
      combinedResults.push(...geocacheResults);
    }

    if (locationResults.length > 0) {
      combinedResults.push(...locationResults);
    }

    setResults(combinedResults);
    setIsSearching(false);

    // Trigger text search for filtering the list
    onTextSearch(searchQuery);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Set new timeout for debounced search
    searchTimeout.current = setTimeout(() => {
      handleSearch(value);
    }, 300); // Reduced from 500ms for snappier response
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape closes the dropdown
    if (e.key === 'Escape') {
      if (showResults) {
        e.preventDefault();
        setShowResults(false);
        setActiveIndex(-1);
      }
      return;
    }

    // Arrow navigation through results
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.length === 0) return;
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((prev) => {
        const next = prev + delta;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
      if (!showResults) setShowResults(true);
      return;
    }

    if (e.key === 'Home') {
      if (results.length > 0) {
        e.preventDefault();
        setActiveIndex(0);
      }
      return;
    }

    if (e.key === 'End') {
      if (results.length > 0) {
        e.preventDefault();
        setActiveIndex(results.length - 1);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      // Clear timeout to prevent double search
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      // If a result is highlighted via keyboard, select it
      if (activeIndex >= 0 && activeIndex < results.length) {
        const chosen = results[activeIndex];
        if (chosen) {
          handleResultClick(chosen);
          return;
        }
      }

      // If we have results, select the first one
      if (results.length > 0 && !isSearching) {
        const firstResult = results[0];
        if (firstResult) {
          handleResultClick(firstResult);
        }
      } else if (query.trim()) {
        // Otherwise trigger immediate search
        handleSearch(query);
      }
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'location') {
      onLocationSelect({
        lat: result.lat,
        lng: result.lng,
        name: result.display_name || result.name
      });
    } else if (result.geocache.naddr) {
      // Navigate directly to the geocache detail page
      navigate(`/${result.geocache.naddr}`);
    } else {
      // Fallback: pan map to geocache if no naddr available
      onGeocacheSelect(result.geocache);
    }

    // Clear the search query and text search filter when selecting any result
    // This prevents filtering the cache list after a selection is made
    setQuery("");
    onTextSearch("");
    setShowResults(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    onTextSearch("");
  };

  const getResultIcon = (result: SearchResult) => {
    if (result.type === 'geocache') {
      return <ChestIcon className="h-4 w-4 text-primary" />;
    }

    switch (result.locationtype) {
      case 'coordinates':
        return '📍';
      case 'postcode':
        return '📮';
      case 'city':
      case 'town':
      case 'village':
        return '🏘️';
      case 'country':
        return '🌍';
      case 'state':
      case 'county':
        return '📍';
      default:
        return '📍';
    }
  };

  const renderDropdown = () => {
    if (!showResults) return null;

    // Z-index hierarchy:
    // - Leaflet map: 0
    // - Map controls (zoom, style): 1000
    // - Search overlay in map: 1000
    // - Dropdown menus (account, etc): 9999
    // - OmniSearch dropdown: 10000 (highest - needs to be above all UI)
    const dropdownContent = (
      <>
        {results.length > 0 && (
          <Card
            ref={dropdownRef}
            className="absolute max-h-96 overflow-y-auto shadow-lg"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              marginTop: '4px',
              zIndex: 10000,
            }}
          >
            <div className="p-1" role="listbox" id={listboxId}>
              {results.map((result, index) => {
                const optId = `${listboxId}-opt-${index}`;
                const isActive = index === activeIndex;
                return (
                <button
                  key={index}
                  id={optId}
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded flex items-start gap-2 transition-colors",
                    isActive
                      ? "bg-primary/10 dark:bg-primary/20"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                  onClick={() => handleResultClick(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="text-lg mt-0.5 shrink-0">
                    {typeof getResultIcon(result) === 'string' ? (
                      getResultIcon(result)
                    ) : (
                      getResultIcon(result)
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    {result.type === 'geocache' ? (
                      <>
                        <div className="font-medium truncate">{result.geocache.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {result.geocache.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {result.geocache.location.lat.toFixed(4)}, {result.geocache.location.lng.toFixed(4)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium truncate">{result.name}</div>
                        {result.display_name && result.display_name !== result.name && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {result.display_name}
                          </div>
                        )}
                        {result.warning && (
                          <div className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                            <span className="shrink-0">{result.warning}</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                        </div>
                      </>
                    )}
                  </div>
                  {result.type === 'geocache' ? (
                    <Badge variant="default" className="text-xs shrink-0">
                      Treasure
                    </Badge>
                  ) : result.locationtype && result.locationtype !== 'coordinates' ? (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {result.locationtype}
                    </Badge>
                  ) : null}
                </button>
                );
              })}
            </div>
          </Card>
        )}

        {!isSearching && results.length === 0 && query && (
          <Card
            ref={dropdownRef}
            className="absolute shadow-lg"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              marginTop: '4px',
              zIndex: 10000,
            }}
          >
            <div className="p-4 text-center text-gray-500">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try searching for a treasure name, city, zip code, or coordinates</p>
            </div>
          </Card>
        )}
      </>
    );

    return createPortal(dropdownContent, document.body);
  };

  return (
    <div className="relative w-full" ref={inputRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={currentPlaceholder}
          className={cn("h-10 lg:h-9 pl-8", query ? "pr-8" : "pr-3")}
          onFocus={() => query && handleSearch(query)}
          role="combobox"
          aria-expanded={showResults && results.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          aria-label={placeholder}
        />
        {isSearching && (
          <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2">
            <CompassSpinner size={16} variant="component" />
          </div>
        )}
        {query && !isSearching && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {renderDropdown()}
    </div>
  );
}
