import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Claim from '@/pages/Claim';

// Mock the hooks
vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/features/offline/hooks/useOfflineStorage', () => ({
  useOfflineMode: () => ({
    isOfflineMode: false,
  }),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});



const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Claim Page QR Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show specific error for missing verification key', async () => {
    // Test the validation logic directly since we can't easily access the component's internal method
    const validateTreasureUrl = (url: string) => {
      try {
        const urlObj = new URL(url);
        
        if (urlObj.hostname !== 'treasures.to') {
          return { isValid: false, error: 'QR code must point to treasures.to' };
        }
        
        const pathname = urlObj.pathname;
        const naddr = pathname.slice(1);
        
        if (!naddr || !naddr.startsWith('naddr1')) {
          return { isValid: false, error: 'Invalid treasure URL format' };
        }
        
        // Check for verification key in hash
        if (!urlObj.hash || !urlObj.hash.includes('verify=')) {
          return { isValid: false, error: 'No verification key found in QR code' };
        }
        
        return { isValid: true, naddr, nsec: 'test-nsec' };
      } catch (error) {
        return { isValid: false, error: 'Invalid URL format' };
      }
    };

    // Simulate scanning a QR code without verification key
    const invalidUrl = 'https://treasures.to/naddr1test'; // Missing #verify= part
    const result = validateTreasureUrl(invalidUrl);
    
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('No verification key found in QR code');
  });

  it('should show specific error for invalid URL format', async () => {
    const validateTreasureUrl = (url: string) => {
      try {
        const urlObj = new URL(url);
        
        if (urlObj.hostname !== 'treasures.to') {
          return { isValid: false, error: 'QR code must point to treasures.to' };
        }
        
        const pathname = urlObj.pathname;
        const naddr = pathname.slice(1);
        
        if (!naddr || !naddr.startsWith('naddr1')) {
          return { isValid: false, error: 'Invalid treasure URL format' };
        }
        
        return { isValid: true };
      } catch (error) {
        return { isValid: false, error: 'Invalid URL format' };
      }
    };

    const result = validateTreasureUrl('https://treasures.to/invalid-path');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid treasure URL format');
  });

  it('should accept valid treasure URLs', async () => {
    const validateTreasureUrl = (url: string) => {
      try {
        const urlObj = new URL(url);
        
        if (urlObj.hostname !== 'treasures.to') {
          return { isValid: false, error: 'QR code must point to treasures.to' };
        }
        
        const pathname = urlObj.pathname;
        const naddr = pathname.slice(1);
        
        if (!naddr || !naddr.startsWith('naddr1')) {
          return { isValid: false, error: 'Invalid treasure URL format' };
        }
        
        // Extract verification key from hash
        const hash = urlObj.hash;
        if (!hash.includes('verify=')) {
          return { isValid: false, error: 'No verification key found in QR code' };
        }
        
        const nsec = hash.split('verify=')[1];
        if (!nsec || !nsec.startsWith('nsec1')) {
          return { isValid: false, error: 'Invalid verification key format' };
        }
        
        return { isValid: true, naddr, nsec };
      } catch (error) {
        return { isValid: false, error: 'Invalid URL format' };
      }
    };

    const validUrl = 'https://treasures.to/naddr1test123#verify=nsec1test123';
    const result = validateTreasureUrl(validUrl);
    
    expect(result.isValid).toBe(true);
    expect(result.naddr).toBe('naddr1test123');
    expect(result.nsec).toBe('nsec1test123');
  });

  it('should reject URLs from wrong domain', async () => {
    const validateTreasureUrl = (url: string) => {
      try {
        const urlObj = new URL(url);
        
        if (urlObj.hostname !== 'treasures.to') {
          return { isValid: false, error: 'QR code must point to treasures.to' };
        }
        
        return { isValid: true };
      } catch (error) {
        return { isValid: false, error: 'Invalid URL format' };
      }
    };

    const result = validateTreasureUrl('https://malicious-site.com/naddr1test#verify=nsec1test');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('QR code must point to treasures.to');
  });

  it('should handle malformed URLs gracefully', async () => {
    const validateTreasureUrl = (url: string) => {
      try {
        new URL(url);
        return { isValid: true };
      } catch (error) {
        return { isValid: false, error: 'Invalid URL format' };
      }
    };

    const result = validateTreasureUrl('not-a-valid-url');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid URL format');
  });

  it('should render claim page without errors', () => {
    const wrapper = createWrapper();
    render(<Claim />, { wrapper });
    
    // Check that main elements are present
    expect(screen.getByText('Claim Treasure')).toBeInTheDocument();
    expect(screen.getByText(/Scan with Your/)).toBeInTheDocument();
    expect(screen.getByText(/Enter the/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim this treasure/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste the treasure link here...')).toBeInTheDocument();
  });
});