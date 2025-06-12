import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useToast } from '@/shared/hooks/useToast';
import { generateVerificationKeyPair } from '@/features/geocache/utils/verification';
import { geocacheToNaddr } from '@/shared/utils/naddr';
import type { Geocache } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildGeocacheTags, 
  parseGeocacheEvent,
  type ValidCacheType,
  type ValidCacheSize
} from '@/features/geocache/utils/nip-gc';

export function useRegenerateVerificationKey(geocache: Geocache | null) {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  return useMutation({
    // Add a timeout for the entire mutation
    mutationKey: ['regenerate-verification-key', geocache?.id],
    mutationFn: async () => {
      if (!geocache) {
        throw new Error("No geocache provided");
      }

      // Generate new verification key pair
      const newVerificationKeyPair = await generateVerificationKeyPair();

      // Create updated geocache event with new verification key
      const tags = buildGeocacheTags({
        dTag: geocache.dTag,
        name: geocache.name,
        location: geocache.location,
        difficulty: geocache.difficulty,
        terrain: geocache.terrain,
        size: geocache.size as ValidCacheSize,
        type: geocache.type as ValidCacheType,
        hint: geocache.hint,
        images: geocache.images,
        relays: geocache.relays,
        verificationPubkey: newVerificationKeyPair.publicKey, // New verification key
        hidden: geocache.hidden,
      });

      // Create a new Nostr event (kind 37515) with the new verification key
      const event = await publishEvent({
        kind: NIP_GC_KINDS.GEOCACHE,
        content: geocache.description,
        tags,
      });

      return {
        event,
        verificationKeyPair: newVerificationKeyPair,
      };
    },
    onSuccess: ({ event, verificationKeyPair }) => {
      toast({
        title: "New verification key generated!",
        description: "A new geocache event has been created. All previous QR codes are now invalid.",
      });
      
      // Update the specific geocache in cache
      const eventId = geocache?.id;
      const dTag = geocache?.dTag;
      
      // Parse the new geocache data once
      const parsed = parseGeocacheEvent(event);
      if (!parsed || !geocache) {
        console.warn('Failed to parse regenerated geocache event or geocache is null');
        return verificationKeyPair;
      }

      const updatedGeocache = {
        ...parsed,
        // Preserve original foundCount and logCount
        foundCount: geocache.foundCount || 0,
        logCount: geocache.logCount || 0,
      };
      
      if (eventId) {
        queryClient.setQueryData(['geocache', eventId], () => updatedGeocache);
      }

      if (dTag) {
        queryClient.setQueryData(['geocache-by-dtag', dTag], () => updatedGeocache);
      }

      // IMPORTANT: Also update the naddr-based cache that CacheDetail.tsx uses
      // Generate the naddr for this geocache to update the correct cache key
      const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays);
      queryClient.setQueryData(['geocache-by-naddr', naddr], () => updatedGeocache);
      
      // Invalidate all geocache listings to refresh them immediately
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['geocaches-fast'] });
      
      // Also invalidate proximity-based queries that might contain this geocache
      queryClient.invalidateQueries({ queryKey: ['proximity-geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['adaptive-geocaches'] });
      
      // Invalidate the naddr-based query immediately
      queryClient.invalidateQueries({ queryKey: ['geocache-by-naddr', naddr] });
      
      // Background refresh after a short delay for individual geocache queries
      setTimeout(() => {
        if (eventId) {
          queryClient.invalidateQueries({ queryKey: ['geocache', eventId] });
          queryClient.invalidateQueries({ queryKey: ['geocache', event.id] });
        }
        if (dTag) {
          queryClient.invalidateQueries({ queryKey: ['geocache-by-dtag', dTag] });
        }
        // Also refresh the naddr query in the background
        queryClient.invalidateQueries({ queryKey: ['geocache-by-naddr', naddr] });
      }, 2000);

      return verificationKeyPair;
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
        title: "Failed to regenerate verification key",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}