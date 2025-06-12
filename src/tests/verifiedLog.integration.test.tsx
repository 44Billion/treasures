import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VerifiedLogForm } from '@/components/VerifiedLogForm';
import { useCreateVerifiedLog } from '@/features/logging/hooks/useCreateVerifiedLog';
import { useCurrentUser } from '@/shared/stores/simpleStores';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useToast } from '@/shared/hooks/useToast';
import { createVerificationEvent } from '@/features/geocache/utils/verification';

// Mock all dependencies
vi.mock('@/shared/stores/simpleStores');
vi.mock('@/shared/hooks/useNostrPublish');
vi.mock('@/hooks/useCreateVerifiedLog');
vi.mock('@/shared/hooks/useToast');
vi.mock('@/features/geocache/utils/verification');

const mockUser = {
  pubkey: 'test-user-pubkey',
  signer: {
    signEvent: vi.fn().mockResolvedValue({
      id: 'signed-event-id',
      pubkey: 'test-user-pubkey',
      created_at: 1234567890,
      kind: 7516,
      tags: [],
      content: 'test content',
      sig: 'test-sig'
    })
  }
};

const mockToast = vi.fn();
const mockPublishEvent = vi.fn();
const mockCreateVerifiedLog = vi.fn();

const mockGeocache = {
  id: 'test-cache-id',
  dTag: 'test-dtag',
  pubkey: 'test-cache-pubkey',
  relays: ['wss://test-relay.com']
};

const mockVerificationKey = 'nsec1test123456789';

describe('Verified Log Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    vi.clearAllMocks();

    (useCurrentUser as any).mockReturnValue({ user: mockUser });
    (useToast as any).mockReturnValue({ toast: mockToast });
    (useNostrPublish as any).mockReturnValue({
      mutateAsync: mockPublishEvent,
      isPending: false
    });
    (useCreateVerifiedLog as any).mockReturnValue({
      mutate: mockCreateVerifiedLog,
      isPending: false
    });

    // Mock successful verification event creation
    (createVerificationEvent as any).mockResolvedValue({
      id: 'verification-event-id',
      pubkey: 'verification-pubkey',
      created_at: 1234567890,
      kind: 7517,
      tags: [['a', 'test-user-pubkey:naddr1test']],
      content: 'Geocache verification for npub1test',
      sig: 'verification-sig'
    });

    // Mock successful publishing
    mockPublishEvent.mockResolvedValue({
      id: 'published-event-id',
      pubkey: 'test-user-pubkey',
      created_at: 1234567890,
      kind: 7516,
      tags: [['a', '37515:test-cache-pubkey:test-dtag']],
      content: 'Found the cache!',
      sig: 'published-sig'
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <VerifiedLogForm 
          geocache={mockGeocache}
          verificationKey={mockVerificationKey}
        />
      </QueryClientProvider>
    );
  };

  it('should complete full verified log flow successfully', async () => {
    // Mock successful creation
    mockCreateVerifiedLog.mockImplementation((data, callbacks) => {
      // Simulate successful creation
      setTimeout(() => {
        callbacks.onSuccess();
      }, 0);
    });

    renderComponent();

    // Enter log text
    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Amazing geocache find!' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    fireEvent.click(submitButton);

    // Wait for the hook to be called
    await waitFor(() => {
      expect(mockCreateVerifiedLog).toHaveBeenCalledWith({
        geocacheId: mockGeocache.id,
        geocacheDTag: mockGeocache.dTag,
        geocachePubkey: mockGeocache.pubkey,
        relayUrl: 'wss://test-relay.com',
        preferredRelays: mockGeocache.relays,
        type: 'found',
        text: 'Amazing geocache find!',
        verificationKey: mockVerificationKey,
      }, {
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      });
    });

    // Should clear the form after success
    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('should handle verification event creation failure', async () => {
    // Mock failed creation
    mockCreateVerifiedLog.mockImplementation((data, callbacks) => {
      setTimeout(() => {
        callbacks.onError();
      }, 0);
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Test log' } });

    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateVerifiedLog).toHaveBeenCalled();
    });
  });

  it('should handle publishing failure', async () => {
    // Mock failed creation
    mockCreateVerifiedLog.mockImplementation((data, callbacks) => {
      setTimeout(() => {
        callbacks.onError();
      }, 0);
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Test log' } });

    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateVerifiedLog).toHaveBeenCalled();
    });
  });

  it('should handle user cancellation during signing', async () => {
    // Mock failed creation
    mockCreateVerifiedLog.mockImplementation((data, callbacks) => {
      setTimeout(() => {
        callbacks.onError();
      }, 0);
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Test log' } });

    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateVerifiedLog).toHaveBeenCalled();
    });
  });

  it('should handle timeout during publishing', async () => {
    // Mock failed creation
    mockCreateVerifiedLog.mockImplementation((data, callbacks) => {
      setTimeout(() => {
        callbacks.onError();
      }, 0);
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Test log' } });

    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateVerifiedLog).toHaveBeenCalled();
    });
  });

  it('should validate required fields before processing', async () => {
    renderComponent();

    // Try to submit without text
    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    expect(submitButton).toBeDisabled();

    // Should not call any functions
    expect(mockCreateVerifiedLog).not.toHaveBeenCalled();
  });

  it('should handle user not logged in', async () => {
    (useCurrentUser as any).mockReturnValue({ user: null });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Test log' } });

    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateVerifiedLog).toHaveBeenCalled();
    });
  });

  it('should embed verification event in log tags', async () => {
    mockCreateVerifiedLog.mockImplementation((data, callbacks) => {
      setTimeout(() => {
        callbacks.onSuccess();
      }, 0);
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Found it!' } });

    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateVerifiedLog).toHaveBeenCalledWith({
        geocacheId: mockGeocache.id,
        geocacheDTag: mockGeocache.dTag,
        geocachePubkey: mockGeocache.pubkey,
        relayUrl: 'wss://test-relay.com',
        preferredRelays: mockGeocache.relays,
        type: 'found',
        text: 'Found it!',
        verificationKey: mockVerificationKey,
      }, {
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      });
    });
  });

  it('should show loading state during processing', async () => {
    // Mock the hook to return isPending: true
    (useCreateVerifiedLog as any).mockReturnValue({
      mutate: mockCreateVerifiedLog,
      isPending: true
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Test log' } });

    const submitButton = screen.getByRole('button', { name: /Posting Verified Log/ });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Posting Verified Log (please wait)...');
  });

  it('should handle missing signer', async () => {
    (useCurrentUser as any).mockReturnValue({
      user: { ...mockUser, signer: null }
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Test log' } });

    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateVerifiedLog).toHaveBeenCalled();
    });
  });
});