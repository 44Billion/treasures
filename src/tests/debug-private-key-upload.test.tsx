import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginDialog from '@/components/auth/LoginDialog';
import { validateNsec, validateFileContent } from '@/shared/utils/security';

// Mock the login actions
const mockLoginActions = {
  nsec: vi.fn(),
  extension: vi.fn(),
  bunker: vi.fn(),
};

vi.mock('@/features/auth/hooks/useLoginActions', () => ({
  useLoginActions: () => mockLoginActions,
}));

describe('Debug Private Key Upload', () => {
  let queryClient: QueryClient;
  const mockOnClose = vi.fn();
  const mockOnLogin = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderLoginDialog = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <LoginDialog
          isOpen={true}
          onClose={mockOnClose}
          onLogin={mockOnLogin}
        />
      </QueryClientProvider>
    );
  };

  it('should test validation functions with real data', () => {
    // Test with a real nsec format (this is a test key, not real)
    const testNsec = 'nsec1svjky750vdut9hh4pkvsc9kfnmufqgrl4t6dh4gkxtw9vuvfhvcs4zlf26';
    
    console.log('Testing validateNsec with:', testNsec);
    const isValidNsec = validateNsec(testNsec);
    console.log('validateNsec result:', isValidNsec);
    expect(isValidNsec).toBe(true);

    console.log('Testing validateFileContent with:', testNsec);
    const isValidContent = validateFileContent(testNsec);
    console.log('validateFileContent result:', isValidContent);
    expect(isValidContent).toBe(true);
  });

  it('should test the actual file upload flow with real nsec', async () => {
    renderLoginDialog();

    // Find the file upload button
    const uploadButton = screen.getByText('Upload Your Key File');
    const fileInput = uploadButton.closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    // Use a real test nsec
    const testNsec = 'nsec1svjky750vdut9hh4pkvsc9kfnmufqgrl4t6dh4gkxtw9vuvfhvcs4zlf26';
    const file = new File([testNsec], 'key.txt', { type: 'text/plain' });

    // Create a real FileReader (not mocked)
    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    // Trigger the file upload
    fireEvent.change(fileInput, fileEvent);

    // Wait for the file to be processed
    await waitFor(() => {
      const nsecInput = screen.getByPlaceholderText('nsec1...');
      console.log('Input value after file upload:', nsecInput.value);
      expect(nsecInput).toHaveValue(testNsec);
    }, { timeout: 5000 });

    // Check if login button is enabled
    const loginButton = screen.getByRole('button', { name: /log in/i });
    expect(loginButton).not.toBeDisabled();

    // Try to login
    fireEvent.click(loginButton);

    // Verify login was called
    expect(mockLoginActions.nsec).toHaveBeenCalledWith(testNsec);
  });

  it('should test with invalid nsec', async () => {
    renderLoginDialog();

    const uploadButton = screen.getByText('Upload Your Key File');
    const fileInput = uploadButton.closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    // Use an invalid nsec
    const invalidNsec = 'invalid-key-format';
    const file = new File([invalidNsec], 'key.txt', { type: 'text/plain' });

    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    fireEvent.change(fileInput, fileEvent);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('File does not contain a valid secret key.')).toBeInTheDocument();
    });

    // Input should remain empty
    const nsecInput = screen.getByPlaceholderText('nsec1...');
    expect(nsecInput).toHaveValue('');
  });

  it('should test file type validation', async () => {
    renderLoginDialog();

    const uploadButton = screen.getByText('Upload Your Key File');
    const fileInput = uploadButton.closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    // Use a non-text file
    const testNsec = 'nsec1svjky750vdut9hh4pkvsc9kfnmufqgrl4t6dh4gkxtw9vuvfhvcs4zlf26';
    const file = new File([testNsec], 'key.exe', { type: 'application/exe' });

    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    fireEvent.change(fileInput, fileEvent);

    // Should show file type error
    await waitFor(() => {
      expect(screen.getByText('Please select a text file (.txt) containing your secret key.')).toBeInTheDocument();
    });
  });
});