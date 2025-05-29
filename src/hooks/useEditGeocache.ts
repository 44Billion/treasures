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

      // Create the updated geocache event content
      const content = JSON.stringify({
        name: data.name.trim(),
        description: data.description.trim(),
        hint: data.hint?.trim() || "",
        location: originalGeocache.location, // Keep original location
        difficulty: data.difficulty,
        terrain: data.terrain,
        size: data.size,
        type: data.type,
        images: data.images || [],
      });

      console.log('Publishing geocache edit with data:', { 
        name: data.name, 
        originalId: originalGeocache.id,
        originalDTag: originalGeocache.dTag,
        contentLength: content.length 
      });

      // FIXED: Use the original d-tag for proper replacement
      // This ensures any edits will replace the original properly
      console.log('Using replacement strategy with original d-tag:', originalGeocache.dTag);
      
      // Extract geohash from original location
      const geohash = getGeohash(originalGeocache.location.lat, originalGeocache.location.lng);

      const event = await publishEvent({
        kind: 37515, // Geocache listing event
        content,
        tags: [
          ['d', originalGeocache.dTag], // Use original d-tag - this will replace it!
          ['g', geohash], // Geohash for location-based queries
          ['location', `${originalGeocache.location.lat.toFixed(6)}, ${originalGeocache.location.lng.toFixed(6)}`], // Human-readable location
          ['status', 'active'], // Cache status
          ['published_at', Math.floor(originalGeocache.created_at).toString()], // Keep original publish time
          ...(data.type === 'mystery' ? [['t', 'mystery']] : []),
          ...(data.type === 'multi' ? [['t', 'multi']] : []),
          ...(data.type === 'earth' ? [['t', 'earth']] : []),
        ],
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
          
          try {
            const content = JSON.parse(event.content);
            return {
              ...oldData,
              // Update event ID since replaceable events get new IDs
              id: event.id,
              // Update with new content but keep dTag stable
              name: content.name,
              description: content.description,
              hint: content.hint,
              difficulty: content.difficulty,
              terrain: content.terrain,
              size: content.size,
              type: content.type,
              images: content.images,
            };
          } catch (error) {
            console.error('Failed to parse updated geocache content:', error);
            return oldData;
          }
        });
      }

      if (dTag) {
        queryClient.setQueryData(['geocache-by-dtag', dTag], (oldData: unknown) => {
          if (!oldData || !originalGeocache) return oldData;
          
          try {
            const content = JSON.parse(event.content);
            return {
              ...oldData,
              // Update event ID since replaceable events get new IDs
              id: event.id,
              // Update with new content but keep dTag stable
              name: content.name,
              description: content.description,
              hint: content.hint,
              difficulty: content.difficulty,
              terrain: content.terrain,
              size: content.size,
              type: content.type,
              images: content.images,
            };
          } catch (error) {
            console.error('Failed to parse updated geocache content:', error);
            return oldData;
          }
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