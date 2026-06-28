import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/stores/hooks';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';
import { OFFLINE_QUEUE_QUERY_KEY } from '@/hooks/useOfflineQueue';
import type { CreateGeocacheData } from '@/types/geocache';
import type { Geocache } from '@/types/geocache';

interface CreateGeocacheResult {
  event: any;
  geocache: Geocache;
  /**
   * `'published'` — at least one relay accepted the event.
   * `'queued'` — device offline or relays unreachable; the signed event was
   * saved to the offline publish queue and will broadcast when back online.
   */
  status: 'published' | 'queued';
}

export function useCreateGeocache() {
  const queryClient = useQueryClient();
  const geocacheStore = useGeocacheStoreContext();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: CreateGeocacheData) => {
      // Cast data to Partial<Geocache> with proper type assertion
      // Note: Full validation is handled by the geocache store's mutationFn
      const geocacheData = {
        ...data,
        size: data.size as Geocache['size'],
        type: data.type as Geocache['type'],
      };

      // Use the store's createGeocache method
      const result = await geocacheStore.createGeocache(geocacheData);
      if (!result.success) {
        throw result.error;
      }

      // The result already has the correct structure
      if (!result.data) {
        throw new Error('Failed to create geocache: No data returned');
      }

      return result.data;
    },
    onSuccess: (data: CreateGeocacheResult) => {
      // Be honest when the device is offline: the event is queued locally and
      // will broadcast on reconnect. Showing "hidden!" here would lie.
      if (data?.status === 'queued') {
        toast({
          title: t('createCache.publish.queued.title', 'Saved offline'),
          description: t(
            'createCache.publish.queued.description',
            'No connection — your treasure is saved on this device and will be published automatically when you\'re back online.',
          ),
        });
        // Surface it in the Profile "Pending offline" section right away.
        queryClient.invalidateQueries({ queryKey: OFFLINE_QUEUE_QUERY_KEY });
      } else {
        toast({
          title: t('createCache.publish.success.title', 'Treasure hidden!'),
          description: t('createCache.publish.success.hidden', 'Your treasure has been successfully hidden.'),
        });
      }

      // Invalidate related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['user-geocaches'] });
      if (data?.geocache) {
        queryClient.invalidateQueries({ queryKey: ['geocache', data.geocache.id] });
      }
    },
    onError: (error: unknown) => {
      let errorMessage = t('createCache.publish.failed.tryLater', 'Please try again later.');
      const errorObj = error as { message?: string };

      if (errorObj.message) {
        errorMessage = errorObj.message;
      } else if (String(error).includes("timeout")) {
        errorMessage = t('createCache.publish.failed.timeout', 'Connection timeout. Please check your internet connection.');
      } else if (String(error).includes("User rejected")) {
        errorMessage = t('createCache.publish.failed.cancelledSigning', 'You cancelled the event signing.');
      }

      toast({
        title: t('createCache.publish.failed.toastTitle', 'Failed to hide treasure'),
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}