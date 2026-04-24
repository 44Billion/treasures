import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { APP_BLOSSOM_SERVERS } from '@/lib/appBlossom';
import { cn } from '@/lib/utils';

export function BlossomSettings() {
  const { t } = useTranslation();
  const { config, updateConfig } = useAppContext();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const [servers, setServers] = useState<string[]>(config.blossomServerMetadata.servers);
  const [newServerUrl, setNewServerUrl] = useState('');

  // Sync local state with config when it changes externally (e.g., from NostrSync)
  useEffect(() => {
    setServers(config.blossomServerMetadata.servers);
  }, [config.blossomServerMetadata.servers]);

  const normalizeServerUrl = (url: string): string => {
    url = url.trim();
    try {
      return new URL(url).toString();
    } catch {
      try {
        return new URL(`https://${url}`).toString();
      } catch {
        return url;
      }
    }
  };

  const isValidServerUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed) return false;
    const normalized = normalizeServerUrl(trimmed);
    try {
      const parsed = new URL(normalized);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };

  const handleToggleAppServers = (enabled: boolean) => {
    updateConfig((current) => ({
      ...current,
      useAppBlossomServers: enabled,
    }));
    toast({
      title: enabled ? t('blossomServers.enabledToast') : t('blossomServers.disabledToast'),
      description: enabled
        ? t('blossomServers.appEnabled')
        : t('blossomServers.appDisabled'),
    });
  };

  const handleAddServer = () => {
    if (!isValidServerUrl(newServerUrl)) {
      toast({
        title: t('blossomServers.invalidUrl'),
        description: t('blossomServers.invalidUrlDescription'),
        variant: 'destructive',
      });
      return;
    }

    const normalized = normalizeServerUrl(newServerUrl);

    if (servers.some((s) => s === normalized)) {
      toast({
        title: t('blossomServers.alreadyAdded'),
        variant: 'destructive',
      });
      return;
    }

    const newServers = [...servers, normalized];
    setServers(newServers);
    setNewServerUrl('');
    saveServers(newServers);
  };

  const handleRemoveServer = (url: string) => {
    const newServers = servers.filter((s) => s !== url);
    setServers(newServers);
    saveServers(newServers);
  };

  const saveServers = (newServers: string[]) => {
    const now = Math.floor(Date.now() / 1000);

    updateConfig((current) => ({
      ...current,
      blossomServerMetadata: {
        servers: newServers,
        updatedAt: now,
      },
    }));

    // Publish kind 10063 to Nostr if user is logged in
    if (user) {
      publishKind10063(newServers);
    }
  };

  const publishKind10063 = (serverList: string[]) => {
    const tags = serverList.map((url) => ['server', url]);

    publishEvent(
      { kind: 10063, content: '', tags },
      {
        onSuccess: () => {
          toast({
            title: t('blossomServers.published'),
            description: t('blossomServers.publishedDescription'),
          });
        },
        onError: (error: unknown) => {
          console.error('Failed to publish Blossom server list:', error);
          toast({
            title: t('blossomServers.publishFailed'),
            description: t('blossomServers.publishFailedDescription'),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const renderServerUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.host + (parsed.pathname === '/' ? '' : parsed.pathname);
    } catch {
      return url;
    }
  };

  return (
    <div>
      {/* App Blossom Servers Section */}
      <div className="pt-4 pb-4">
        <div className="px-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t('blossomServers.appTitle')}</h3>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="use-app-blossom-servers"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                {config.useAppBlossomServers ? t('common.enabled') : t('common.disabled')}
              </Label>
              <Switch
                id="use-app-blossom-servers"
                checked={config.useAppBlossomServers}
                onCheckedChange={handleToggleAppServers}
                className="scale-90"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('blossomServers.appDescription')}
          </p>
        </div>

        <div className={cn(
          'mt-3 space-y-1 transition-opacity',
          !config.useAppBlossomServers && 'opacity-40',
        )}>
          {APP_BLOSSOM_SERVERS.servers.map((server) => (
            <div
              key={server}
              className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/20 transition-colors"
            >
              <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs flex-1 truncate" title={server}>
                {renderServerUrl(server)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* User Blossom Servers Section */}
      <div className="pb-4 pt-4">
        <div className="px-3 space-y-3">
          <h3 className="text-sm font-medium">{t('blossomServers.yourTitle')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('blossomServers.yourDescription')}
          </p>
        </div>

        <div className="mt-3">
          {servers.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              {t('blossomServers.empty')}
            </div>
          ) : (
            <div className="space-y-1">
              {servers.map((server) => (
                <div
                  key={server}
                  className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/20 transition-colors"
                >
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs flex-1 truncate" title={server}>
                    {renderServerUrl(server)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveServer(server)}
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-transparent shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Server Form */}
        <div className="px-3 mt-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="new-blossom-url" className="sr-only">
                {t('blossomServers.urlLabel')}
              </Label>
              <Input
                id="new-blossom-url"
                value={newServerUrl}
                onChange={(e) => setNewServerUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddServer();
                }}
                placeholder="https://blossom.example.com/"
                className="h-9 text-base md:text-sm font-mono"
              />
            </div>
            <Button
              onClick={handleAddServer}
              disabled={!newServerUrl.trim()}
              variant="outline"
              size="sm"
              className="h-9 shrink-0 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t('common.add')}
            </Button>
          </div>

          {!user && (
            <p className="text-[10px] text-muted-foreground mt-2">
              {t('blossomServers.loginHint')}
            </p>
          )}
        </div>
      </div>

      {/* Image Compression Toggle */}
      <div className="pb-4 pt-4">
        <div className="px-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t('blossomServers.compressTitle')}</h3>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="compress-images"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                {config.imageQuality === 'compressed' ? t('common.enabled') : t('common.disabled')}
              </Label>
              <Switch
                id="compress-images"
                checked={config.imageQuality === 'compressed'}
                onCheckedChange={(checked) =>
                  updateConfig((prev) => ({ ...prev, imageQuality: checked ? 'compressed' : 'original' }))
                }
                className="scale-90"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('blossomServers.compressDescription')}
          </p>
        </div>
      </div>

      {/* Thumbnail Proxy */}
      <div className="pb-4">
        <div className="px-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t('blossomServers.thumbnailTitle')}</h3>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="image-proxy"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                {config.imageProxy ? t('common.enabled') : t('common.disabled')}
              </Label>
              <Switch
                id="image-proxy"
                checked={!!config.imageProxy}
                onCheckedChange={(checked) =>
                  updateConfig((prev) => ({ ...prev, imageProxy: checked ? 'https://wsrv.nl' : '' }))
                }
                className="scale-90"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('blossomServers.thumbnailDescription')}
          </p>
          {config.imageProxy && (
            <div className="space-y-1.5">
              <Label htmlFor="image-proxy-url" className="text-xs font-medium">{t('blossomServers.proxyUrl')}</Label>
              <Input
                id="image-proxy-url"
                type="url"
                value={config.imageProxy}
                onChange={(e) =>
                  updateConfig((prev) => ({ ...prev, imageProxy: e.target.value }))
                }
                placeholder="https://wsrv.nl"
                className="h-8 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Must support the <a href="https://github.com/weserv/images" target="_blank" rel="noopener noreferrer" className="underline">weserv/images</a> API. Default: <button type="button" className="underline" onClick={() => updateConfig((prev) => ({ ...prev, imageProxy: 'https://wsrv.nl' }))}>wsrv.nl</button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
