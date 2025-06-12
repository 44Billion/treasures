import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignupDialog from '@/components/auth/SignupDialog';
import { LoginArea } from '@/components/auth/LoginArea';

// Mock the hooks and dependencies
const mockNsecLogin = vi.fn();
vi.mock('@/hooks/useLoginActions', () => ({
  useLoginActions: () => ({
    nsec: mockNsecLogin,
  }),
}));

vi.mock('@/shared/hooks/useToast.ts', () => ({
  toast: vi.fn(),
}));

vi.mock('@/hooks/useLoggedInAccounts', () => ({
  useLoggedInAccounts: () => ({
    currentUser: null,
  }),
}));

const mockPublishEvent = vi.fn().mockResolvedValue({});
const mockIsPublishing = vi.fn().mockReturnValue(false);

vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublishEvent,
    isPending: mockIsPublishing(),
  }),
}));

vi.mock('@/hooks/useUploadFile', () => ({
  useUploadFile: () => ({
    mutateAsync: vi.fn().mockResolvedValue([['url', 'https://example.com/image.jpg']]),
    isPending: false,
  }),
}));

vi.mock('@/shared/utils/naddrsecurity', () => ({
  sanitizeFilename: (filename: string) => filename,
}));

vi.mock('nostr-tools', () => ({
  generateSecretKey: () => new Uint8Array(32).fill(1),
  nip19: {
    nsecEncode: () => 'nsec1test123',
  },
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test');
global.URL.revokeObjectURL = vi.fn();

describe('SignupDialog', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockIsPublishing.mockReturnValue(false);
    mockPublishEvent.mockResolvedValue({});
  });

  const renderSignupDialog = (isOpen = true, onComplete?: () => void) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SignupDialog isOpen={isOpen} onClose={vi.fn()} onComplete={onComplete} />
      </QueryClientProvider>
    );
  };

  it('should render welcome step initially', () => {
    renderSignupDialog();
    expect(screen.getByText('Join the Treasure Hunt')).toBeInTheDocument();
    expect(screen.getByText('Start My Treasure Hunt!')).toBeInTheDocument();
  });

  it('should progress to generate step when start button is clicked', () => {
    renderSignupDialog();
    
    const startButton = screen.getByText('Start My Treasure Hunt!');
    fireEvent.click(startButton);
    
    expect(screen.getByText('Ready to forge your treasure key?')).toBeInTheDocument();
    expect(screen.getByText('Forge My Treasure Key!')).toBeInTheDocument();
  });

  it('should progress to download step after key generation', async () => {
    renderSignupDialog();
    
    // Go to generate step
    fireEvent.click(screen.getByText('Start My Treasure Hunt!'));
    
    // Generate key
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    // Wait for key generation to complete
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should block continue button until key is secured', async () => {
    renderSignupDialog();
    
    // Navigate to download step
    fireEvent.click(screen.getByText('Start My Treasure Hunt!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Continue button should be disabled initially
    const continueButton = screen.getByRole('button', { name: /please secure your key first/i });
    expect(continueButton).toBeDisabled();
  });

  it('should enable continue button after copying key', async () => {
    renderSignupDialog();
    
    // Navigate to download step
    fireEvent.click(screen.getByText('Start My Treasure Hunt!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click copy option
    const copyButton = screen.getByText('Copy to Clipboard');
    fireEvent.click(copyButton);

    // Continue button should now be enabled
    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /my key is safe.*let the hunt begin/i });
      expect(continueButton).not.toBeDisabled();
    });
  });

  it('should enable continue button after downloading key', async () => {
    renderSignupDialog();
    
    // Navigate to download step
    fireEvent.click(screen.getByText('Start My Treasure Hunt!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click download option
    const downloadButton = screen.getByText('Download as File');
    fireEvent.click(downloadButton);

    // Continue button should now be enabled
    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /my key is safe.*let the hunt begin/i });
      expect(continueButton).not.toBeDisabled();
    });
  });

  it('should show visual feedback when options are selected', async () => {
    renderSignupDialog();
    
    // Navigate to download step
    fireEvent.click(screen.getByText('Start My Treasure Hunt!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click copy option
    const copyButton = screen.getByText('Copy to Clipboard');
    fireEvent.click(copyButton);

    // Should show checkmark and "Copied" status
    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument();
    });
  });

  it('should call onComplete after successful signup', async () => {
    const mockOnComplete = vi.fn();
    renderSignupDialog(true, mockOnComplete);
    
    // Navigate through signup flow
    fireEvent.click(screen.getByText('Start My Treasure Hunt!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Secure the key
    const copyButton = screen.getByText('Copy to Clipboard');
    fireEvent.click(copyButton);

    // Continue to profile step
    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /my key is safe.*let the hunt begin/i });
      fireEvent.click(continueButton);
    });

    // Should be on profile step
    await waitFor(() => {
      expect(screen.getByText('Almost there! Let\'s set up your profile')).toBeInTheDocument();
    });

    // Skip profile setup
    const skipButton = screen.getByText('Skip for now - Begin Quest!');
    fireEvent.click(skipButton);

    // Should call onComplete with a delay
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('should handle login errors gracefully', async () => {
    // Mock login to throw an error
    mockNsecLogin.mockImplementationOnce(() => {
      throw new Error('Login failed');
    });

    renderSignupDialog();
    
    // Navigate to download step
    fireEvent.click(screen.getByText('Start My Treasure Hunt!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Secure the key
    const copyButton = screen.getByText('Copy to Clipboard');
    fireEvent.click(copyButton);

    // Try to continue - should handle error
    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /my key is safe.*let the hunt begin/i });
      fireEvent.click(continueButton);
    });

    // Should still be on the same step (error handled)
    expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
  });

  it('should show loading state and disable buttons during profile publishing', async () => {
    // Mock publishing as pending
    mockIsPublishing.mockReturnValue(true);
    
    renderSignupDialog();
    
    // Navigate through signup flow to profile step
    fireEvent.click(screen.getByText('Start My Treasure Hunt!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Secure the key
    const copyButton = screen.getByText('Copy to Clipboard');
    fireEvent.click(copyButton);

    // Continue to profile step
    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /my key is safe.*let the hunt begin/i });
      fireEvent.click(continueButton);
    });

    // Should be on profile step
    await waitFor(() => {
      expect(screen.getByText('Almost there! Let\'s set up your profile')).toBeInTheDocument();
    });

    // Should show loading indicator
    expect(screen.getByText('Publishing your profile to the realm...')).toBeInTheDocument();

    // Buttons should be disabled and show loading state
    const createProfileButton = screen.getByRole('button', { name: /creating profile/i });
    const skipButton = screen.getByRole('button', { name: /setting up account/i });
    
    expect(createProfileButton).toBeDisabled();
    expect(skipButton).toBeDisabled();

    // Form fields should be disabled
    const nameInput = screen.getByPlaceholderText('Your name');
    const bioTextarea = screen.getByPlaceholderText('Tell others about yourself...');
    const avatarInput = screen.getByPlaceholderText('https://example.com/your-avatar.jpg');
    
    expect(nameInput).toBeDisabled();
    expect(bioTextarea).toBeDisabled();
    expect(avatarInput).toBeDisabled();
  });

  it('should prevent multiple submissions when publishing', async () => {
    let resolvePublish: (value: unknown) => void;
    const publishPromise = new Promise((resolve) => {
      resolvePublish = resolve;
    });
    
    // Mock a slow publishing process
    mockPublishEvent.mockReturnValue(publishPromise);
    mockIsPublishing.mockReturnValue(false); // Initially not publishing
    
    renderSignupDialog();
    
    // Navigate through signup flow to profile step
    fireEvent.click(screen.getByText('Start My Treasure Hunt!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Secure the key
    const copyButton = screen.getByText('Copy to Clipboard');
    fireEvent.click(copyButton);

    // Continue to profile step
    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /my key is safe.*let the hunt begin/i });
      fireEvent.click(continueButton);
    });

    // Should be on profile step
    await waitFor(() => {
      expect(screen.getByText('Almost there! Let\'s set up your profile')).toBeInTheDocument();
    });

    // Fill in some profile data
    const nameInput = screen.getByPlaceholderText('Your name');
    fireEvent.change(nameInput, { target: { value: 'Test User' } });

    // Mock publishing state change
    mockIsPublishing.mockReturnValue(true);

    // Click create profile button
    const createProfileButton = screen.getByText('Create Profile & Begin Quest!');
    fireEvent.click(createProfileButton);

    // Should only call publish once even if clicked multiple times
    fireEvent.click(createProfileButton);
    fireEvent.click(createProfileButton);

    // Resolve the publish promise
    resolvePublish!({});

    // Should have been called only once
    expect(mockPublishEvent).toHaveBeenCalledTimes(1);
  });
});