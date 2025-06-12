// Auth Types

// Re-export shared types that are auth-related
export type { NostrUser, NostrSigner } from '@/shared/types';

// Auth-specific types can be added here as needed
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