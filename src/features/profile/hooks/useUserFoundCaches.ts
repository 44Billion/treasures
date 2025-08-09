import { useQuery } from '@tanstack/react-query';
import { useLogStoreContext } from '@/shared/stores/hooks';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import type { FoundCache } from '../types';
import type { Geocache } from '@/types/geocache';

export function useUserFoundCaches(targetPubkey?: string, allGeocaches?: Geocache[]) {
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
        console.log('🔍 useUserFoundCaches: Starting query for pubkey:', pubkey);

        // Step 1: Get user's found logs
        const logsResult = await logStore.fetchUserLogs(pubkey);
        if (!logsResult.success) {
          throw logsResult.error;
        }

        const userLogs = logsResult.data || [];
        console.log('🔍 useUserFoundCaches: userLogs length:', userLogs.length);

        // Step 2: Filter for "found" logs and extract geocache references
        const foundLogs = userLogs
          .filter(log => log.type === 'found')
          .map(log => {
            console.log('🔍 useUserFoundCaches: Processing found log:', log);
            // The new GeocacheLog interface has geocacheId in format "pubkey:dTag"
            const [geocachePubkey, geocacheDTag] = log.geocacheId.split(':');
            
            return {
              ...log,
              geocachePubkey,
              geocacheDTag,
            };
          });

        console.log('🔍 useUserFoundCaches: foundLogs length:', foundLogs.length);

        if (foundLogs.length === 0) {
          console.log('🔍 useUserFoundCaches: No found logs found, returning empty array');
          return [];
        }

        // Step 3: Get unique geocache references
        const geocacheRefs = Array.from(new Set(
          foundLogs.map(log => log.geocacheId)
        ));

        console.log('🔍 useUserFoundCaches: geocacheRefs:', geocacheRefs);

        // Step 4: Fetch complete geocache data for each found cache
        const foundCachesMap = new Map<string, FoundCache>();
        
        for (const ref of geocacheRefs) {
          const [geocachePubkey, dTag] = ref.split(':');
          
          try {
            console.log(`🔍 useUserFoundCaches: Processing geocache ref: ${ref}`);
            
            // First, try to find the geocache in the provided allGeocaches array
            // This ensures we use the same data source as the created caches tab
            let geocache = allGeocaches?.find(
              g => g.pubkey === geocachePubkey && g.dTag === dTag
            );
            
            // If not found in the provided array, fetch it individually using the geocache store
            // This ensures we get complete data with all stats
            if (!geocache) {
              console.log(`🔍 useUserFoundCaches: Geocache not found in provided data, fetching individually: ${ref}`);
              
              // Fetch the geocache normally using the geocache store
              const geocacheResult = await geocacheStore.fetchUserGeocaches(geocachePubkey);
              
              if (!geocacheResult.success || !geocacheResult.data) {
                console.warn(`Failed to fetch geocaches for pubkey ${geocachePubkey}:`, geocacheResult.error);
                continue;
              }
              
              // Find the specific geocache by dTag
              geocache = geocacheResult.data.find(g => g.dTag === dTag);
              
              if (!geocache) {
                console.warn(`Geocache with dTag ${dTag} not found for pubkey ${geocachePubkey}`);
                continue;
              }
              
              console.log(`🔍 useUserFoundCaches: Fetched geocache individually:`, geocache.name);
            } else {
              console.log(`🔍 useUserFoundCaches: Found geocache in provided data: ${geocache.name}`);
            }
            
            // Log the stats we found
            console.log(`🔍 useUserFoundCaches: Geocache stats for ${geocache.name}:`, {
              foundCount: geocache.foundCount,
              logCount: geocache.logCount,
              zapTotal: geocache.zapTotal,
            });
            
            // Step 5: Find the most recent found log by this user for this geocache
            const userFoundLog = foundLogs.find(log => 
              log.geocacheId === ref
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
                // Use stats from the geocache data - these come from the unified system
                foundCount: geocache.foundCount || 0,
                logCount: geocache.logCount || 0,
                zapTotal: geocache.zapTotal || 0,
              };

              console.log(`🔍 useUserFoundCaches: Created foundCacheEntry for ${geocache.name}:`, foundCacheEntry);

              // Only keep the most recent find for each unique geocache
              const existingEntry = foundCachesMap.get(ref);
              if (!existingEntry || userFoundLog.created_at > existingEntry.foundAt) {
                foundCachesMap.set(ref, foundCacheEntry);
              }
            } else {
              console.warn(`🔍 useUserFoundCaches: No userFoundLog found for ref: ${ref}`);
            }
          } catch (error) {
            console.warn(`Failed to fetch data for geocache ${ref}:`, error);
          }
        }
        
        // Step 6: Convert map to array and sort by found date (newest first)
        const foundCaches = Array.from(foundCachesMap.values());
        foundCaches.sort((a, b) => b.foundAt - a.foundAt);
        
        console.log('🔍 useUserFoundCaches: Final result:', foundCaches);
        
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