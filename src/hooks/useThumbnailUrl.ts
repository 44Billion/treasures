import { useCallback } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { getThumbnailUrl } from '@/utils/thumbnailUrl';

/**
 * Returns a function that wraps an image URL through the configured
 * image proxy (if enabled). When the proxy is off (empty string),
 * it returns the original URL unchanged.
 *
 * Usage:
 *   const thumbnail = useThumbnailUrl();
 *   <img src={thumbnail(imageUrl, 160)} />
 */
export function useThumbnailUrl() {
  const { config } = useAppContext();
  const proxyBaseUrl = config.imageProxy;

  return useCallback(
    (src: string, width: number) => getThumbnailUrl(src, width, proxyBaseUrl),
    [proxyBaseUrl],
  );
}
