import { useTranslation } from 'react-i18next';
import { ExternalLink, List, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LatLng } from './mapHandle';

export type MapFailure =
  | { reason: 'webgl' }
  | { reason: 'error'; message: string };

interface MapUnavailableProps {
  failure: MapFailure;
  /** Area the map would have shown, for the OpenStreetMap link */
  center: LatLng;
  /** 256px-tile zoom (the same units openstreetmap.org uses) */
  zoom: number;
  /** Offered as a way to browse treasures without a map */
  onShowList?: () => void;
  className?: string;
}

/** Shown in place of a map that couldn't be created. */
export function MapUnavailable({ failure, center, zoom, onShowList, className }: MapUnavailableProps) {
  const { t } = useTranslation();
  const osmUrl = `https://www.openstreetmap.org/#map=${Math.round(zoom)}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;

  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-muted p-6', className)}>
      <div className="max-w-xs space-y-4 text-center text-sm text-muted-foreground">
        <div>
          <MapPinOff className="mx-auto mb-2 h-8 w-8" aria-hidden="true" />
          <p>{failure.reason === 'webgl' ? t('map.unavailable') : t('map.loadFailed')}</p>
          {failure.reason === 'error' && (
            <p className="mt-2 break-words font-mono text-xs">{failure.message}</p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {onShowList && (
            <Button variant="default" size="sm" onClick={onShowList}>
              <List className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              {t('map.showList')}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={osmUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              {t('map.openInOsm')}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
