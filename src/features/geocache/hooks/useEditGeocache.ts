import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useToast } from '@/shared/hooks/useToast';
import type { Geocache } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildGeocacheTags, 
  validateCacheType, 
  validateCacheSize,
  parseGeocacheEvent,
  type ValidCacheType,
  type ValidCacheSize
} from '@/features/geocache/utils/nip-gc';

interface EditGeocacheData {
  name: string;
  description: string;
  hint?: string;
  difficulty: number;
  terrain: number;
  size: "micro" | "small" | "regular" | "large" | "other";
  type: "traditional" | "multi" | "mystery";
  images?: string[];
  hidden?: boolean;
  location?: { lat: number; lng: number };
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
        location: data.location || originalGeocache.location, // Use new location if provided, otherwise keep original
        difficulty: data.difficulty,
        terrain: data.terrain,
        size: data.size as ValidCacheSize,
        type: data.type as ValidCacheType,
        hint: data.hint,
        images: data.images,
        relays: originalGeocache.relays,
        verificationPubkey: originalGeocache.verificationPubkey, // Preserve verification key!
        hidden: data.hidden,
        kind: originalGeocache.kind || NIP_GC_KINDS.GEOCACHE, // Preserve original kind!
      });

      const event = await publishEvent({
        kind: originalGeocache.kind || NIP_GC_KINDS.GEOCACHE, // Preserve original kind
        content: data.description.trim(), // Plain text description in content
        tags,
      });

      return event;
    },
    onMutate: async (data: EditGeocacheData) => {
      if (!originalGeocache) return;

      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['geocache', originalGeocache.id] });
      await queryClient.cancelQueries({ queryKey: ['geocache-by-dtag', originalGeocache.dTag] });
      await queryClient.cancelQueries({ queryKey: ['geocaches'] });
      await queryClient.cancelQueries({ queryKey: ['geocache-by-naddr'] });

      // Snapshot the previous values
      const previousGeocache = queryClient.getQueryData(['geocache', originalGeocache.id]);
      const previousGeocacheByDtag = queryClient.getQueryData(['geocache-by-dtag', originalGeocache.dTag]);
      const previousGeocaches = queryClient.getQueryData(['geocaches']);
      
      // Also snapshot naddr-based queries (we'll update all that match this geocache)
      const previousNaddrQueries = new Map();
      queryClient.getQueryCache().getAll().forEach(query => {
        if (query.queryKey[0] === 'geocache-by-naddr') {
          const data = query.state.data as Geocache | undefined;
          if (data && data.id === originalGeocache.id) {
            previousNaddrQueries.set(query.queryKey[1], data);
          }
        }
      });

      // Create optimistic update data
      const optimisticUpdate: Partial<Geocache> = {
        ...originalGeocache,
        name: data.name.trim(),
        description: data.description.trim(),
        hint: data.hint,
        difficulty: data.difficulty,
        terrain: data.terrain,
        size: data.size,
        type: data.type,
        images: data.images || [],
        hidden: data.hidden,
        location: data.location || originalGeocache.location,
        // Keep the same IDs and metadata
        id: originalGeocache.id,
        dTag: originalGeocache.dTag,
        pubkey: originalGeocache.pubkey,
        created_at: originalGeocache.created_at,
        foundCount: originalGeocache.foundCount,
        logCount: originalGeocache.logCount,
        relays: originalGeocache.relays,
        verificationPubkey: originalGeocache.verificationPubkey,
      };

      // Optimistically update individual geocache queries
      queryClient.setQueryData(['geocache', originalGeocache.id], optimisticUpdate);
      queryClient.setQueryData(['geocache-by-dtag', originalGeocache.dTag], optimisticUpdate);

      // Optimistically update geocaches list
      queryClient.setQueryData(['geocaches'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((cache: Geocache) => 
          cache.id === originalGeocache.id ? optimisticUpdate : cache
        );
      });

      // Optimistically update user geocaches lists
      queryClient.setQueryData(['user-geocaches', originalGeocache.pubkey], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((cache: Geocache) => 
          cache.id === originalGeocache.id ? optimisticUpdate : cache
        );
      });

      // Optimistically update nearby geocaches if they exist
      queryClient.setQueryData(['nearby-geocaches'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((cache: Geocache) => 
          cache.id === originalGeocache.id ? optimisticUpdate : cache
        );
      });

      // Optimistically update geocache by coordinate
      const coordinate = `${originalGeocache.kind || NIP_GC_KINDS.GEOCACHE}:${originalGeocache.pubkey}:${originalGeocache.dTag}`;
      queryClient.setQueryData(['geocache-by-coordinate', coordinate], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((event: any) => {
          // For coordinate queries, we need to update the event data
          if (event.pubkey === originalGeocache.pubkey) {
            // Create a new event with updated content and tags
            return {
              ...event,
              content: data.description.trim(),
              // Note: We'd need to rebuild tags here, but for simplicity we'll let the onSuccess handle this
            };
          }
          return event;
        });
      });

      // Optimistically update all naddr-based queries for this geocache
      previousNaddrQueries.forEach((_, naddr) => {
        queryClient.setQueryData(['geocache-by-naddr', naddr], optimisticUpdate);
      });

      // Return context for rollback
      return { 
        previousGeocache, 
        previousGeocacheByDtag, 
        previousGeocaches,
        previousNaddrQueries,
        geocacheId: originalGeocache.id,
        dTag: originalGeocache.dTag,
        pubkey: originalGeocache.pubkey
      };
    },

    onSuccess: (event, _data, _context) => {
      toast({
        title: "Geocache updated!",
        description: "Your geocache has been successfully updated.",
      });
      
      // Parse the actual event data
      const parsed = parseGeocacheEvent(event);
      if (parsed && originalGeocache) {
        const finalUpdate: Geocache = {
          ...parsed,
          // Preserve counts and other metadata
          foundCount: originalGeocache.foundCount,
          logCount: originalGeocache.logCount,
        };

        // Update with the actual event data
        queryClient.setQueryData(['geocache', originalGeocache.id], finalUpdate);
        queryClient.setQueryData(['geocache-by-dtag', originalGeocache.dTag], finalUpdate);
        
        // Update geocaches list with actual data
        queryClient.setQueryData(['geocaches'], (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((cache: Geocache) => 
            cache.id === originalGeocache.id ? finalUpdate : cache
          );
        });

        // Update user geocaches list with actual data
        queryClient.setQueryData(['user-geocaches', originalGeocache.pubkey], (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((cache: Geocache) => 
            cache.id === originalGeocache.id ? finalUpdate : cache
          );
        });

        // Update nearby geocaches list with actual data
        queryClient.setQueryData(['nearby-geocaches'], (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((cache: Geocache) => 
            cache.id === originalGeocache.id ? finalUpdate : cache
          );
        });

        // Update geocache by coordinate with actual event data
        const coordinate = `${originalGeocache.kind || NIP_GC_KINDS.GEOCACHE}:${originalGeocache.pubkey}:${originalGeocache.dTag}`;
        queryClient.setQueryData(['geocache-by-coordinate', coordinate], [event]);

        // Update all naddr-based queries with actual data
        queryClient.getQueryCache().getAll().forEach(query => {
          if (query.queryKey[0] === 'geocache-by-naddr') {
            const data = query.state.data as Geocache | undefined;
            if (data && data.id === originalGeocache.id) {
              queryClient.setQueryData(query.queryKey, finalUpdate);
            }
          }
        });
      }
      
      // Background refresh after a short delay to ensure consistency
      setTimeout(() => {
        if (originalGeocache) {
          queryClient.invalidateQueries({ queryKey: ['geocache', originalGeocache.id] });
          queryClient.invalidateQueries({ queryKey: ['geocache-by-dtag', originalGeocache.dTag] });
          queryClient.invalidateQueries({ queryKey: ['geocaches'] });
          queryClient.invalidateQueries({ queryKey: ['user-geocaches', originalGeocache.pubkey] });
          queryClient.invalidateQueries({ queryKey: ['nearby-geocaches'] });
          queryClient.invalidateQueries({ queryKey: ['geocache-by-coordinate'] });
          queryClient.invalidateQueries({ queryKey: ['geocache-by-naddr'] });
        }
      }, 3000);
    },

    onError: (error: unknown, _data, context) => {
      // Rollback optimistic updates on error
      if (context) {
        if (context.previousGeocache !== undefined) {
          queryClient.setQueryData(['geocache', context.geocacheId], context.previousGeocache);
        }
        if (context.previousGeocacheByDtag !== undefined) {
          queryClient.setQueryData(['geocache-by-dtag', context.dTag], context.previousGeocacheByDtag);
        }
        if (context.previousGeocaches !== undefined) {
          queryClient.setQueryData(['geocaches'], context.previousGeocaches);
        }
        // Rollback naddr-based queries
        if (context.previousNaddrQueries) {
          context.previousNaddrQueries.forEach((data, naddr) => {
            queryClient.setQueryData(['geocache-by-naddr', naddr], data);
          });
        }
      }
      
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


// Geohash functions are now imported from @/features/geocache/utils/nip-gc
