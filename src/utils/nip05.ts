/**
 * NIP-05 verification utilities
 */

interface Nip05Response {
  names: Record<string, string>;
  relays?: Record<string, string[]>;
}

/**
 * Verify a NIP-05 identifier against a public key
 * @param pubkey - The public key to verify
 * @param nip05 - The NIP-05 identifier (e.g., "bob@example.com")
 * @returns Promise<boolean> - Whether the verification succeeded
 */
export async function verifyNip05(pubkey: string, nip05: string): Promise<boolean> {
  if (!nip05 || !pubkey) {
    return false;
  }

  // Parse the NIP-05 identifier
  const parts = nip05.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domain] = parts;
  
  // Validate both parts exist
  if (!localPart || !domain) {
    return false;
  }
  
  // Validate local part contains only valid characters
  if (!/^[a-z0-9\-_.]+$/i.test(localPart)) {
    return false;
  }

  try {
    // Make request to the well-known endpoint
    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(localPart || '')}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const data: Nip05Response = await response.json();

    // Check if the names object exists
    if (!data.names || typeof data.names !== 'object') {
      return false;
    }

    // Check if the local part exists in the names mapping
    const mappedPubkey = localPart ? data.names[localPart] : undefined;
    if (!mappedPubkey) {
      return false;
    }

    // Verify the public key matches
    return mappedPubkey.toLowerCase() === pubkey.toLowerCase();
  } catch (error) {
    console.warn('NIP-05 verification failed:', error);
    return false;
  }
}