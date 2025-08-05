import { useQuery } from '@tanstack/react-query';
import { useLogStoreContext } from '@/shared/stores/hooks';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import type { FoundCache } from '../types';

export function useUserFoundCaches(targetPubkey?: string) {
  const logStore = useLogStoreContext();
  const geocacheStore = useGeocacheStoreContext();
  const { user } = useCurrentUser();

  // Use provided pubkey or fall back to current user's pubkey
  const pubkey = targetPubkey || user?.pubkey;

  return useQuery({
    queryKey: ['user-found-caches', pubkey],
    queryFn: async () => {
      if (!pubkey) return [];

      try {
        // Get user's logs from the log store
        const logsResult = await logStore.fetchUserLogs(pubkey);
        if (!logsResult.success) {
          throw logsResult.error;
        }

        const userLogs = logsResult.data || [];

        // Process the logs to find "found" logs
        const foundLogs = userLogs
          .filter(log => log.type === 'found')
          .map(log => {
            // Extract geocache info from the log
            return {
              ...log,
              geocachePubkey: log.geocachePubkey,
              geocacheDTag: log.geocacheId,
            };
          });

        if (foundLogs.length === 0) return [];

        // Get unique geocache references
        const geocacheRefs = Array.from(new Set(
          foundLogs.map(log => `${log.geocachePubkey}:${log.geocacheDTag}`)
        ));

        // Fetch geocache data for each found cache
        const foundCachesMap = new Map<string, FoundCache>();
        
        for (const ref of geocacheRefs) {
          const [geocachePubkey, dTag] = ref.split(':');
          
          try {
            // Try to find the geocache in the current store data first
            const currentGeocaches = geocacheStore.geocaches;
            const existingGeocache = currentGeocaches.find(
              g => g.pubkey === geocachePubkey && g.dTag === dTag
            );
            
            const geocache = existingGeocache;
            
            // If not found in current data, fetch it specifically
            if (!geocache) {
              // We need to construct the event ID to use fetchGeocache
              // Since we don't have the ID, we'll need to use a different approach
              // For now, skip geocaches that aren't in the current store data
              console.warn(`Geocache not found in current data: ${ref}`);
              continue;
            }
            
            // Get all logs for this geocache (for counting)
            const logsResult = await logStore.fetchLogsForGeocache(
              geocachePubkey || '',
              dTag || ''
            );
            
            let totalLogs = 0;
            let foundLogsCount = 0;
            
            if (logsResult.success) {
              const allLogs = logsResult.data || [];
              totalLogs = allLogs.length;
              foundLogsCount = allLogs.filter(log => log.type === 'found').length;
            }
            
            // Find the most recent found log by this user
            const userFoundLog = foundLogs.find(log => 
              log.geocachePubkey === geocachePubkey && log.geocacheId === dTag
            );
            
            if (userFoundLog) {
              const foundCacheEntry = {
                id: geocache.id,
                uniqueId: `${geocache.id}-${userFoundLog.id}`,
                naddr: geocache.naddr,
                dTag: geocache.dTag,
                pubkey: geocache.pubkey,
                name: geocache.name,
                foundAt: userFoundLog.created_at,
                logId: userFoundLog.id,
                logText: userFoundLog.text,
                location: geocache.location,
                difficulty: geocache.difficulty,
                terrain: geocache.terrain,
                size: geocache.size,
                type: geocache.type,
                foundCount: foundLogsCount,
                logCount: totalLogs,
              };

              // Only keep the most recent find for each unique geocache
              const existingEntry = foundCachesMap.get(ref);
              if (!existingEntry || userFoundLog.created_at > existingEntry.foundAt) {
                foundCachesMap.set(ref, foundCacheEntry);
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch data for geocache ${ref}:`, error);
          }
        }
        
        // Convert map to array and sort by found date (newest first)
        const foundCaches = Array.from(foundCachesMap.values());
        foundCaches.sort((a, b) => b.foundAt - a.foundAt);
        
        return foundCaches;
      } catch (error) {
        console.error('Error fetching user found caches:', error);
        throw error;
      }
    },
    enabled: !!pubkey,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}