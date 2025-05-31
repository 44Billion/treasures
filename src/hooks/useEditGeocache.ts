import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import type { Geocache } from '@/types/geocache';

interface EditGeocacheData {
  name: string;
  description: string;
  hint?: string;
  difficulty: number;
  terrain: number;
  size: string;
  type: string;
  images?: string[];
}

export function useEditGeocache(originalGeocache: Geocache | null) {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: EditGeocacheData) => {
      if (!originalGeocache) {
        throw new Error("No geocache to edit");
      }
      
      console.log('Editing geocache:', originalGeocache.id);
      
      // Validate data
      if (!data.name?.trim()) {
        throw new Error("Cache name is required");
      }
      if (!data.description?.trim()) {
        throw new Error("Cache description is required");
      }
      if (!data.difficulty || data.difficulty < 1 || data.difficulty > 5) {
        throw new Error("Difficulty must be between 1 and 5");
      }
      if (!data.terrain || data.terrain < 1 || data.terrain > 5) {
        throw new Error("Terrain must be between 1 and 5");
      }

      // Create the updated geocache event using tag-based format
      console.log('Publishing geocache edit with data:', { 
        name: data.name, 
        originalId: originalGeocache.id,
        originalDTag: originalGeocache.dTag,
      });

      // FIXED: Use the original d-tag for proper replacement
      // This ensures any edits will replace the original properly
      console.log('Using replacement strategy with original d-tag:', originalGeocache.dTag);
      
      // Extract geohash from original location
      const geohash = getGeohash(originalGeocache.location.lat, originalGeocache.location.lng);
      const locationStr = `${originalGeocache.location.lat.toFixed(6)}, ${originalGeocache.location.lng.toFixed(6)}`;

      // Build tags array
      const tags: string[][] = [
        ['d', originalGeocache.dTag], // Use original d-tag - this will replace it!
        ['name', data.name.trim()],
        ['g', geohash], // Geohash for location-based queries
        ['location', locationStr], // Human-readable location
        ['difficulty', data.difficulty.toString()],
        ['terrain', data.terrain.toString()],
        ['size', data.size],
        ['cache-type', data.type],
        ['status', 'active'], // Cache status
        ['published_at', Math.floor(originalGeocache.created_at).toString()], // Keep original publish time
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

      const event = await publishEvent({
        kind: 37515, // Geocache listing event
        content: data.description.trim(), // Plain text description in content
        tags,
      });

      return event;
    },
    onSuccess: (event) => {
      toast({
        title: "Geocache updated!",
        description: "Your geocache has been successfully updated.",
      });
      
      // Update the specific geocache in cache using both old and new keys
      const eventId = originalGeocache?.id;
      const dTag = originalGeocache?.dTag;
      
      if (eventId) {
        queryClient.setQueryData(['geocache', eventId], (oldData: unknown) => {
          if (!oldData || !originalGeocache) return oldData;
          
          // Parse from tags
          const name = event.tags.find(t => t[0] === 'name')?.[1];
          const difficulty = parseInt(event.tags.find(t => t[0] === 'difficulty')?.[1] || '1');
          const terrain = parseInt(event.tags.find(t => t[0] === 'terrain')?.[1] || '1');
          const size = event.tags.find(t => t[0] === 'size')?.[1] as "micro" | "small" | "regular" | "large";
          const type = event.tags.find(t => t[0] === 'cache-type')?.[1] as "traditional" | "multi" | "mystery" | "earth" | "virtual" | "letterbox" | "event";
          const hint = event.tags.find(t => t[0] === 'hint')?.[1];
          const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);
          
          return {
            ...oldData,
            // Update event ID since replaceable events get new IDs
            id: event.id,
            // Update with new content but keep dTag stable
            name: name || 'Unnamed Cache',
            description: event.content, // Description is now in content field
            hint,
            difficulty,
            terrain,
            size: size || 'regular',
            type: type || 'traditional',
            images,
          };
        });
      }

      if (dTag) {
        queryClient.setQueryData(['geocache-by-dtag', dTag], (oldData: unknown) => {
          if (!oldData || !originalGeocache) return oldData;
          
          // Parse from tags
          const name = event.tags.find(t => t[0] === 'name')?.[1];
          const difficulty = parseInt(event.tags.find(t => t[0] === 'difficulty')?.[1] || '1');
          const terrain = parseInt(event.tags.find(t => t[0] === 'terrain')?.[1] || '1');
          const size = event.tags.find(t => t[0] === 'size')?.[1] as "micro" | "small" | "regular" | "large";
          const type = event.tags.find(t => t[0] === 'cache-type')?.[1] as "traditional" | "multi" | "mystery" | "earth" | "virtual" | "letterbox" | "event";
          const hint = event.tags.find(t => t[0] === 'hint')?.[1];
          const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);
          
          return {
            ...oldData,
            // Update event ID since replaceable events get new IDs
            id: event.id,
            // Update with new content but keep dTag stable
            name: name || 'Unnamed Cache',
            description: event.content, // Description is now in content field
            hint,
            difficulty,
            terrain,
            size: size || 'regular',
            type: type || 'traditional',
            images,
          };
        });
      }
      
      // Also update the geocaches list
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      
      // Background refresh after a short delay for both cache keys
      setTimeout(() => {
        if (eventId) {
          queryClient.invalidateQueries({ queryKey: ['geocache', eventId] });
          // Also refresh with new event ID
          queryClient.invalidateQueries({ queryKey: ['geocache', event.id] });
        }
        if (dTag) {
          queryClient.invalidateQueries({ queryKey: ['geocache-by-dtag', dTag] });
        }
      }, 2000);
    },
    onError: (error: unknown) => {
      console.error('Failed to edit geocache:', error);
      
      let errorMessage = "Please try again later.";
      
      if (error instanceof Error && error.message) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'toString' in error) {
        const errorStr = error.toString();
        if (errorStr.includes("timeout")) {
          errorMessage = "Connection timeout. Please check your internet connection.";
        } else if (errorStr.includes("User rejected")) {
          errorMessage = "You cancelled the event signing.";
        }
      }
      
      toast({
        title: "Failed to update geocache",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}

// Simple geohash implementation for location-based queries (same as create)
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