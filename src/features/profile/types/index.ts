/**
 * Profile feature type definitions
 */

export interface ProfileDialogProps {
  pubkey: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  hiddenCount: number;
  foundCount: number;
  savedCount?: number;
  variant?: "dialog" | "page";
  className?: string;
  children?: React.ReactNode; // For additional content like edit buttons
  onCopy?: (text: string, field: string) => void; // For copy functionality
  showExtendedDetails?: boolean; // Whether to show bio and additional details
}

export interface FoundCache {
  id: string;
  dTag: string;
  pubkey: string;
  name: string;
  foundAt: number; // Timestamp of the most recent find
  logId: string; // ID of the most recent find log
  logText: string; // Text from the most recent find log
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number;
  terrain: number;
  size: string;
  type: string;
  foundCount?: number; // Total number of finds for this cache (by all users)
  logCount?: number; // Total number of logs for this cache (by all users)
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
  // Helper flags for UI states
  isTimeout: boolean;
  isNetworkError: boolean;
  isInvalidFormat: boolean;
}