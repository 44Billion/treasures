import { useState, useRef, useEffect } from "react";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import L from "leaflet";
import "leaflet-control-geocoder";

interface LocationSearchProps {
  onLocationSelect: (location: { lat: number; lng: number; name: string }) => void;
  placeholder?: string;
}

interface SearchResult {
  name: string;
  lat: number;
  lng: number;
  type?: string;
  importance?: number;
  display_name?: string;
}

export function LocationSearch({ onLocationSelect, placeholder = "Search by city, zip code, or coordinates..." }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const geocoder = useRef<any>(null);

  useEffect(() => {
    // Initialize the geocoder
    geocoder.current = (L.Control as any).Geocoder.nominatim({
      geocodingQueryParams: {
        countrycodes: '', // Search worldwide
        limit: 5,
      }
    });
  }, []);

  const parseCoordinates = (input: string): { lat: number; lng: number } | null => {
    // Try to parse various coordinate formats
    const patterns = [
      // Decimal degrees: 40.7128, -74.0060
      /^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/,
      // Degrees with N/S E/W: 40.7128N 74.0060W
      /^(\d+\.?\d*)\s*([NS])\s+(\d+\.?\d*)\s*([EW])$/i,
      // Degrees minutes seconds: 40°42'46"N 74°00'22"W
      /^(\d+)°(\d+)'(\d+\.?\d*)"?\s*([NS])\s+(\d+)°(\d+)'(\d+\.?\d*)"?\s*([EW])$/i,
    ];

    for (const pattern of patterns) {
      const match = input.trim().match(pattern);
      if (match) {
        if (pattern === patterns[0]) {
          // Simple decimal format
          return {
            lat: parseFloat(match[1]),
            lng: parseFloat(match[2])
          };
        } else if (pattern === patterns[1]) {
          // N/S E/W format
          const lat = parseFloat(match[1]) * (match[2].toUpperCase() === 'S' ? -1 : 1);
          const lng = parseFloat(match[3]) * (match[4].toUpperCase() === 'W' ? -1 : 1);
          return { lat, lng };
        } else if (pattern === patterns[2]) {
          // DMS format
          const latDeg = parseInt(match[1]);
          const latMin = parseInt(match[2]);
          const latSec = parseFloat(match[3]);
          const latDir = match[4].toUpperCase() === 'S' ? -1 : 1;
          
          const lngDeg = parseInt(match[5]);
          const lngMin = parseInt(match[6]);
          const lngSec = parseFloat(match[7]);
          const lngDir = match[8].toUpperCase() === 'W' ? -1 : 1;
          
          const lat = (latDeg + latMin / 60 + latSec / 3600) * latDir;
          const lng = (lngDeg + lngMin / 60 + lngSec / 3600) * lngDir;
          
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

    // Otherwise, use geocoding service
    try {
      geocoder.current.geocode(searchQuery, (results: any[]) => {
        const searchResults: SearchResult[] = results.map(r => ({
          name: r.name,
          lat: r.center.lat,
          lng: r.center.lng,
          display_name: r.properties?.display_name || r.name,
          importance: r.properties?.importance || 0,
          type: r.properties?.type || 'place'
        }));
        
        setResults(searchResults);
        setIsSearching(false);
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      setResults([]);
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
          placeholder={placeholder}
          className="pl-10 pr-10"
          onFocus={() => query && handleSearch(query)}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
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