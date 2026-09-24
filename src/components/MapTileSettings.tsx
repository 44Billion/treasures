import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Map as MapIcon, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEncryptedSettings } from '@/hooks/useEncryptedSettings';
import { useToast } from '@/hooks/useToast';
import {
  DEFAULT_MAP_TILES_URL,
  mapStyleUrl,
  normalizeMapTilesUrl,
  resolveMapTilesUrl,
} from '@/config/mapStyles';
import { TIMEOUTS } from '@/config';

/**
 * Check that `tilesUrl` serves the OpenFreeMap styles the map needs, so a typo
 * doesn't leave every map blank.
 */
async function isOpenFreeMapServer(tilesUrl: string): Promise<boolean> {
  try {
    const response = await fetch(mapStyleUrl(tilesUrl, 'liberty'), {
      signal: AbortSignal.timeout(TIMEOUTS.QUERY),
    });
    if (!response.ok) return false;
    const style: unknown = await response.json();
    return (
      typeof style === 'object' &&
      style !== null &&
      (style as { version?: unknown }).version === 8 &&
      typeof (style as { sources?: unknown }).sources === 'object'
    );
  } catch {
    return false;
  }
}

const displayUrl = (url: string) => url.replace(/^https:\/\//, '');

export function MapTileSettings() {
  const { t } = useTranslation();
  const { config, updateConfig } = useAppContext();
  const { user } = useCurrentUser();
  const { updateSettings } = useEncryptedSettings();
  const { toast } = useToast();

  const [input, setInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const activeUrl = resolveMapTilesUrl(config.mapTilesUrl);
  const isCustom = activeUrl !== DEFAULT_MAP_TILES_URL;

  const save = (mapTilesUrl: string) => {
    updateConfig((current) => ({ ...current, mapTilesUrl }));
    // Persist cross-device when logged in.
    if (user) {
      updateSettings.mutate({ mapTilesUrl });
    }
  };

  const handleUseServer = async () => {
    const normalized = normalizeMapTilesUrl(input);
    if (!normalized) {
      toast({
        title: t('mapTiles.invalidUrl'),
        description: t('mapTiles.invalidUrlDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsChecking(true);
    const ok = await isOpenFreeMapServer(normalized);
    setIsChecking(false);

    if (!ok) {
      toast({
        title: t('mapTiles.unreachable'),
        description: t('mapTiles.unreachableDescription', { url: displayUrl(normalized) }),
        variant: 'destructive',
      });
      return;
    }

    // Storing '' for the default keeps users on whatever the app default
    // becomes in future releases.
    save(normalized === DEFAULT_MAP_TILES_URL ? '' : normalized);
    setInput('');
    toast({
      title: t('mapTiles.saved'),
      description: t('mapTiles.savedDescription', { url: displayUrl(normalized) }),
    });
  };

  const handleReset = () => {
    save('');
    toast({
      title: t('mapTiles.reset'),
      description: t('mapTiles.savedDescription', { url: displayUrl(DEFAULT_MAP_TILES_URL) }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
        <MapIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-mono text-xs" title={activeUrl}>
          {displayUrl(activeUrl)}
        </span>
        <span className="text-xs text-muted-foreground">
          {isCustom ? t('mapTiles.custom') : t('mapTiles.default')}
        </span>
        {isCustom && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 shrink-0 text-xs"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t('common.reset')}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="map-tiles-url" className="text-sm font-medium">
          {t('mapTiles.customLabel')}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t('mapTiles.customDescription')}
        </p>
        <div className="flex gap-2">
          <Input
            id="map-tiles-url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim() && !isChecking) void handleUseServer();
            }}
            placeholder="https://tiles.openfreemap.org"
            className="h-9 font-mono text-base md:text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            onClick={() => void handleUseServer()}
            disabled={!input.trim() || isChecking}
            variant="outline"
            size="sm"
            className="h-9 shrink-0 text-xs"
          >
            {isChecking && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {t('mapTiles.use')}
          </Button>
        </div>
        {!user && (
          <p className="text-[10px] text-muted-foreground">
            {t('mapTiles.loginHint')}
          </p>
        )}
      </div>
    </div>
  );
}
