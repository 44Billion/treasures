import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SignupDialog from '@/components/auth/SignupDialog';

// Mock the hooks and dependencies
vi.mock('@/hooks/useLoginActions', () => ({
  useLoginActions: () => ({
    nsec: vi.fn(),
  }),
}));

vi.mock('@/hooks/useToast.ts', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/security', () => ({
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
  });

  const renderSignupDialog = (isOpen = true) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SignupDialog isOpen={isOpen} onClose={vi.fn()} />
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
});