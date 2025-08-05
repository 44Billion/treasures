import { useQuery } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';

export function useUserGeocaches(targetPubkey?: string) {
  const geocacheStore = useGeocacheStoreContext();
  const { user } = useCurrentUser();

  // Use provided pubkey or fall back to current user's pubkey
  const pubkey = targetPubkey || user?.pubkey;
  
  // Determine if this is the user viewing their own profile
  const isOwnProfile = pubkey === user?.pubkey;

  return useQuery({
    queryKey: ['user-geocaches', pubkey],
    queryFn: async () => {
      if (!pubkey) return [];

      const result = await geocacheStore.fetchUserGeocaches(pubkey);
      if (!result.success) {
        throw result.error;
      }

      // Filter out hidden caches unless the user is viewing their own profile
      const filteredGeocaches = (result.data || []).filter(geocache => {
        if (geocache.hidden && !isOwnProfile) {
          return false;
        }
        return true;
      });

      // Sort by creation date (newest first)
      return filteredGeocaches.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!pubkey,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}