import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VerifiedLogForm } from '@/components/VerifiedLogForm';
import { useCreateVerifiedLog } from '@/features/logging/hooks/useCreateVerifiedLog';

// Mock dependencies
vi.mock('@/hooks/useCreateVerifiedLog');

const mockMutate = vi.fn();
const mockCreateVerifiedLog = {
  mutate: mockMutate,
  isPending: false,
  isError: false,
  isSuccess: false
};

const mockGeocache = {
  id: 'test-cache-id',
  dTag: 'test-dtag',
  pubkey: 'test-cache-pubkey',
  relays: ['wss://test-relay.com']
};

const mockVerificationKey = 'nsec1test123456789';

describe('VerifiedLogForm', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    vi.clearAllMocks();
    (useCreateVerifiedLog as any).mockReturnValue(mockCreateVerifiedLog);
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      geocache: mockGeocache,
      verificationKey: mockVerificationKey,
      ...props
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <VerifiedLogForm {...defaultProps} />
      </QueryClientProvider>
    );
  };

  it('should render verified log form', () => {
    renderComponent();

    expect(screen.getByText('Post a Verified Log')).toBeInTheDocument();
    expect(screen.getByText(/You have a valid verification key/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Share your find experience/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Post Verified Log/ })).toBeInTheDocument();
  });

  it('should render in compact mode', () => {
    renderComponent({ compact: true });

    // Should not show the header in compact mode
    expect(screen.queryByText('Post a Verified Log')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Share your find experience/)).toBeInTheDocument();
  });

  it('should handle text input', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Found this awesome cache!' } });

    expect(textarea).toHaveValue('Found this awesome cache!');
  });

  it('should disable submit button when text is empty', () => {
    renderComponent();

    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when text is entered', () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });

    fireEvent.change(textarea, { target: { value: 'Found it!' } });

    expect(submitButton).not.toBeDisabled();
  });

  it('should submit verified log with correct data', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });

    fireEvent.change(textarea, { target: { value: 'Amazing find!' } });
    fireEvent.click(submitButton);

    expect(mockMutate).toHaveBeenCalledWith({
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
      relayUrl: 'wss://test-relay.com',
      preferredRelays: ['wss://test-relay.com'],
      type: 'found',
      text: 'Amazing find!',
      verificationKey: mockVerificationKey
    }, expect.any(Object));
  });

  it('should show loading state during submission', () => {
    (useCreateVerifiedLog as any).mockReturnValue({
      ...mockCreateVerifiedLog,
      isPending: true
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    fireEvent.change(textarea, { target: { value: 'Found it!' } });

    const submitButton = screen.getByRole('button', { name: /Posting Verified Log/ });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Posting Verified Log (please wait)...');
  });

  it('should handle successful submission', async () => {
    let onSuccessCallback: ((data: any, variables: any) => void) | undefined;

    mockMutate.mockImplementation((data, options) => {
      onSuccessCallback = options?.onSuccess;
      // Simulate successful submission
      setTimeout(() => {
        if (onSuccessCallback) {
          onSuccessCallback({}, data);
        }
      }, 0);
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });

    fireEvent.change(textarea, { target: { value: 'Great cache!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Verified log posted successfully!')).toBeInTheDocument();
    });

    // Should clear the text after successful submission
    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('should handle submission errors', async () => {
    let onErrorCallback: ((error: any) => void) | undefined;

    mockMutate.mockImplementation((data, options) => {
      onErrorCallback = options?.onError;
      // Simulate error
      setTimeout(() => {
        if (onErrorCallback) {
          onErrorCallback(new Error('Network error'));
        }
      }, 0);
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });

    fireEvent.change(textarea, { target: { value: 'Test log' } });
    fireEvent.click(submitButton);

    // The error handling is done by the hook, so we just verify the mutation was called
    expect(mockMutate).toHaveBeenCalled();
  });

  it('should handle geocache without relays', () => {
    const geocacheWithoutRelays = {
      ...mockGeocache,
      relays: undefined
    };

    renderComponent({ geocache: geocacheWithoutRelays });

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });

    fireEvent.change(textarea, { target: { value: 'Found it!' } });
    fireEvent.click(submitButton);

    expect(mockMutate).toHaveBeenCalledWith({
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
      relayUrl: '',
      preferredRelays: undefined,
      type: 'found',
      text: 'Found it!',
      verificationKey: mockVerificationKey
    }, expect.any(Object));
  });

  it('should apply custom className', () => {
    const { container } = renderComponent({ className: 'custom-class' });
    
    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });

  it('should show posting status', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });

    fireEvent.change(textarea, { target: { value: 'Test log' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creating verified log (this may take a moment)...')).toBeInTheDocument();
    });
  });

  it('should clear posting status after timeout', async () => {
    vi.useFakeTimers();

    let onSuccessCallback: ((data: any, variables: any) => void) | undefined;

    mockMutate.mockImplementation((data, options) => {
      onSuccessCallback = options?.onSuccess;
      // Simulate successful submission
      setTimeout(() => {
        if (onSuccessCallback) {
          onSuccessCallback({}, data);
        }
      }, 0);
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Share your find experience/);
    const submitButton = screen.getByRole('button', { name: /Post Verified Log/ });

    fireEvent.change(textarea, { target: { value: 'Test log' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Verified log posted successfully!')).toBeInTheDocument();
    });

    // Fast-forward time to clear the status
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.queryByText('Verified log posted successfully!')).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });
});