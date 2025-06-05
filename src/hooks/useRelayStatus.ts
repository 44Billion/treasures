import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { TIMEOUTS } from '@/lib/constants';
import { getUserRelays } from '@/lib/relayConfig';

interface RelayStatus {
  url: string;
  connected: boolean;
  latency?: number;
  error?: string;
}

export function useRelayStatus() {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['relay-status'],
    queryFn: async (): Promise<RelayStatus[]> => {
      const relays = getUserRelays();
      const results: RelayStatus[] = [];
      
      for (const url of relays) {
        const startTime = Date.now();
        
        try {
          // Try a simple query to test the relay
          await nostr.query(
            [{ kinds: [1], limit: 1 }], 
            { signal: AbortSignal.timeout(TIMEOUTS.CONNECTIVITY_CHECK) }
          );
          
          const latency = Date.now() - startTime;
          results.push({
            url,
            connected: true,
            latency,
          });
        } catch (error) {
          const errorObj = error as { message?: string };
          results.push({
            url,
            connected: false,
            error: errorObj.message || 'Unknown error',
          });
        }
      }
      
      return results;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Check every minute
    retry: false, // Don't retry failed status checks
  });
}

export function useRelayHealth() {
  const relayStatus = useRelayStatus();
  
  const healthInfo = {
    totalRelays: 0,
    connectedRelays: 0,
    averageLatency: 0,
    hasConnectedRelay: false,
    allRelaysDown: false,
  };
  
  if (relayStatus.data) {
    healthInfo.totalRelays = relayStatus.data.length;
    healthInfo.connectedRelays = relayStatus.data.filter(r => r.connected).length;
    healthInfo.hasConnectedRelay = healthInfo.connectedRelays > 0;
    healthInfo.allRelaysDown = healthInfo.connectedRelays === 0;
    
    const connectedWithLatency = relayStatus.data.filter(r => r.connected && r.latency);
    if (connectedWithLatency.length > 0) {
      healthInfo.averageLatency = connectedWithLatency.reduce((sum, r) => sum + (r.latency || 0), 0) / connectedWithLatency.length;
    }
  }
  
  return {
    ...relayStatus,
    health: healthInfo,
  };
}