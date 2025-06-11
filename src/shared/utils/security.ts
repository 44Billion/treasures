import { nip19 } from 'nostr-tools';

/**
 * Validates a Nostr secret key (nsec)
 * @param nsec - The nsec string to validate
 * @returns boolean indicating if the nsec is valid
 */
export function validateNsec(nsec: string): boolean {
  if (!nsec || typeof nsec !== 'string') {
    return false;
  }

  const trimmedNsec = nsec.trim();
  
  // Must start with nsec1
  if (!trimmedNsec.startsWith('nsec1')) {
    return false;
  }

  try {
    const decoded = nip19.decode(trimmedNsec);
    return decoded.type === 'nsec';
  } catch {
    return false;
  }
}

/**
 * Validates a URL to ensure it's safe to use
 * @param url - The URL string to validate
 * @returns boolean indicating if the URL is valid and safe
 */
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    // Only allow HTTP and HTTPS protocols
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitizes a filename for safe usage
 * @param filename - The filename to sanitize
 * @returns sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'file.txt';
  }

  // Remove or replace dangerous characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '_') // Replace dangerous chars
    .replace(/\.\./g, '_') // Prevent directory traversal
    .replace(/^\./, '_') // No leading dots
    .slice(0, 255); // Limit length
}

/**
 * Validates file content before processing
 * @param content - The file content to validate
 * @param maxSize - Maximum allowed size in bytes (default 10KB)
 * @returns boolean indicating if content is safe
 */
export function validateFileContent(content: string, maxSize: number = 10 * 1024): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Check file size
  if (new Blob([content]).size > maxSize) {
    return false;
  }

  // Check for potential script content
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /data:.*base64/gi,
    /on\w+\s*=/gi, // onload=, onclick=, etc.
  ];

  return !dangerousPatterns.some(pattern => pattern.test(content));
}

/**
 * Validates coordinates to ensure they're within valid ranges
 * @param lat - Latitude value
 * @param lng - Longitude value
 * @returns boolean indicating if coordinates are valid
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Validates bunker URI format
 * @param uri - The bunker URI to validate
 * @returns boolean indicating if the URI is valid
 */
export function validateBunkerUri(uri: string): boolean {
  if (!uri || typeof uri !== 'string') {
    return false;
  }

  const trimmedUri = uri.trim();
  
  if (!trimmedUri.startsWith('bunker://')) {
    return false;
  }

  try {
    // Basic URL structure validation
    new URL(trimmedUri);
    return true;
  } catch {
    return false;
  }
}