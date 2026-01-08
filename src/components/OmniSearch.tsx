import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, MapPin, X, Package } from "lucide-react";
import { CompassSpinner } from "@/components/ui/loading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Geocache } from "@/types/geocache";

interface OmniSearchProps {
  onLocationSelect: (location: { lat: number; lng: number; name: string }) => void;
  onGeocacheSelect: (geocache: Geocache) => void;
  onTextSearch: (query: string) => void;
  geocaches: Geocache[];
  placeholder?: string;
  mobilePlaceholder?: string;
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
  mobilePlaceholder
}: OmniSearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholder);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const abortController = useRef<AbortController>();
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
      if (inputRef.current && showResults) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
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
  }, [showResults]);

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

  const searchGeocaches = (searchQuery: string): GeocacheResult[] => {
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

  const searchLocations = async (searchQuery: string): Promise<LocationResult[]> => {
    // Cancel previous request if any
    if (abortController.current) {
      abortController.current.abort();
    }

    // Create new abort controller
    abortController.current = new AbortController();

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
          signal: abortController.current.signal,
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

    // Search both geocaches and locations in parallel
    const [geocacheResults, locationResults] = await Promise.all([
      Promise.resolve(searchGeocaches(searchQuery)),
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
    if (e.key === 'Enter') {
      e.preventDefault();

      // Clear timeout to prevent double search
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
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
    } else {
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
      return <Package className="h-4 w-4 text-primary" />;
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
              zIndex: 9999,
            }}
          >
            <div className="p-1">
              {results.map((result, index) => (
                <button
                  key={index}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex items-start gap-2 transition-colors"
                  onClick={() => handleResultClick(result)}
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
                      Cache
                    </Badge>
                  ) : result.locationtype && result.locationtype !== 'coordinates' ? (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {result.locationtype}
                    </Badge>
                  ) : null}
                </button>
              ))}
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
              zIndex: 9999,
            }}
          >
            <div className="p-4 text-center text-gray-500">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try searching for a cache name, city, zip code, or coordinates</p>
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
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={currentPlaceholder}
          className="pl-10 pr-10"
          onFocus={() => query && handleSearch(query)}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <CompassSpinner size={16} variant="component" />
          </div>
        )}
        {query && !isSearching && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
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
