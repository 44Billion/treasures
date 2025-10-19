import React from 'react';
import { Compass, Server } from 'lucide-react';
import { FullPageLoading } from '@/components/ui/loading';
import { PRESET_RELAYS } from '@/shared/config/relays';

interface GeocacheLoadingProps {
  title?: string;
  description?: string;
  relayAttempts?: string[];
  isMultiRelayLoading?: boolean;
}

export function GeocacheLoading({
  title = "Loading Geocache...",
  description = "Fetching cache details from the network",
  relayAttempts = [],
  isMultiRelayLoading = false
}: GeocacheLoadingProps) {
  // If we're doing multi-relay loading, show relay attempts
  if (isMultiRelayLoading && relayAttempts.length > 0) {
    return (
      <div className="min-h-screen bg-muted/30 dark:bg-muted flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          {/* Compass spinner */}
          <Compass className="h-12 w-12 text-green-600 animate-spin mx-auto mb-6" />
          
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {title}
          </h2>
          
          <p className="text-muted-foreground mb-6">
            {description}
          </p>
          
          {/* Relay attempts */}
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Server className="h-4 w-4" />
              <span>Trying different relays...</span>
            </div>
            
            <div className="space-y-2">
              {PRESET_RELAYS.map((relay, index) => {
                const isAttempted = relayAttempts.some(attempt => attempt.includes(relay.url));
                const isCurrentAttempt = relayAttempts[relayAttempts.length - 1]?.includes(relay.url);
                
                return (
                  <div 
                    key={relay.url}
                    className={`
                      flex items-center gap-2 p-2 rounded text-sm
                      ${isCurrentAttempt ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 
                        isAttempted ? 'bg-muted text-muted-foreground' : 
                        'text-muted-foreground/50'}
                    `}
                  >
                    <div className={`
                      w-2 h-2 rounded-full
                      ${isCurrentAttempt ? 'bg-green-500 animate-pulse' : 
                        isAttempted ? 'bg-muted-foreground' : 
                        'bg-muted-foreground/30'}
                    `} />
                    <span className="font-medium">{relay.name}</span>
                    <span className="text-xs opacity-70">
                      {isCurrentAttempt ? ' (trying...)' : isAttempted ? ' (checked)' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {relayAttempts.length >= PRESET_RELAYS.length && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
                Cache not found on any relay. It may not exist yet or you might be the owner.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard full-page loading
  return (
    <div className="min-h-screen bg-muted/30 dark:bg-muted">
      <FullPageLoading 
        title={title}
        description={description}
      />
    </div>
  );
}