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

vi.mock('@/shared/utils/security', () => ({
  validateNsec: vi.fn((nsec: string) => nsec.startsWith('nsec1')),
  validateBunkerUri: vi.fn((uri: string) => uri.startsWith('bunker://')),
  validateFileContent: vi.fn(() => true),
}));

describe('Private Key Upload', () => {
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

  it('should handle valid private key file upload and auto-login', async () => {
    renderLoginDialog();

    // The key tab should be active by default, but let's make sure
    const keyTab = screen.getByRole('tab', { name: /nsec/i });
    fireEvent.click(keyTab);

    // Find the file upload button
    const uploadButton = screen.getByText('Upload Your Key File');
    expect(uploadButton).toBeInTheDocument();

    // Create a mock file with valid nsec content
    const validNsec = 'nsec1test123456789abcdef';
    const file = new File([validNsec], 'key.txt', { type: 'text/plain' });

    // Find the hidden file input
    const fileInput = screen.getByRole('button', { name: /upload your key file/i })
      .closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;
    
    expect(fileInput).toBeInTheDocument();

    // Mock FileReader
    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      result: validNsec,
    };

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

    // Trigger file upload
    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    fireEvent.change(fileInput, fileEvent);

    // Simulate FileReader onload
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: validNsec } });
    }

    // Wait for auto-login to complete - the file upload should automatically trigger login
    await waitFor(() => {
      // Verify that the nsec login method was called automatically
      expect(mockLoginActions.nsec).toHaveBeenCalledWith(validNsec);
      expect(mockOnLogin).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle invalid file content', async () => {
    renderLoginDialog();

    // Switch to the key tab
    const keyTab = screen.getByRole('tab', { name: /nsec/i });
    fireEvent.click(keyTab);

    // Create a mock file with invalid content
    const invalidContent = 'not-a-valid-nsec';
    const file = new File([invalidContent], 'key.txt', { type: 'text/plain' });

    const fileInput = screen.getByRole('button', { name: /upload your key file/i })
      .closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    // Mock FileReader
    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      result: invalidContent,
    };

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

    // Trigger file upload
    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    fireEvent.change(fileInput, fileEvent);

    // Simulate FileReader onload
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: invalidContent } });
    }

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('File does not contain a valid secret key. Expected format: nsec1...')).toBeInTheDocument();
    });

    // The nsec input should not be populated
    const nsecInput = screen.getByPlaceholderText('nsec1...');
    expect(nsecInput).toHaveValue('');
  });

  it('should handle file read errors', async () => {
    renderLoginDialog();

    // Switch to the key tab
    const keyTab = screen.getByRole('tab', { name: /nsec/i });
    fireEvent.click(keyTab);

    const file = new File(['nsec1test'], 'key.txt', { type: 'text/plain' });

    const fileInput = screen.getByRole('button', { name: /upload your key file/i })
      .closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    // Mock FileReader with error
    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      result: null,
    };

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

    // Trigger file upload
    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    fireEvent.change(fileInput, fileEvent);

    // Simulate FileReader onerror
    if (mockFileReader.onerror) {
      mockFileReader.onerror({});
    }

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Failed to read file. Please try again.')).toBeInTheDocument();
    });
  });

  it('should validate file type', async () => {
    renderLoginDialog();

    // Switch to the key tab
    const keyTab = screen.getByRole('tab', { name: /nsec/i });
    fireEvent.click(keyTab);

    const fileInput = screen.getByRole('button', { name: /upload your key file/i })
      .closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    // Test invalid file type
    const invalidTypeFile = new File(['nsec1test'], 'key.exe', { type: 'application/exe' });
    Object.defineProperty(invalidTypeFile, 'size', { value: 100 });
    
    // Create a change event with the invalid file
    const invalidFileEvent = {
      target: {
        files: [invalidTypeFile],
        value: '',
      },
    };

    fireEvent.change(fileInput, invalidFileEvent);

    await waitFor(() => {
      expect(screen.getByText(/Please select a text file \(\.txt\) containing your secret key/)).toBeInTheDocument();
    });
  });

  it('should validate file size', async () => {
    renderLoginDialog();

    // Switch to the key tab
    const keyTab = screen.getByRole('tab', { name: /nsec/i });
    fireEvent.click(keyTab);

    const fileInput = screen.getByRole('button', { name: /upload your key file/i })
      .closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    const largeFile = new File(['x'.repeat(20000)], 'key.txt', { type: 'text/plain' });
    Object.defineProperty(largeFile, 'size', { value: 20000 });
    
    // Create a new change event with the large file
    const largeFileEvent = {
      target: {
        files: [largeFile],
        value: '',
      },
    };

    fireEvent.change(fileInput, largeFileEvent);

    await waitFor(() => {
      expect(screen.getByText('File too large. Secret key files should be small text files.')).toBeInTheDocument();
    });
  });

  it('should clear file input after upload attempt', async () => {
    renderLoginDialog();

    const keyTab = screen.getByRole('tab', { name: /nsec/i });
    fireEvent.click(keyTab);

    const file = new File(['nsec1test123'], 'key.txt', { type: 'text/plain' });
    const fileInput = screen.getByRole('button', { name: /upload your key file/i })
      .closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

    // Mock FileReader
    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      result: 'nsec1test123',
    };

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

    // Spy on the value setter to verify it gets cleared
    const valueSetter = vi.fn();
    Object.defineProperty(fileInput, 'value', {
      set: valueSetter,
      get: () => '',
    });

    const fileEvent = {
      target: {
        files: [file],
        value: '',
      },
    };

    fireEvent.change(fileInput, fileEvent);

    // Verify that the file input value was cleared
    expect(valueSetter).toHaveBeenCalledWith('');
  });
});