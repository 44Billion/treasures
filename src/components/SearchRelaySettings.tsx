import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { SEARCH_RELAYS } from '@/lib/appRelays';
import { cn } from '@/lib/utils';
import { RelayIdentity } from '@/components/RelayIdentity';

export function SearchRelaySettings() {
  const { config, updateConfig } = useAppContext();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const [relays, setRelays] = useState<string[]>(config.searchRelayMetadata?.relays ?? []);
  const [newRelayUrl, setNewRelayUrl] = useState('');

  // Sync local state with config when it changes externally (e.g., from NostrSync)
  useEffect(() => {
    setRelays(config.searchRelayMetadata?.relays ?? []);
  }, [config.searchRelayMetadata?.relays]);

  const normalizeRelayUrl = (url: string): string => {
    url = url.trim();
    try {
      return new URL(url).toString();
    } catch {
      try {
        return new URL(`wss://${url}`).toString();
      } catch {
        return url;
      }
    }
  };

  const isValidRelayUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed) return false;
    const normalized = normalizeRelayUrl(trimmed);
    try {
      new URL(normalized);
      return true;
    } catch {
      return false;
    }
  };

  const handleToggleAppSearchRelays = (enabled: boolean) => {
    updateConfig((current) => ({
      ...current,
      useAppSearchRelays: enabled,
    }));
    toast({
      title: enabled ? 'App search relays enabled' : 'App search relays disabled',
      description: enabled
        ? 'App search relays will be used alongside your personal search relays.'
        : 'Only your personal search relays will be used.',
    });
  };

  const handleAddRelay = () => {
    if (!isValidRelayUrl(newRelayUrl)) {
      toast({
        title: 'Invalid relay URL',
        description: 'Please enter a valid WebSocket URL (e.g., wss://relay.example.com)',
        variant: 'destructive',
      });
      return;
    }

    const normalized = normalizeRelayUrl(newRelayUrl);

    if (relays.some((r) => r === normalized)) {
      toast({
        title: 'Relay already added',
        variant: 'destructive',
      });
      return;
    }

    const newRelays = [...relays, normalized];
    setRelays(newRelays);
    setNewRelayUrl('');
    saveRelays(newRelays);
  };

  const handleRemoveRelay = (url: string) => {
    const newRelays = relays.filter((r) => r !== url);
    setRelays(newRelays);
    saveRelays(newRelays);
  };

  const saveRelays = (newRelays: string[]) => {
    const now = Math.floor(Date.now() / 1000);

    updateConfig((current) => ({
      ...current,
      searchRelayMetadata: {
        relays: newRelays,
        updatedAt: now,
      },
    }));

    // Publish kind 10007 to Nostr if user is logged in
    if (user) {
      publishKind10007(newRelays);
    }
  };

  const publishKind10007 = (relayList: string[]) => {
    const tags = relayList.map((url) => ['relay', url]);

    publishEvent(
      { kind: 10007, content: '', tags },
      {
        onSuccess: () => {
          toast({
            title: 'Search relay list published',
            description: 'Your search relay list has been published to Nostr.',
          });
        },
        onError: (error: unknown) => {
          console.error('Failed to publish search relay list:', error);
          toast({
            title: 'Failed to publish search relay list',
            description: 'There was an error publishing your search relay list to Nostr.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div>
      {/* App Search Relays Section */}
      <div className="pt-4 pb-4">
        <div className="px-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">App Search Relays</h3>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="use-app-search-relays"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                {config.useAppSearchRelays ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                id="use-app-search-relays"
                checked={config.useAppSearchRelays}
                onCheckedChange={handleToggleAppSearchRelays}
                className="scale-90"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Default relays that support NIP-50 full-text search. Used to find treasures by name.
          </p>
        </div>

        <div className={cn(
          'mt-3 space-y-1 transition-opacity',
          !config.useAppSearchRelays && 'opacity-40',
        )}>
          {SEARCH_RELAYS.map((relay) => (
            <div
              key={relay}
              className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/20 transition-colors"
            >
              <RelayIdentity url={relay} />
            </div>
          ))}
        </div>
      </div>

      {/* User Search Relays Section */}
      <div className="pb-4 pt-4">
        <div className="px-3 space-y-3">
          <h3 className="text-sm font-medium">Your Search Relays</h3>
          <p className="text-xs text-muted-foreground">
            Your personal NIP-50 search relays. Synced to Nostr as a kind 10007 event when logged in.
          </p>
        </div>

        <div className="mt-3">
          {relays.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              No personal search relays configured. Add a relay below or enable App Search Relays above.
            </div>
          ) : (
            <div className="space-y-1">
              {relays.map((relay) => (
                <div
                  key={relay}
                  className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/20 transition-colors"
                >
                  <RelayIdentity url={relay} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRelay(relay)}
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-transparent shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Relay Form */}
        <div className="px-3 mt-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="new-search-relay-url" className="sr-only">
                Search Relay URL
              </Label>
              <Input
                id="new-search-relay-url"
                value={newRelayUrl}
                onChange={(e) => setNewRelayUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddRelay();
                }}
                placeholder="wss://relay.example.com"
                className="h-9 text-base md:text-sm"
              />
            </div>
            <Button
              onClick={handleAddRelay}
              disabled={!newRelayUrl.trim()}
              variant="outline"
              size="sm"
              className="h-9 shrink-0 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add
            </Button>
          </div>

          {!user && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Log in to sync your search relay list with Nostr
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
