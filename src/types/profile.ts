/**
 * Profile type definitions
 */

export interface EditProfileFormProps {
  onSuccess?: () => void;
}

export interface ProfileHeaderProps {
  pubkey: string;
  metadata?: {
    name?: string;
    display_name?: string;
    picture?: string;
    banner?: string;
    nip05?: string;
    about?: string;
    website?: string;
    lud16?: string;
    lud06?: string;
  };
  createdAt?: number;
  hiddenCount: number | undefined;
  foundCount: number | undefined;
  savedCount?: number;
  variant?: "dialog" | "page";
  className?: string;
  children?: React.ReactNode;
  onCopy?: (text: string, field: string) => void;
  showExtendedDetails?: boolean;
}

export interface FoundCache {
  id: string;
  dTag: string;
  pubkey: string;
  name: string;
  foundAt: number;
  logId: string;
  logText: string;
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number;
  terrain: number;
  size: string;
  type: string;
  foundCount?: number;
  logCount?: number;
  zapTotal?: number;
  verificationPubkey?: string;
}

export interface Nip05Response {
  names: Record<string, string>;
  relays?: Record<string, string[]>;
}

export interface Nip05VerificationResult {
  isVerified: boolean;
  error?: string | null;
  relays?: string[];
}

export interface Nip05Status {
  isVerified: boolean;
  isLoading: boolean;
  error?: string;
  isError: boolean;
  relays: string[];
  isTimeout: boolean;
  isNetworkError: boolean;
  isInvalidFormat: boolean;
}
