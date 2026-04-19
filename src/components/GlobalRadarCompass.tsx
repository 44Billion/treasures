import { useRadarOverlay } from '@/hooks/useRadarOverlay';
import { useGeocaches } from '@/hooks/useGeocaches';
import { RadarCompass } from '@/components/RadarCompass';

/**
 * App-level radar compass overlay.
 * Reads open/close state from RadarOverlayContext and fetches
 * geocaches independently so it works from any page.
 */
export function GlobalRadarCompass() {
  const { isOpen, close } = useRadarOverlay();
  const { data: geocaches } = useGeocaches();

  if (!isOpen) return null;

  return (
    <RadarCompass
      geocaches={geocaches ?? []}
      onClose={close}
    />
  );
}
