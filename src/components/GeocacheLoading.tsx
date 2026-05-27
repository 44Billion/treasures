import { Compass, Server, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NaddrAuthorCard } from '@/components/NaddrAuthorCard';
import { buildMultiRelayList } from '@/hooks/useMultiRelayQuery';
import { useAppContext } from '@/hooks/useAppContext';

interface GeocacheLoadingProps {
  title?: string;
  description?: string;
  relayAttempts?: string[];
  isMultiRelayLoading?: boolean;
  onSkipToCreate?: () => void;
  skipToCreateLabel?: string;
  /** Optional naddr identifier - shows the listing's author while loading. */
  naddr?: string;
}

export function GeocacheLoading({
  title = "Loading Treasure...",
  description = "Fetching treasure details from the network",
  relayAttempts = [],
  isMultiRelayLoading = false,
  onSkipToCreate,
  skipToCreateLabel = "Skip to Hide Treasure",
  naddr,
}: GeocacheLoadingProps) {
  const { config } = useAppContext();
  // Build the same ordered, deduplicated relay list the multi-relay query uses,
  // so the UI shows PRESET_RELAYS + the user's own NIP-65 relays.
  const relayList = buildMultiRelayList(
    config.relayMetadata.relays.map(r => ({ url: r.url })),
  );
  // If we're doing multi-relay loading, show relay attempts
  if (isMultiRelayLoading && relayAttempts.length > 0) {
    return (
      <div className="min-h-screen bg-muted/30 dark:bg-muted flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          {/* Compass spinner */}
          <Compass className="h-12 w-12 text-primary animate-spin mx-auto mb-6" />
          
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {title}
          </h2>
          
          <p className="text-muted-foreground mb-6">
            {description}
          </p>

          {naddr && (
            <div className="mb-6 text-left">
              <NaddrAuthorCard naddr={naddr} />
            </div>
          )}

          {/* Relay attempts */}
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Server className="h-4 w-4" />
              <span>Trying different relays...</span>
            </div>
            
            <div className="space-y-2">
              {relayList
                .filter(r => r.source === 'preset')
                .map((relay) => {
                  const isAttempted = relayAttempts.some(attempt => attempt.includes(relay.url));
                  const isCurrentAttempt = relayAttempts[relayAttempts.length - 1]?.includes(relay.url);

                  return (
                    <div
                      key={relay.url}
                      className={`
                        flex items-center gap-2 p-2 rounded text-sm
                        ${isCurrentAttempt ? 'bg-primary-100 dark:bg-primary-50 text-primary' :
                          isAttempted ? 'bg-muted text-muted-foreground' :
                          'text-muted-foreground/50'}
                      `}
                    >
                      <div className={`
                        w-2 h-2 rounded-full
                        ${isCurrentAttempt ? 'bg-primary animate-pulse' :
                          isAttempted ? 'bg-muted-foreground' :
                          'bg-muted-foreground/30'}
                      `} />
                      <span className="font-medium truncate">{relay.name}</span>
                      <span className="text-xs opacity-70">
                        {isCurrentAttempt ? ' (trying...)' : isAttempted ? ' (checked)' : ''}
                      </span>
                    </div>
                  );
                })}

              {(() => {
                const userRelays = relayList.filter(r => r.source === 'user');
                if (userRelays.length === 0) return null;

                const attemptedCount = userRelays.filter(relay =>
                  relayAttempts.some(attempt => attempt.includes(relay.url))
                ).length;
                const lastAttempt = relayAttempts[relayAttempts.length - 1];
                const currentUserRelay = lastAttempt
                  ? userRelays.find(r => lastAttempt.includes(r.url))
                  : undefined;
                const isCurrentlyOnUser = !!currentUserRelay;
                const allChecked = attemptedCount >= userRelays.length;

                return (
                  <div
                    className={`
                      flex items-center gap-2 p-2 rounded text-sm
                      ${isCurrentlyOnUser ? 'bg-primary-100 dark:bg-primary-50 text-primary' :
                        attemptedCount > 0 ? 'bg-muted text-muted-foreground' :
                        'text-muted-foreground/50'}
                    `}
                  >
                    <div className={`
                      w-2 h-2 rounded-full shrink-0
                      ${isCurrentlyOnUser ? 'bg-primary animate-pulse' :
                        attemptedCount > 0 ? 'bg-muted-foreground' :
                        'bg-muted-foreground/30'}
                    `} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Your relays ({userRelays.length})
                        </span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted-foreground/10 text-muted-foreground">
                          yours
                        </span>
                      </div>
                      {currentUserRelay && (
                        <span className="text-xs opacity-70 truncate">
                          {currentUserRelay.name}
                        </span>
                      )}
                    </div>
                    <span className="ml-auto text-xs opacity-70 tabular-nums shrink-0">
                      {isCurrentlyOnUser
                        ? `${attemptedCount}/${userRelays.length} (trying...)`
                        : allChecked
                          ? `${userRelays.length}/${userRelays.length} (checked)`
                          : `${attemptedCount}/${userRelays.length}`}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {onSkipToCreate && (
            <div className="mt-6">
              <Button onClick={onSkipToCreate} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {skipToCreateLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Standard full-page loading
  return (
    <div className="min-h-screen bg-muted/30 dark:bg-muted flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4 py-12 w-full" role="status" aria-live="polite">
        <Compass className="h-12 w-12 text-primary animate-spin mx-auto mb-6" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {title}
        </h2>
        <p className="text-muted-foreground mb-6">
          {description}
        </p>
        {naddr && (
          <div className="text-left">
            <NaddrAuthorCard naddr={naddr} />
          </div>
        )}
      </div>
    </div>
  );
}