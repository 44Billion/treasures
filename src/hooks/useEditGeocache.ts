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
        contentLength: content.length 
      });

      // SIMPLEST APPROACH: Use the original event ID as the d-tag
      // This ensures any edits will replace the original properly
      console.log('Using replacement strategy with original event ID as d-tag');
      
      // Extract geohash from original location
      const geohash = getGeohash(originalGeocache.location.lat, originalGeocache.location.lng);

      const event = await publishEvent({
        kind: 30078, // Application-specific data
        content,
        tags: [
          ['d', originalGeocache.id], // Use original event ID as d-tag - this will replace it!
          ['t', 'geocache'], // Type tag for filtering
          ['name', data.name.trim()], // For easier searching
          ['g', geohash], // Geohash for location-based queries
        ],
      });

      return event;
    },
    onSuccess: (event) => {
      toast({
        title: "Geocache updated!",
        description: "Your geocache has been successfully updated.",
      });
      
      // Update the specific geocache in cache
      queryClient.setQueryData(['geocache', originalGeocache?.id], (oldData: any) => {
        if (!oldData || !originalGeocache) return oldData;
        
        try {
          const content = JSON.parse(event.content);
          return {
            ...oldData,
            // Update with new content but keep original ID and metadata
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
      
      // Also update the geocaches list
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      
      // Background refresh after a short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['geocache', originalGeocache?.id] });
      }, 2000);
    },
    onError: (error: any) => {
      console.error('Failed to edit geocache:', error);
      
      let errorMessage = "Please try again later.";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.toString().includes("timeout")) {
        errorMessage = "Connection timeout. Please check your internet connection.";
      } else if (error.toString().includes("User rejected")) {
        errorMessage = "You cancelled the event signing.";
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