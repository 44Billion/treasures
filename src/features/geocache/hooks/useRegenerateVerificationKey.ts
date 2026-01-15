import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useToast } from '@/shared/hooks/useToast';
import { generateVerificationKeyPair } from '@/features/geocache/utils/verification';
import { geocacheToNaddr } from '@/shared/utils/naddr';
import { 
  NIP_GC_KINDS, 
  buildGeocacheTags, 
  parseGeocacheEvent,
  type ValidCacheType,
  type ValidCacheSize
} from '@/features/geocache/utils/nip-gc';

import { useGeocacheByNaddr } from './useGeocacheByNaddr';

interface RegenerateVerificationKeyParams {
  pubkey: string;
  dTag: string;
  relays?: string[];
}

export function useRegenerateVerificationKey({ pubkey, dTag, relays }: RegenerateVerificationKeyParams) {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const naddr = geocacheToNaddr(pubkey, dTag, relays);
  const { data: geocacheData, isLoading: isLoadingGeocache } = useGeocacheByNaddr(naddr);
  const geocache = geocacheData;

  return useMutation({
    mutationKey: ['regenerate-verification-key', naddr],
    mutationFn: async () => {
      console.log('[RegenerateVerificationKey] Starting', { pubkey, dTag, naddr });
      
      if (isLoadingGeocache) {
        console.warn('[RegenerateVerificationKey] Geocache still loading');
        throw new Error("Geocache data is still loading");
      }

      if (!geocache) {
        console.error('[RegenerateVerificationKey] No geocache found', { naddr });
        throw new Error("Could not load geocache data. The cache may not exist or there might be a network issue.");
      }

      console.log('[RegenerateVerificationKey] Geocache loaded', { 
        name: geocache.name, 
        existingDTag: geocache.dTag,
        verificationPubkey: geocache.verificationPubkey 
      });

      // Generate new verification key pair
      const newVerificationKeyPair = await generateVerificationKeyPair();
      console.log('[RegenerateVerificationKey] New verification key generated', { 
        pubkey: newVerificationKeyPair.publicKey 
      });

      // Create updated geocache event with new verification key
      const tags = buildGeocacheTags({
        dTag: geocache.dTag,  // Use existing d-tag
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
        kind: geocache.kind || NIP_GC_KINDS.GEOCACHE, // Preserve original kind
      });

      console.log('[RegenerateVerificationKey] Publishing event', { 
        kind: geocache.kind || NIP_GC_KINDS.GEOCACHE,
        dTag: geocache.dTag 
      });

      const event = await publishEvent({
        kind: geocache.kind || NIP_GC_KINDS.GEOCACHE,
        content: geocache.description,
        tags,
      });

      console.log('[RegenerateVerificationKey] Event published', { eventId: event.id });

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