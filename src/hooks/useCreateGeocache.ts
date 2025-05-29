import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
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

      // Create the geocache event
      const content = JSON.stringify({
        name: data.name.trim(),
        description: data.description.trim(),
        hint: data.hint?.trim() || "",
        location: data.location,
        difficulty: data.difficulty,
        terrain: data.terrain,
        size: data.size,
        type: data.type,
        images: data.images || [],
      });

      console.log('Creating geocache with data:', { 
        name: data.name, 
        location: data.location,
        contentLength: content.length 
      });

      const event = await publishEvent({
        kind: 30078, // Application-specific data
        content,
        tags: [
          ['d', `geocache-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`], // Unique identifier for each geocache
          ['t', 'geocache'], // Type tag for filtering
          ['name', data.name.trim()], // For easier searching
          ['g', getGeohash(data.location.lat, data.location.lng)], // Geohash for location-based queries
        ],
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
        try {
          const content = JSON.parse(event.content);
          const dTag = event.tags.find(t => t[0] === 'd')?.[1];
          
          return {
            id: event.id,
            pubkey: event.pubkey,
            created_at: event.created_at,
            dTag: dTag || `geocache-${Date.now()}`, // Store the d-tag
            name: content.name,
            description: content.description,
            hint: content.hint,
            location: content.location,
            difficulty: content.difficulty,
            terrain: content.terrain,
            size: content.size,
            type: content.type,
            images: content.images,
            foundCount: 0,
            logCount: 0,
          };
        } catch (error) {
          console.error('Failed to parse geocache content for cache:', error);
          return null;
        }
      });
      
      // Also update the geocaches list
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      
      // Navigate to the new geocache immediately (uses optimistic data)
      navigate(`/cache/${event.id}`);
      
      // Background refresh after navigation to ensure data consistency
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['geocache', event.id] });
      }, 2000);
    },
    onError: (error: any) => {
      console.error('Failed to create geocache:', error);
      
      let errorMessage = "Please try again later.";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.toString().includes("timeout")) {
        errorMessage = "Connection timeout. Please check your internet connection.";
      } else if (error.toString().includes("User rejected")) {
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