import { useState, useRef, useEffect } from "react";
import { Search, MapPin, X } from "lucide-react";
import { CompassSpinner } from "@/components/ui/loading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LocationSearchProps {
  onLocationSelect: (location: { lat: number; lng: number; name: string }) => void;
  placeholder?: string;
  mobilePlaceholder?: string;
}

interface SearchResult {
  name: string;
  lat: number;
  lng: number;
  type?: string;
  importance?: number;
  display_name?: string;
}

export function LocationSearch({
  onLocationSelect,
  placeholder = "Search by city, zip code, or coordinates...",
  mobilePlaceholder
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholder);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const abortController = useRef<AbortController>();

  // Update placeholder based on screen size
  useEffect(() => {
    const updatePlaceholder = () => {
      if (window.innerWidth < 640 && mobilePlaceholder) { // sm breakpoint
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

  const parseCoordinates = (input: string): { lat: number; lng: number } | null => {
    // Clean input: remove extra spaces, normalize separators
    const cleaned = input.trim()
      .replace(/[,;]/g, ' ')  // Replace commas and semicolons with spaces
      .replace(/\s+/g, ' ')   // Multiple spaces to single space
      .replace(/['′]/g, "'")  // Normalize apostrophes
      .replace(/["″]/g, '"')  // Normalize quotes
      .replace(/[°º]/g, '°'); // Normalize degree symbols

    // Try to parse various coordinate formats
    const patterns = [
      // Decimal degrees: 40.7128, -74.0060 or 40.7128 -74.0060
      /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
      // Degrees with N/S E/W: 40.7128N 74.0060W
      /^(\d+\.?\d*)\s*([NS])\s+(\d+\.?\d*)\s*([EW])$/i,
      // Degrees minutes seconds: 40°42'46"N 74°00'22"W
      /^(\d+)°(\d+)'(\d+\.?\d*)"?\s*([NS])\s+(\d+)°(\d+)'(\d+\.?\d*)"?\s*([EW])$/i,
      // Swapped lat/lng: -74.0060, 40.7128 (common mistake)
      /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let lat: number, lng: number;

        if (pattern === patterns[0] || pattern === patterns[3]) {
          // Simple decimal format
          lat = parseFloat(match[1] || '0');
          lng = parseFloat(match[2] || '0');

          // Auto-detect if coordinates are swapped
          // If "latitude" is > 90 or < -90, they're probably swapped
          if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
            [lat, lng] = [lng, lat];
          }
        } else if (pattern === patterns[1]) {
          // N/S E/W format
          lat = parseFloat(match[1] || '0') * (match[2]?.toUpperCase() === 'S' ? -1 : 1);
          lng = parseFloat(match[3] || '0') * (match[4]?.toUpperCase() === 'W' ? -1 : 1);
        } else if (pattern === patterns[2]) {
          // DMS format
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

        // Validate and autocorrect coordinates
        if (!isNaN(lat) && !isNaN(lng)) {
          // Clamp latitude to valid range
          if (lat > 90) lat = 90;
          if (lat < -90) lat = -90;

          // Wrap longitude to valid range
          while (lng > 180) lng -= 360;
          while (lng < -180) lng += 360;

          return { lat, lng };
        }
      }
    }

    return null;
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    // First check if it's coordinates
    const coords = parseCoordinates(searchQuery);
    if (coords && coords.lat >= -90 && coords.lat <= 90 && coords.lng >= -180 && coords.lng <= 180) {
      setResults([{
        name: `Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
        lat: coords.lat,
        lng: coords.lng,
        type: 'coordinates'
      }]);
      setIsSearching(false);
      return;
    }

    // Cancel previous request if any
    if (abortController.current) {
      abortController.current.abort();
    }

    // Create new abort controller
    abortController.current = new AbortController();

    // Use Nominatim API directly
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: searchQuery,
          format: 'json',
          limit: '5',
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

      const searchResults: SearchResult[] = data.map((item: unknown) => {
        const obj = item as Record<string, unknown>;
        return {
          name: (obj.display_name as string)?.split(',')[0] || '',
          lat: parseFloat(obj.lat as string),
          lng: parseFloat(obj.lon as string),
          display_name: obj.display_name as string,
          importance: obj.importance as number,
          type: (obj.type as string) || (obj.class as string) || 'place'
        };
      });

      setResults(searchResults);
      setIsSearching(false);
    } catch (error: unknown) {
      const errorObj = error as { name?: string };
      if (errorObj.name !== 'AbortError') {
        setResults([]);
      }
      setIsSearching(false);
    }
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
    }, 500);
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
    onLocationSelect({
      lat: result.lat,
      lng: result.lng,
      name: result.display_name || result.name
    });
    setQuery(result.name);
    setShowResults(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  const getResultIcon = (type?: string) => {
    switch (type) {
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

  return (
    <div className="relative w-full">
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

      {showResults && results.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto">
          <div className="p-1">
            {results.map((result, index) => (
              <button
                key={index}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-start gap-2 transition-colors"
                onClick={() => handleResultClick(result)}
              >
                <span className="text-lg mt-0.5">{getResultIcon(result.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{result.name}</div>
                  {result.display_name && result.display_name !== result.name && (
                    <div className="text-sm text-gray-600 truncate">{result.display_name}</div>
                  )}
                  <div className="text-xs text-gray-500">
                    {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                  </div>
                </div>
                {result.type && result.type !== 'coordinates' && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {result.type}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {showResults && !isSearching && results.length === 0 && query && (
        <Card className="absolute z-50 w-full mt-1">
          <div className="p-4 text-center text-gray-500">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No locations found</p>
            <p className="text-xs mt-1">Try searching for a city, zip code, or coordinates</p>
          </div>
        </Card>
      )}
    </div>
  );
}