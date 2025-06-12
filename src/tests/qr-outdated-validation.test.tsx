import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CacheDetail from '@/pages/CacheDetail';
import type { Geocache } from '@/types/geocache';

// Mock the hooks and utilities
vi.mock('@/shared/stores/simpleStores', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useGeocacheByNaddr', () => ({
  useGeocacheByNaddr: () => ({
    data: {
      id: 'test-cache-id',
      pubkey: 'test-pubkey',
      dTag: 'test-dtag',
      name: 'Test Cache',
      description: 'Test description',
      location: { lat: 40.7128, lng: -74.0060 },
      difficulty: 2,
      terrain: 3,
      size: 'regular',
      type: 'traditional',
      images: [],
      relays: [],
      verificationPubkey: 'current-verification-pubkey', // Current key
      hidden: false,
      created_at: Math.floor(Date.now() / 1000),
    } as Geocache,
    isLoading: false,
    error: null,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useGeocacheLogs', () => ({
  useGeocacheLogs: () => ({
    data: [],
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: { metadata: { name: 'Test Author' } },
  }),
}));

vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDeleteWithConfirmation', () => ({
  useDeleteWithConfirmation: () => ({
    confirmSingleDeletion: vi.fn(),
    isConfirmDialogOpen: false,
    isDeletingAny: false,
    executeDeletion: vi.fn(),
    cancelDeletion: vi.fn(),
    getConfirmationTitle: () => 'Delete Cache',
    getConfirmationMessage: () => 'Are you sure?',
  }),
}));

vi.mock('@/hooks/useEditGeocache', () => ({
  useEditGeocache: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/usePrefetchManager', () => ({
  useGeocachePrefetch: () => ({
    prefetchGeocache: vi.fn(),
  }),
}));

vi.mock('@/features/geocache/utils/osmVerification', () => ({
  verifyLocation: () => Promise.resolve(null),
}));

// Mock verification utilities
vi.mock('@/features/geocache/utils/verification', () => {
  const mockVerifyKeyPair = vi.fn();
  return {
    parseVerificationFromHash: (hash: string) => {
      if (hash === '#verify=nsec1old-verification-key') {
        return 'nsec1old-verification-key';
      }
      if (hash === '#verify=nsec1current-verification-key') {
        return 'nsec1current-verification-key';
      }
      return null;
    },
    verifyKeyPair: mockVerifyKeyPair,
  };
});

const createWrapper = (initialEntries: string[] = ['/test-cache']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('QR Code Outdated Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.hash
    Object.defineProperty(window, 'location', {
      value: { hash: '' },
      writable: true,
    });
  });

  it('should show "Outdated QR Code" error for old verification keys', async () => {
    // Set up an old verification key in the URL hash
    window.location.hash = '#verify=nsec1old-verification-key';
    
    // Get the mocked function
    const { verifyKeyPair } = await import('@/features/geocache/utils/verification');
    const mockVerifyKeyPair = vi.mocked(verifyKeyPair);
    
    // Mock verifyKeyPair to return false for old key
    mockVerifyKeyPair.mockResolvedValue(false);
    
    const mockToast = vi.fn();
    const { useToast } = await import('@/shared/hooks/useToast');
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    });

    const wrapper = createWrapper(['/test-cache']);
    render(<CacheDetail />, { wrapper });

    // Wait for the verification check to complete
    await waitFor(() => {
      expect(mockVerifyKeyPair).toHaveBeenCalledWith(
        'nsec1old-verification-key',
        'current-verification-pubkey'
      );
    });

    // Verify that the correct error toast was shown
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Outdated QR Code',
      description: 'This QR code has been replaced by the cache owner. Please look for a newer QR code at the cache location.',
      variant: 'destructive',
    });
  });

  it('should show success message for current verification keys', async () => {
    // Set up a current verification key in the URL hash
    window.location.hash = '#verify=nsec1current-verification-key';
    
    // Get the mocked function
    const { verifyKeyPair } = await import('@/features/geocache/utils/verification');
    const mockVerifyKeyPair = vi.mocked(verifyKeyPair);
    
    // Mock verifyKeyPair to return true for current key
    mockVerifyKeyPair.mockResolvedValue(true);
    
    const mockToast = vi.fn();
    const { useToast } = await import('@/shared/hooks/useToast');
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    });

    const wrapper = createWrapper(['/test-cache']);
    render(<CacheDetail />, { wrapper });

    // Wait for the verification check to complete
    await waitFor(() => {
      expect(mockVerifyKeyPair).toHaveBeenCalledWith(
        'nsec1current-verification-key',
        'current-verification-pubkey'
      );
    });

    // Verify that the success toast was shown
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Verification Key Detected',
      description: 'You can now submit verified logs for this cache! Scroll down to the logs section.',
    });
  });

  it('should not show any verification messages when no hash is present', async () => {
    // No hash in URL
    window.location.hash = '';
    
    // Get the mocked function
    const { verifyKeyPair } = await import('@/features/geocache/utils/verification');
    const mockVerifyKeyPair = vi.mocked(verifyKeyPair);
    
    const mockToast = vi.fn();
    const { useToast } = await import('@/shared/hooks/useToast');
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    });

    const wrapper = createWrapper(['/test-cache']);
    render(<CacheDetail />, { wrapper });

    // Wait a bit to ensure no verification checks are triggered
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that verifyKeyPair was not called
    expect(mockVerifyKeyPair).not.toHaveBeenCalled();
    
    // Verify that no verification-related toasts were shown
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/verification|outdated/i),
      })
    );
  });

  it('should handle invalid verification key format gracefully', async () => {
    // Set up an invalid verification key format
    window.location.hash = '#verify=invalid-key-format';
    
    // Get the mocked function
    const { verifyKeyPair } = await import('@/features/geocache/utils/verification');
    const mockVerifyKeyPair = vi.mocked(verifyKeyPair);
    
    const mockToast = vi.fn();
    const { useToast } = await import('@/shared/hooks/useToast');
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
    });

    const wrapper = createWrapper(['/test-cache']);
    render(<CacheDetail />, { wrapper });

    // Wait a bit to ensure parsing is attempted
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify that verifyKeyPair was not called for invalid format
    expect(mockVerifyKeyPair).not.toHaveBeenCalled();
    
    // No error toast should be shown for invalid format (parseVerificationFromHash returns null)
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
      })
    );
  });
});