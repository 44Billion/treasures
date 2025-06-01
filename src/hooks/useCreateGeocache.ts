import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { getGeocachingRelays } from '@/lib/relays';
import { geocacheToNaddr } from '@/lib/naddr-utils';
import type { CreateGeocacheData } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildGeocacheTags, 
  validateCacheType, 
  validateCacheSize,
  validateCoordinates,
  decodeGeohash,
  parseGeocacheEvent,
  type ValidCacheType,
  type ValidCacheSize
} from '@/lib/nip-gc';

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

      // Validate inputs according to NIP-GC
      if (!validateCacheType(data.type)) {
        throw new Error(`Invalid cache type: ${data.type}`);
      }
      if (!validateCacheSize(data.size)) {
        throw new Error(`Invalid cache size: ${data.size}`);
      }
      if (!validateCoordinates(data.location.lat, data.location.lng)) {
        throw new Error(`Invalid coordinates: ${data.location.lat}, ${data.location.lng}`);
      }

      // Create the geocache event according to NIP-GC
      const dTag = `${data.name.trim().toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const relayPreferences = getGeocachingRelays();

      console.log('Creating geocache with data:', { 
        name: data.name, 
        location: data.location,
        dTag 
      });

      // Build tags using consolidated utility
      const tags = buildGeocacheTags({
        dTag,
        name: data.name.trim(),
        location: data.location,
        difficulty: data.difficulty,
        terrain: data.terrain,
        size: data.size as ValidCacheSize,
        type: data.type as ValidCacheType,
        hint: data.hint,
        images: data.images,
        relays: relayPreferences,
      });

      const event = await publishEvent({
        kind: NIP_GC_KINDS.GEOCACHE,
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
        // Use consolidated parsing utility
        const parsed = parseGeocacheEvent(event);
        if (!parsed) {
          console.warn('Failed to parse created geocache event for cache update');
          return null;
        }
        
        return {
          ...parsed,
          foundCount: 0,
          logCount: 0,
        };
      });
      
      // Also update the geocaches list
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      
      // Navigate to the new geocache using naddr (stable URL)
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      if (dTag) {
        const relays = event.tags.filter(t => t[0] === 'relay').map(t => t[1]);
        const naddr = geocacheToNaddr(event.pubkey, dTag, relays);
        navigate(`/${naddr}`);
      }
      
      // Background refresh after navigation to ensure data consistency
      setTimeout(() => {
        const relays = event.tags.filter(t => t[0] === 'relay').map(t => t[1]);
        const naddr = geocacheToNaddr(event.pubkey, dTag, relays);
        queryClient.invalidateQueries({ queryKey: ['geocache-by-naddr', naddr] });
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

// Geohash functions are now imported from @/lib/nip-gc