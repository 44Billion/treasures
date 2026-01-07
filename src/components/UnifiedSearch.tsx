import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, MapPin, X, Package } from "lucide-react";
import { CompassSpinner } from "@/components/ui/loading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UnifiedSearchProps {
  onCacheSearch: (query: string) => void;
  onLocationSelect: (location: { lat: number; lng: number; name: string }) => void;
  placeholder?: string;
  mobilePlaceholder?: string;
  cacheQuery?: string;
}

interface SearchResult {
  type: 'location' | 'coordinates';
  name: string;
  lat: number;
  lng: number;
  resultType?: string;
  importance?: number;
  display_name?: string;
  warning?: string;
}

export function UnifiedSearch({
  onCacheSearch,
  onLocationSelect,
  placeholder = "Search caches or location...",
  mobilePlaceholder,
  cacheQuery = ""
}: UnifiedSearchProps) {
  const [query, setQuery] = useState(cacheQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholder);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const abortController = useRef<AbortController>();
  const inputRef = useRef<HTMLDivElement>(null);
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
    return () => window.removeEventListener('resize', updatePlaceholder);
  }, [placeholder, mobilePlaceholder]);

  // Sync external cache query
  useEffect(() => {
    setQuery(cacheQuery);
  }, [cacheQuery]);

  // Update dropdown position
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

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showResults && inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showResults]);

  const parseCoordinates = (input: string): { lat: number; lng: number; warning?: string } | null => {
    const cleaned = input.trim()
      .replace(/[,;]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/['′]/g, "'")
      .replace(/["″]/g, '"')
      .replace(/[°º]/g, '°');

    const patterns = [
      /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
      /^(\d+\.?\d*)\s*([NS])\s+(\d+\.?\d*)\s*([EW])$/i,
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

        if (!isNaN(lat) && !isNaN(lng)) {
          if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
            warning = '⚠️ Latitude appears invalid. Did you swap lat/lng?';
          } else if (Math.abs(lat) > 90) {
            warning = '⚠️ Latitude must be between -90 and 90';
          } else if (Math.abs(lng) > 180) {
            warning = '⚠️ Longitude must be between -180 and 180';
          }
          return { lat, lng, warning };
        }
      }
    }
    return null;
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      onCacheSearch('');
      return;
    }

    // Always update cache search
    onCacheSearch(searchQuery);

    // Check if it looks like a location search (has numbers, common location keywords, or is short)
    const looksLikeLocation = /\d/.test(searchQuery) || 
      /\b(city|zip|st|street|ave|avenue|road|rd|blvd|boulevard|near|in)\b/i.test(searchQuery) ||
      searchQuery.length < 4;

    if (looksLikeLocation) {
      setIsSearching(true);
      setShowResults(true);

      // Check for coordinates first
      const coords = parseCoordinates(searchQuery);
      if (coords) {
        setResults([{
          type: 'coordinates',
          name: `Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
          lat: coords.lat,
          lng: coords.lng,
          warning: coords.warning
        }]);
        setIsSearching(false);
        return;
      }

      // Cancel previous request
      if (abortController.current) {
        abortController.current.abort();
      }
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
            headers: { 'Accept': 'application/json' }
          }
        );

        if (!response.ok) throw new Error('Geocoding failed');

        const data = await response.json();
        const searchResults: SearchResult[] = data.map((item: Record<string, unknown>) => ({
          type: 'location' as const,
          name: (item.display_name as string)?.split(',')[0] || '',
          lat: parseFloat(item.lat as string),
          lng: parseFloat(item.lon as string),
          display_name: item.display_name as string,
          importance: item.importance as number,
          resultType: (item.type as string) || (item.class as string) || 'place'
        }));

        setResults(searchResults);
      } catch (error: unknown) {
        const errorObj = error as { name?: string };
        if (errorObj.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    } else {
      // Pure cache name search - no location results
      setShowResults(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      handleSearch(value);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      if (results.length > 0 && !isSearching) {
        const firstResult = results[0];
        if (firstResult) {
          handleResultClick(firstResult);
        }
      } else if (query.trim()) {
        handleSearch(query);
      }
    }
  };

  const handleResultClick = (result: SearchResult) => {
    onLocationSelect({
      lat: result.lat,
      lng: result.lng,
      name: result.display_name || result.name
    });
    setQuery('');
    onCacheSearch('');
    setShowResults(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    onCacheSearch('');
  };

  const getResultIcon = (type?: string) => {
    switch (type) {
      case 'postcode': return '📮';
      case 'city':
      case 'town':
      case 'village': return '🏘️';
      case 'country': return '🌍';
      default: return '📍';
    }
  };

  const renderDropdown = () => {
    if (!showResults || results.length === 0) return null;

    const dropdownContent = (
      <Card
        className="absolute max-h-64 overflow-y-auto shadow-lg"
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
              className="w-full text-left px-3 py-2 hover:bg-muted rounded flex items-start gap-2 transition-colors"
              onClick={() => handleResultClick(result)}
            >
              <span className="text-lg mt-0.5">{getResultIcon(result.resultType)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{result.name}</div>
                {result.display_name && result.display_name !== result.name && (
                  <div className="text-sm text-muted-foreground truncate">{result.display_name}</div>
                )}
                {result.warning && (
                  <div className="text-xs text-amber-600 mt-1">{result.warning}</div>
                )}
                <div className="text-xs text-muted-foreground">
                  {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                </div>
              </div>
              {result.resultType && result.type !== 'coordinates' && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {result.resultType}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </Card>
    );

    return createPortal(dropdownContent, document.body);
  };

  return (
    <div className="relative flex-1" ref={inputRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={currentPlaceholder}
          className="pl-10 pr-10 h-9"
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
