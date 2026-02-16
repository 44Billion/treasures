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