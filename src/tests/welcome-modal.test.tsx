import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { LoginArea } from '@/components/auth/LoginArea';

// Mock the hooks
vi.mock('@/features/geocache/hooks/useLoggedInAccounts', () => ({
  useLoggedInAccounts: vi.fn(() => ({
    currentUser: null,
  })),
}));

// Note: simpleStores removed - using direct mocks instead

vi.mock('@/features/auth/hooks/useLoginActions', () => ({
  useLoginActions: vi.fn(() => ({
    nsec: vi.fn(),
    extension: vi.fn(),
    bunker: vi.fn(),
    logout: vi.fn(),
  })),
}));

vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/hooks/useUploadFile', () => ({
  useUploadFile: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

// Mock Nostr tools
vi.mock('nostr-tools', () => ({
  generateSecretKey: vi.fn(() => new Uint8Array(32)),
  nip19: {
    nsecEncode: vi.fn(() => 'nsec1test'),
  },
}));

// Mock Nostr provider
vi.mock('@nostrify/react', () => ({
  useNostr: vi.fn(() => ({
    nostr: {
      query: vi.fn(() => Promise.resolve([])),
      event: vi.fn(() => Promise.resolve()),
    },
  })),
}));

vi.mock('@nostrify/react/login', () => ({
  useNostrLogin: vi.fn(() => ({
    logins: [],
    addLogin: vi.fn(),
    removeLogin: vi.fn(),
    setLogin: vi.fn(),
  })),
}));

describe('Welcome Modal', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    // Clear localStorage before each test
    localStorage.clear();
    
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          {component}
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  it('should render login button when no user is logged in', () => {
    renderWithProviders(<LoginArea />);
    
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should show welcome modal when user logs in with fallback mechanism', async () => {
    // Set up the signup completion marker (simulating recent signup)
    localStorage.setItem('treasures_last_signup', Date.now().toString());
    
    // Mock a logged in user appearing after some time
    const { useLoggedInAccounts } = await import('@/features/geocache/hooks/useLoggedInAccounts');
    
    // Initially no user
    vi.mocked(useLoggedInAccounts).mockReturnValue({
      currentUser: null,
      authors: [],
      otherUsers: [],
      setLogin: vi.fn(),
      removeLogin: vi.fn(),
    });
    


    const { rerender } = renderWithProviders(<LoginArea />);

    // Should show login button initially
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();

    // Simulate user logging in
    vi.mocked(useLoggedInAccounts).mockReturnValue({
      currentUser: { id: 'test', pubkey: 'testpubkey', metadata: {} },
      authors: [{ id: 'test', pubkey: 'testpubkey', metadata: {} }],
      otherUsers: [],
      setLogin: vi.fn(),
      removeLogin: vi.fn(),
    });
    


    // Re-render with the new user state
    rerender(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <LoginArea />
        </QueryClientProvider>
      </BrowserRouter>
    );

    // Should no longer show login button
    expect(screen.queryByRole('button', { name: /log in/i })).not.toBeInTheDocument();

    // The welcome modal should eventually appear due to the fallback mechanism
    await waitFor(() => {
      // Look for the specific welcome modal content
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Use getAllByText since "Welcome, Adventurer!" appears in both title and content
      expect(screen.getAllByText('Welcome, Adventurer!')).toHaveLength(2);
      expect(screen.getByText('Your quest begins now!')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle localStorage operations correctly', () => {
    // This test verifies that localStorage operations work as expected
    
    const testTime = Date.now().toString();
    
    // Test that we can set and get localStorage
    localStorage.setItem('treasures_last_signup', testTime);
    expect(localStorage.getItem('treasures_last_signup')).toBe(testTime);
    
    // Test that we can remove from localStorage
    localStorage.removeItem('treasures_last_signup');
    expect(localStorage.getItem('treasures_last_signup')).toBeNull();
    
    // This confirms localStorage functionality works in the test environment
  });

  it('should handle signup completion timing correctly', async () => {
    // Test the primary mechanism (not fallback)
    const { useLoggedInAccounts } = await import('@/features/geocache/hooks/useLoggedInAccounts');
    
    // Start with no user
    vi.mocked(useLoggedInAccounts).mockReturnValue({
      currentUser: null,
      authors: [],
      otherUsers: [],
      setLogin: vi.fn(),
      removeLogin: vi.fn(),
    });
    


    const { rerender } = renderWithProviders(<LoginArea />);

    // Simulate the signup flow by updating the user state
    vi.mocked(useLoggedInAccounts).mockReturnValue({
      currentUser: { id: 'test', pubkey: 'testpubkey', metadata: {} },
      authors: [{ id: 'test', pubkey: 'testpubkey', metadata: {} }],
      otherUsers: [],
      setLogin: vi.fn(),
      removeLogin: vi.fn(),
    });
    


    // Re-render to trigger the user detection
    rerender(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <LoginArea />
        </QueryClientProvider>
      </BrowserRouter>
    );

    // Should show account switcher instead of login button
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /log in/i })).not.toBeInTheDocument();
    });
  });
});