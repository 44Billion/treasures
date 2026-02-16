import type { NPool } from '@nostrify/nostrify';

/**
 * Execute a batch of Nostr queries in smaller chunks to avoid "arr too big" errors
 * @param nostr Nostr client instance
 * @param filters Array of filters to query
 * @param batchSize Maximum number of filters to query at once (default: 3)
 * @param signal AbortSignal for cancellation
 * @returns Combined results from all queries
 */
export async function batchedQuery(
  nostr: NPool,
  filters: any[],
  batchSize: number = 3,
  signal?: AbortSignal
): Promise<any[]> {
  console.log('📦 batchedQuery called with:', {
    totalFilters: filters.length,
    batchSize,
    estimatedBatches: Math.ceil(filters.length / batchSize)
  });
  
  const allEvents: any[] = [];
  
  for (let i = 0; i < filters.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize);
    const batchFilters = filters.slice(i, i + batchSize);
    
    console.log(`📦 Executing batch ${batchIndex + 1}/${Math.ceil(filters.length / batchSize)}:`, {
      filterCount: batchFilters.length,
      filterTypes: batchFilters.map(f => f.kinds?.join(',') || 'unknown')
    });
    
    try {
      const batchStartTime = Date.now();
      const batchEvents = await nostr.query(batchFilters, { signal });
      const batchDuration = Date.now() - batchStartTime;
      
      console.log(`✅ Batch ${batchIndex + 1} completed:`, {
        duration: `${batchDuration}ms`,
        eventsReceived: batchEvents.length,
        filters: batchFilters.length
      });
      
      allEvents.push(...batchEvents);
    } catch (error) {
      const batchDuration = Date.now() - (Date.now() - 1000); // Fallback duration
      console.error(`❌ Failed to execute batch ${batchIndex + 1}:`, {
        duration: `${batchDuration}ms`,
        error: error instanceof Error ? error.message : String(error),
        filters: batchFilters.length,
        filterDetails: batchFilters
      });
      // Continue with other batches even if one fails
    }
  }
  
  console.log('📦 batchedQuery completed:', {
    totalEvents: allEvents.length,
    totalBatches: Math.ceil(filters.length / batchSize),
    successfulBatches: allEvents.length > 0 ? Math.ceil(filters.length / batchSize) : 0
  });
  
  // Return all collected events
  return allEvents;
}

/**
 * Execute multiple separate Nostr queries and combine results
 * @param nostr Nostr client instance
 * @param queryConfigs Array of query configurations
 * @param signal AbortSignal for cancellation
 * @returns Combined results from all queries
 */
export async function separateQueries(
  nostr: NPool,
  queryConfigs: Array<{ filters: any; name?: string }>,
  signal?: AbortSignal
): Promise<any[]> {
  const allEvents: any[] = [];
  
  for (const config of queryConfigs) {
    try {
      const events = await nostr.query([config.filters], { signal });
      allEvents.push(...events);
    } catch (error) {
      console.warn(`Failed to execute query${config.name ? `: ${config.name}` : ''}:`, error);
      // Continue with other queries even if one fails
    }
  }
  
  // Return all collected events
  return allEvents;
}