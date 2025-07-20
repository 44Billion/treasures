// Auth Types

// Import from shared types
import type { NostrAccount } from '@/shared/types/nostr';

// Re-export shared types that are auth-related
export type { NostrSigner } from '@/shared/types';

// Auth-specific types
export interface NostrUser extends NostrAccount {}

export interface AuthState {
  isAuthenticated: boolean;
  user: NostrUser | null;
  isLoading: boolean;
}

export interface LoginOptions {
  method: 'extension' | 'key' | 'bunker';
  rememberMe?: boolean;
}

export interface SignupData {
  name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  website?: string;
}