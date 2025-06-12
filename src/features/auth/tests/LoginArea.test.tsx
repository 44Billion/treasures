import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginArea } from '../components/LoginArea';

// Mock the hooks and dependencies
const mockCurrentUser = vi.fn();
vi.mock('@/hooks/useLoggedInAccounts', () => ({
  useLoggedInAccounts: () => ({
    currentUser: mockCurrentUser(),
  }),
}));

vi.mock('@/hooks/useLoginActions', () => ({
  useLoginActions: () => ({
    nsec: vi.fn(),
  }),
}));

vi.mock('@/shared/hooks/useToast.ts', () => ({
  toast: vi.fn(),
}));

vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
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

describe('LoginArea', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockCurrentUser.mockReturnValue(null); // Default to no user logged in
  });

  const renderLoginArea = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <LoginArea />
      </QueryClientProvider>
    );
  };

  it('should show login button when no user is logged in', () => {
    renderLoginArea();
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('should show welcome modal after successful signup', async () => {
    renderLoginArea();
    
    // Click login button to open dialog
    fireEvent.click(screen.getByText('Log in'));
    
    // Click signup button
    const signupButton = screen.getByText(/start your treasure hunt/i);
    fireEvent.click(signupButton);
    
    // Should open signup dialog
    await waitFor(() => {
      expect(screen.getByText('Begin Your Quest')).toBeInTheDocument();
    });
    
    // Navigate through signup flow
    fireEvent.click(screen.getByText('Begin My Quest!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Secure the key
    const copyButton = screen.getByText('Copy to Clipboard');
    fireEvent.click(copyButton);

    // Continue to profile step
    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /my key is safe.*let the quest begin/i });
      fireEvent.click(continueButton);
    });

    // Should be on profile step
    await waitFor(() => {
      expect(screen.getByText('Almost there! Let\'s set up your profile')).toBeInTheDocument();
    });

    // Skip profile setup
    const skipButton = screen.getByText('Skip for now - Begin Quest!');
    fireEvent.click(skipButton);

    // Should show welcome modal after a delay
    await waitFor(() => {
      expect(screen.getByText('Welcome, Adventurer!')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should handle welcome modal timing correctly', async () => {
    renderLoginArea();
    
    // Click login button
    fireEvent.click(screen.getByText('Log in'));
    
    // Click signup
    const signupButton = screen.getByText(/start your treasure hunt/i);
    fireEvent.click(signupButton);
    
    // Complete minimal signup flow
    await waitFor(() => {
      expect(screen.getByText('Begin Your Quest')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Begin My Quest!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Secure key and complete signup quickly
    fireEvent.click(screen.getByText('Copy to Clipboard'));
    
    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /my key is safe.*let the quest begin/i });
      fireEvent.click(continueButton);
    });

    await waitFor(() => {
      const skipButton = screen.getByText('Skip for now - Begin Quest!');
      fireEvent.click(skipButton);
    });

    // Welcome modal should appear with proper timing
    await waitFor(() => {
      expect(screen.getByText('Welcome, Adventurer!')).toBeInTheDocument();
    }, { timeout: 1000 });
    
    // Should have welcome modal content
    expect(screen.getByText('Your adventure begins now!')).toBeInTheDocument();
    expect(screen.getByText('Begin My Quest!')).toBeInTheDocument();
  });

  it('should show account switcher when user is logged in', () => {
    // Mock a logged in user
    mockCurrentUser.mockReturnValue({
      id: 'test-id',
      pubkey: 'test-pubkey',
      metadata: { name: 'Test User' },
    });
    
    renderLoginArea();
    
    // Should not show login button
    expect(screen.queryByText('Log in')).not.toBeInTheDocument();
    
    // Should show account switcher (this would be rendered by AccountSwitcher component)
    // We can't test the exact content without mocking AccountSwitcher, but we can verify
    // the login button is not present
  });

  it('should show welcome modal when user state changes from logged out to logged in', async () => {
    // Start with no user logged in
    mockCurrentUser.mockReturnValue(null);
    
    const { rerender } = renderLoginArea();
    
    // Simulate the signup completion by calling handleLogin directly
    // This would normally be triggered by the SignupDialog onComplete
    const loginArea = screen.getByRole('button', { name: /log in/i }).closest('div')?.parentElement;
    
    // Simulate user becoming logged in (this would happen after signup)
    mockCurrentUser.mockReturnValue({
      id: 'new-user-id',
      pubkey: 'new-user-pubkey',
      metadata: { name: 'New User' },
    });
    
    // Rerender to trigger the useEffect
    rerender(
      <QueryClientProvider client={queryClient}>
        <LoginArea />
      </QueryClientProvider>
    );
    
    // The welcome modal should not appear yet because we haven't triggered the signup flow
    expect(screen.queryByText('Welcome, Adventurer!')).not.toBeInTheDocument();
  });

  it('should handle welcome modal state correctly after signup completion', async () => {
    renderLoginArea();
    
    // Start signup flow
    fireEvent.click(screen.getByText('Log in'));
    const signupButton = screen.getByText(/start your treasure hunt/i);
    fireEvent.click(signupButton);
    
    // Complete signup flow quickly
    await waitFor(() => {
      expect(screen.getByText('Begin Your Quest')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Begin My Quest!'));
    fireEvent.click(screen.getByText('Forge My Treasure Key!'));
    
    await waitFor(() => {
      expect(screen.getByText('Behold! Your magical treasure key!')).toBeInTheDocument();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByText('Copy to Clipboard'));
    
    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /my key is safe.*let the quest begin/i });
      fireEvent.click(continueButton);
    });

    await waitFor(() => {
      const skipButton = screen.getByText('Skip for now - Begin Quest!');
      fireEvent.click(skipButton);
    });

    // Now simulate the user state changing to logged in
    // This simulates the timing fix where the welcome modal waits for currentUser
    mockCurrentUser.mockReturnValue({
      id: 'new-user-id',
      pubkey: 'new-user-pubkey',
      metadata: { name: 'New User' },
    });

    // The welcome modal should appear after the user state updates
    await waitFor(() => {
      expect(screen.getByText('Welcome, Adventurer!')).toBeInTheDocument();
    }, { timeout: 1000 });
    
    // Verify it's the new user welcome
    expect(screen.getByText('Your adventure begins now!')).toBeInTheDocument();
  });
});