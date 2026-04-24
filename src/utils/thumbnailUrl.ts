/**
 * Generate a proxied thumbnail URL for an image.
 *
 * When `proxyBaseUrl` is empty, returns the original URL unchanged.
 * When set (e.g. 'https://wsrv.nl'), returns a URL that serves a resized,
 * WebP-compressed thumbnail via the proxy.
 *
 * The proxy must support the wsrv.nl / weserv images API:
 *   https://github.com/weserv/images
 *
 * @param src           Original image URL
 * @param width         Desired thumbnail width in pixels
 * @param proxyBaseUrl  Base URL of the image proxy (empty = disabled)
 */
export function getThumbnailUrl(
  src: string,
  width: number,
  proxyBaseUrl: string,
): string {
  if (!proxyBaseUrl || !src) return src;

  // Don't proxy data: URIs, SVGs, or already-proxied URLs
  if (src.startsWith('data:') || src.endsWith('.svg')) return src;
  if (src.includes('wsrv.nl') || src.includes(proxyBaseUrl)) return src;

  // Normalize: strip trailing slash
  const base = proxyBaseUrl.replace(/\/+$/, '');

  const params = new URLSearchParams({
    url: src,
    w: String(width),
    output: 'webp',
    q: '75',
    default: src,
  });

  return `${base}/?${params.toString()}`;
}
