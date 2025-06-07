import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PWAUpdateNotification } from '@/components/PWAUpdateNotification';

// Mock service worker
const mockServiceWorker = {
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockRegistration = {
  waiting: null as ServiceWorker | null,
  installing: null as ServiceWorker | null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock navigator.serviceWorker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve(mockRegistration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    controller: true,
  },
  writable: true,
});

describe('PWAUpdateNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistration.waiting = null;
  });

  it('should not show notification when no update is available', () => {
    render(<PWAUpdateNotification />);
    
    expect(screen.queryByText('Update Available')).not.toBeInTheDocument();
  });

  it('should show notification when update is available', async () => {
    // Set up waiting worker
    mockRegistration.waiting = mockServiceWorker as unknown as ServiceWorker;
    
    render(<PWAUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });
    
    expect(screen.getByText('A new version of Treasures is ready to install.')).toBeInTheDocument();
    expect(screen.getByText('Update Now')).toBeInTheDocument();
    expect(screen.getByText('Later')).toBeInTheDocument();
  });

  it('should handle update button click', async () => {
    mockRegistration.waiting = mockServiceWorker as unknown as ServiceWorker;
    
    render(<PWAUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Update Now'));
    
    expect(mockServiceWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('should handle dismiss button click', async () => {
    mockRegistration.waiting = mockServiceWorker as unknown as ServiceWorker;
    
    render(<PWAUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Later'));
    
    await waitFor(() => {
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument();
    });
  });

  it('should handle X button click', async () => {
    mockRegistration.waiting = mockServiceWorker as unknown as ServiceWorker;
    
    render(<PWAUpdateNotification />);
    
    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });
    
    const dismissButton = screen.getByRole('button', { name: '' }); // X button has no text
    fireEvent.click(dismissButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument();
    });
  });
});