import { useRelayHealth } from '@/shared/hooks/useRelayStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';

interface RelayStatusIndicatorProps {
  showDetails?: boolean;
  compact?: boolean;
}

export function RelayStatusIndicator({ showDetails = false, compact = false }: RelayStatusIndicatorProps) {
  const { data: relayStatuses, isLoading, refetch, health } = useRelayHealth();
  const [showFullDetails, setShowFullDetails] = useState(false);

  if (isLoading) {
    return (
      <Badge variant="secondary" className="gap-1">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Checking...
      </Badge>
    );
  }

  const getStatusColor = () => {
    if (health.allRelaysDown) return 'destructive';
    if (health.connectedRelays < health.totalRelays) return 'secondary';
    return 'default';
  };

  const getStatusIcon = () => {
    if (health.allRelaysDown) return <WifiOff className="h-3 w-3" />;
    if (health.connectedRelays < health.totalRelays) return <AlertTriangle className="h-3 w-3" />;
    return <Wifi className="h-3 w-3" />;
  };

  const getStatusText = () => {
    if (health.allRelaysDown) return 'All relays down';
    if (health.connectedRelays < health.totalRelays) return `${health.connectedRelays}/${health.totalRelays} relays`;
    return 'All relays connected';
  };

  if (compact) {
    return (
      <Badge variant={getStatusColor()} className="gap-1">
        {getStatusIcon()}
        {getStatusText()}
      </Badge>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={getStatusColor()} className="gap-1">
          {getStatusIcon()}
          {getStatusText()}
        </Badge>
        
        {showDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFullDetails(!showFullDetails)}
          >
            {showFullDetails ? 'Hide' : 'Show'} Details
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {showDetails && showFullDetails && relayStatuses && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Relay Status Details</CardTitle>
            <CardDescription>
              {health.averageLatency > 0 && (
                <span>Average latency: {Math.round(health.averageLatency)}ms</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {relayStatuses.map((relay) => (
              <div key={relay.url} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs truncate flex-1">{relay.url}</span>
                <div className="flex items-center gap-2">
                  {relay.latency && (
                    <span className="text-muted-foreground text-xs">
                      {relay.latency}ms
                    </span>
                  )}
                  <Badge variant={relay.connected ? 'default' : 'destructive'} className="gap-1">
                    {relay.connected ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <WifiOff className="h-3 w-3" />
                    )}
                    {relay.connected ? 'Connected' : 'Failed'}
                  </Badge>
                </div>
              </div>
            ))}
            
            {health.allRelaysDown && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                <p className="text-sm text-destructive font-medium">Connection Issues Detected</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All relays are unreachable. This may cause publishing to fail. 
                  Please check your internet connection and try again.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}