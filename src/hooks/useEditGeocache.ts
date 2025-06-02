import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import type { Geocache } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildGeocacheTags, 
  validateCacheType, 
  validateCacheSize,
  encodeGeohash,
  parseGeocacheEvent,
  type ValidCacheType,
  type ValidCacheSize
} from '@/lib/nip-gc';

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
      
      
      // Validate data according to NIP-GC
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

      // Validate inputs according to NIP-GC
      if (!validateCacheType(data.type)) {
        throw new Error(`Invalid cache type: ${data.type}`);
      }
      if (!validateCacheSize(data.size)) {
        throw new Error(`Invalid cache size: ${data.size}`);
      }

      // Create the updated geocache event using tag-based format

      // FIXED: Use the original d-tag for proper replacement
      // This ensures any edits will replace the original properly
      
      // Build tags using consolidated utility
      const tags = buildGeocacheTags({
        dTag: originalGeocache.dTag, // Use original d-tag - this will replace it!
        name: data.name.trim(),
        location: originalGeocache.location,
        difficulty: data.difficulty,
        terrain: data.terrain,
        size: data.size as ValidCacheSize,
        type: data.type as ValidCacheType,
        hint: data.hint,
        images: data.images,
        relays: originalGeocache.relays,
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
        title: "Geocache updated!",
        description: "Your geocache has been successfully updated.",
      });
      
      // Update the specific geocache in cache using both old and new keys
      const eventId = originalGeocache?.id;
      const dTag = originalGeocache?.dTag;
      
      if (eventId) {
        queryClient.setQueryData(['geocache', eventId], (oldData: unknown) => {
          if (!oldData || !originalGeocache) return oldData;
          
          // Use consolidated parsing utility
          const parsed = parseGeocacheEvent(event);
          if (!parsed) {
            return oldData;
          }
          
          return {
            ...oldData,
            ...parsed,
            // Preserve original foundCount and logCount
            foundCount: (oldData as Geocache).foundCount,
            logCount: (oldData as Geocache).logCount,
          };
        });
      }

      if (dTag) {
        queryClient.setQueryData(['geocache-by-dtag', dTag], (oldData: unknown) => {
          if (!oldData || !originalGeocache) return oldData;
          
          // Use consolidated parsing utility
          const parsed = parseGeocacheEvent(event);
          if (!parsed) {
            return oldData;
          }
          
          return {
            ...oldData,
            ...parsed,
            // Preserve original foundCount and logCount
            foundCount: (oldData as Geocache).foundCount,
            logCount: (oldData as Geocache).logCount,
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


// Geohash functions are now imported from @/lib/nip-gc
