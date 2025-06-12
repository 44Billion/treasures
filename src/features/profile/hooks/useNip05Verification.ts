import { useQuery } from '@tanstack/react-query';
import type { Nip05Response, Nip05VerificationResult, Nip05Status } from '../types';

/**
 * Hook to verify NIP-05 identifier against a public key
 * @param nip05 - The NIP-05 identifier (e.g., "bob@example.com")
 * @param pubkey - The public key to verify against
 * @returns Object with verification status and loading state
 */
export function useNip05Verification(nip05: string | undefined, pubkey: string | undefined) {
  return useQuery({
    queryKey: ['nip05-verification', nip05, pubkey],
    queryFn: async ({ signal }): Promise<Nip05VerificationResult> => {
      if (!nip05 || !pubkey) {
        return { isVerified: false, error: 'Missing NIP-05 or pubkey' };
      }

      // Parse the NIP-05 identifier
      const parts = nip05.split('@');
      if (parts.length !== 2) {
        return { isVerified: false, error: 'Invalid NIP-05 format' };
      }

      const [localPart, domain] = parts;
      
      // Validate local part (should only contain a-z0-9-_.)
      if (!/^[a-z0-9\-_.]+$/i.test(localPart)) {
        return { isVerified: false, error: 'Invalid local part in NIP-05' };
      }

      try {
        // Make request to the well-known endpoint
        const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(localPart)}`;
        
        const response = await fetch(url, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]), // Reduced from 10s to 5s for better UX
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          return { 
            isVerified: false, 
            error: `HTTP ${response.status}: ${response.statusText}` 
          };
        }

        const data: Nip05Response = await response.json();

        // Check if the names object exists
        if (!data.names || typeof data.names !== 'object') {
          return { isVerified: false, error: 'Invalid response format' };
        }

        // Check if the local part exists in the names mapping
        const mappedPubkey = data.names[localPart];
        if (!mappedPubkey) {
          return { isVerified: false, error: 'Name not found in mapping' };
        }

        // Verify the public key matches
        const isVerified = mappedPubkey.toLowerCase() === pubkey.toLowerCase();
        
        return {
          isVerified,
          error: isVerified ? null : 'Public key mismatch',
          relays: data.relays?.[pubkey] || [],
        };
      } catch (error) {
        const errorObj = error as { message?: string; name?: string };
        
        if (errorObj.name === 'AbortError') {
          return { isVerified: false, error: 'Request timeout' };
        }
        
        return { 
          isVerified: false, 
          error: errorObj.message || 'Network error' 
        };
      }
    },
    enabled: Boolean(nip05 && pubkey),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry on certain errors
      const errorObj = error as { message?: string };
      if (errorObj.message?.includes('Invalid') || 
          errorObj.message?.includes('HTTP 4') ||
          errorObj.message?.includes('timeout') ||
          errorObj.message?.includes('Network error')) {
        return false;
      }
      return failureCount < 1; // Reduced retries from 2 to 1 for faster failure
    },
    retryDelay: 1000, // 1 second delay between retries
  });
}

/**
 * Extract the verification status from the hook result with enhanced timeout handling
 */
export function useNip05Status(nip05: string | undefined, pubkey: string | undefined): Nip05Status {
  const { data, isLoading, error, isError } = useNip05Verification(nip05, pubkey);
  
  // Determine the error message with better categorization
  let errorMessage = error || data?.error;
  if (typeof errorMessage === 'object' && errorMessage !== null) {
    errorMessage = (errorMessage as { message?: string }).message || 'Unknown error';
  }
  
  return {
    isVerified: data?.isVerified || false,
    isLoading,
    error: errorMessage,
    isError,
    relays: data?.relays || [],
    // Helper flags for UI states
    isTimeout: errorMessage?.includes('timeout') || errorMessage?.includes('Request timeout'),
    isNetworkError: errorMessage?.includes('Network error') || errorMessage?.includes('fetch'),
    isInvalidFormat: errorMessage?.includes('Invalid'),
  };
}