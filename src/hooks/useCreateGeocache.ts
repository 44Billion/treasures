import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { getGeocachingRelays } from '@/lib/relays';
import type { CreateGeocacheData } from '@/types/geocache';

export function useCreateGeocache() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateGeocacheData) => {
      // Validate data
      if (!data.name?.trim()) {
        throw new Error("Cache name is required");
      }
      if (!data.description?.trim()) {
        throw new Error("Cache description is required");
      }
      if (!data.location || typeof data.location.lat !== 'number' || typeof data.location.lng !== 'number') {
        throw new Error("Valid location coordinates are required");
      }
      if (!data.difficulty || data.difficulty < 1 || data.difficulty > 5) {
        throw new Error("Difficulty must be between 1 and 5");
      }
      if (!data.terrain || data.terrain < 1 || data.terrain > 5) {
        throw new Error("Terrain must be between 1 and 5");
      }

      // Create the geocache event using tag-based format
      const dTag = `${data.name.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const geohash = getGeohash(data.location.lat, data.location.lng);
      const locationStr = `${data.location.lat.toFixed(6)}, ${data.location.lng.toFixed(6)}`;

      console.log('Creating geocache with data:', { 
        name: data.name, 
        location: data.location,
        dTag 
      });

      // Build tags array
      const tags: string[][] = [
        ['d', dTag], // Unique identifier
        ['name', data.name.trim()],
        ['g', geohash], // Geohash for location-based queries
        ['location', locationStr], // Human-readable location
        ['difficulty', data.difficulty.toString()],
        ['terrain', data.terrain.toString()],
        ['size', data.size],
        ['cache-type', data.type],
        ['status', 'active'], // Cache status
        ['published_at', Math.floor(Date.now() / 1000).toString()], // When cache was hidden
      ];

      // Add optional tags
      if (data.hint?.trim()) {
        // Store hint as plaintext for better user experience
        tags.push(['hint', data.hint.trim()]);
      }

      if (data.images && data.images.length > 0) {
        data.images.forEach(image => {
          tags.push(['image', image]);
        });
      }

      // Add type-specific hashtags
      if (data.type === 'mystery') tags.push(['t', 'mystery']);
      if (data.type === 'multi') tags.push(['t', 'multi']);
      if (data.type === 'earth') tags.push(['t', 'earth']);

      // Add relay preferences from user settings
      const relayPreferences = getGeocachingRelays();

      // Add relay tags in order of preference
      relayPreferences.forEach(relay => {
        tags.push(['relay', relay]);
      });

      const event = await publishEvent({
        kind: 37515, // Geocache listing event
        content: data.description.trim(), // Plain text description in content
        tags,
      });

      return event;
    },
    onSuccess: (event) => {
      toast({
        title: "Geocache created!",
        description: "Your geocache has been successfully hidden.",
      });
      
      // Optimistically update the cache with the new geocache
      queryClient.setQueryData(['geocache', event.id], () => {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1];
        const name = event.tags.find(t => t[0] === 'name')?.[1];
        const difficulty = parseInt(event.tags.find(t => t[0] === 'difficulty')?.[1] || '1');
        const terrain = parseInt(event.tags.find(t => t[0] === 'terrain')?.[1] || '1');
        const size = event.tags.find(t => t[0] === 'size')?.[1] as "micro" | "small" | "regular" | "large";
        const type = event.tags.find(t => t[0] === 'cache-type')?.[1] as "traditional" | "multi" | "mystery" | "earth" | "virtual" | "letterbox" | "event";
        const hint = event.tags.find(t => t[0] === 'hint')?.[1];
        const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);
        const locationTag = event.tags.find(t => t[0] === 'location')?.[1];
        
        // Parse location from tag
        let location = { lat: 0, lng: 0 };
        if (locationTag) {
          const [latStr, lngStr] = locationTag.split(',').map(s => s.trim());
          location = {
            lat: parseFloat(latStr),
            lng: parseFloat(lngStr)
          };
        }
        
        return {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          dTag: dTag || `geocache-${Date.now()}`, // Store the d-tag
          name: name || 'Unnamed Cache',
          description: event.content, // Description is now in content field
          hint,
          location,
          difficulty,
          terrain,
          size: size || 'regular',
          type: type || 'traditional',
          images,
          foundCount: 0,
          logCount: 0,
        };
      });
      
      // Also update the geocaches list
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      
      // Navigate to the new geocache using d-tag (stable URL)
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      if (dTag) {
        navigate(`/cache/${dTag}`);
      }
      
      // Background refresh after navigation to ensure data consistency
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['geocache-by-dtag', dTag] });
        queryClient.invalidateQueries({ queryKey: ['geocache', event.id] });
      }, 2000);
    },
    onError: (error: unknown) => {
      console.error('Failed to create geocache:', error);
      
      let errorMessage = "Please try again later.";
      const errorObj = error as { message?: string };
      
      if (errorObj.message) {
        errorMessage = errorObj.message;
      } else if (String(error).includes("timeout")) {
        errorMessage = "Connection timeout. Please check your internet connection.";
      } else if (String(error).includes("User rejected")) {
        errorMessage = "You cancelled the event signing.";
      }
      
      toast({
        title: "Failed to create geocache",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}

// Simple geohash implementation for location-based queries
function getGeohash(lat: number, lng: number, precision: number = 6): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      // longitude
      const mid = (lngMin + lngMax) / 2;
      if (lng > mid) {
        idx |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      // latitude
      const mid = (latMin + latMax) / 2;
      if (lat > mid) {
        idx |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    evenBit = !evenBit;

    if (bit < 4) {
      bit++;
    } else {
      geohash += base32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}