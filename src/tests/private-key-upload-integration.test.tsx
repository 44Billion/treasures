import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginDialog from '@/components/auth/LoginDialog';

// Mock the hooks and dependencies
const mockLoginActions = {
  nsec: vi.fn(),
  extension: vi.fn(),
  bunker: vi.fn(),
};

vi.mock('@/features/auth/hooks/useLoginActions', () => ({
  useLoginActions: () => mockLoginActions,
}));

// Mock the validation functions to see what's happening
vi.mock('@/shared/utils/security', () => ({
  validateNsec: vi.fn(() => true),
  validateBunkerUri: vi.fn(() => true),
  validateFileContent: vi.fn(() => true),
}));

describe('Private Key Upload Integration', () => {
  let queryClient: QueryClient;
  const mockOnClose = vi.fn();
  const mockOnLogin = vi.fn();

  beforeEach(async () => {
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

  it('should complete the full file upload flow with auto-login', async () => {
    const { validateNsec, validateFileContent } = await vi.importMock('@/shared/utils/security');
    
    renderLoginDialog();

    // Find the file upload button
    const uploadButton = screen.getByText('Upload Your Key File');
    expect(uploadButton).toBeInTheDocument();

    // Find the hidden file input
    const fileInput = uploadButton.closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Create a valid nsec file
    const validNsec = 'nsec1test123456789abcdef';
    const file = new File([validNsec], 'key.txt', { type: 'text/plain' });

    // Mock FileReader
    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      result: validNsec,
    };

    const fileReaderSpy = vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

    // Trigger file upload
    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    fireEvent.change(fileInput, fileEvent);

    // Verify FileReader was created and readAsText was called
    expect(fileReaderSpy).toHaveBeenCalled();
    expect(mockFileReader.readAsText).toHaveBeenCalledWith(file);

    // Simulate successful file read
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: validNsec } });
    }

    // Verify validation functions were called
    expect(validateFileContent).toHaveBeenCalledWith(validNsec);
    expect(validateNsec).toHaveBeenCalledWith(validNsec);

    // Wait for auto-login to complete - the file upload should automatically trigger login
    await waitFor(() => {
      // Verify that the nsec login method was called automatically
      expect(mockLoginActions.nsec).toHaveBeenCalledWith(validNsec);
      expect(mockOnLogin).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle validation failures correctly', async () => {
    const { validateNsec } = await vi.importMock('@/shared/utils/security');
    
    // Set up validation to fail
    validateNsec.mockReturnValue(false);
    
    renderLoginDialog();

    const uploadButton = screen.getByText('Upload Your Key File');
    const fileInput = uploadButton.closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    const invalidNsec = 'invalid-key';
    const file = new File([invalidNsec], 'key.txt', { type: 'text/plain' });

    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      result: invalidNsec,
    };

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    fireEvent.change(fileInput, fileEvent);

    // Simulate file read
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: invalidNsec } });
    }

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('File does not contain a valid secret key. Expected format: nsec1...')).toBeInTheDocument();
    });

    // The nsec input should not be populated
    const nsecInput = screen.getByPlaceholderText('nsec1...');
    expect(nsecInput).toHaveValue('');

    // Login button should be disabled
    const loginButton = screen.getByRole('button', { name: /log in/i });
    expect(loginButton).toBeDisabled();
  });

  it('should handle file content validation failures', async () => {
    const { validateFileContent, validateNsec } = await vi.importMock('@/shared/utils/security');
    
    // Set up file content validation to fail
    validateFileContent.mockReturnValue(false);
    
    renderLoginDialog();

    const uploadButton = screen.getByText('Upload Your Key File');
    const fileInput = uploadButton.closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    const suspiciousContent = '<script>alert("hack")</script>nsec1test';
    const file = new File([suspiciousContent], 'key.txt', { type: 'text/plain' });

    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      result: suspiciousContent,
    };

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    fireEvent.change(fileInput, fileEvent);

    // Simulate file read
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: suspiciousContent } });
    }

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('File content appears to be invalid or unsafe.')).toBeInTheDocument();
    });

    // Verify that validateNsec was not called since file content validation failed first
    expect(validateNsec).not.toHaveBeenCalled();
  });
});