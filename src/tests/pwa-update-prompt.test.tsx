import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt';

// Mock the virtual:pwa-register/react module
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(() => ({
    offlineReady: [false, vi.fn()],
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  })),
}));

describe('PWAUpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when needRefresh is false', () => {
    const { container } = render(<PWAUpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('should render update prompt when needRefresh is true', async () => {
    const { useRegisterSW } = await import('virtual:pwa-register/react');
    
    vi.mocked(useRegisterSW).mockReturnValue({
      offlineReady: [false, vi.fn()],
      needRefresh: [true, vi.fn()],
      updateServiceWorker: vi.fn(),
    });

    render(<PWAUpdatePrompt />);
    
    await waitFor(() => {
      expect(screen.getByText(/Update available/i)).toBeInTheDocument();
    });
  });

  it('should call updateServiceWorker when update button is clicked', async () => {
    const updateServiceWorker = vi.fn();
    const { useRegisterSW } = await import('virtual:pwa-register/react');
    
    vi.mocked(useRegisterSW).mockReturnValue({
      offlineReady: [false, vi.fn()],
      needRefresh: [true, vi.fn()],
      updateServiceWorker,
    });

    const user = userEvent.setup();
    render(<PWAUpdatePrompt />);
    
    await waitFor(() => {
      expect(screen.getByText(/Update available/i)).toBeInTheDocument();
    });

    const updateButton = screen.getByRole('button', { name: /Update available/i });
    await user.click(updateButton);

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('should hide prompt when dismiss button is clicked', async () => {
    const { useRegisterSW } = await import('virtual:pwa-register/react');
    
    vi.mocked(useRegisterSW).mockReturnValue({
      offlineReady: [false, vi.fn()],
      needRefresh: [true, vi.fn()],
      updateServiceWorker: vi.fn(),
    });

    const user = userEvent.setup();
    render(<PWAUpdatePrompt />);
    
    await waitFor(() => {
      expect(screen.getByText(/Update available/i)).toBeInTheDocument();
    });

    const dismissButton = screen.getByRole('button', { name: /Dismiss update notification/i });
    await user.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText(/Update available/i)).not.toBeInTheDocument();
    });
  });

  it('should show updating state when update is in progress', async () => {
    const updateServiceWorker = vi.fn();
    const { useRegisterSW } = await import('virtual:pwa-register/react');
    
    vi.mocked(useRegisterSW).mockReturnValue({
      offlineReady: [false, vi.fn()],
      needRefresh: [true, vi.fn()],
      updateServiceWorker,
    });

    const user = userEvent.setup();
    render(<PWAUpdatePrompt />);
    
    await waitFor(() => {
      expect(screen.getByText(/Update available/i)).toBeInTheDocument();
    });

    const updateButton = screen.getByRole('button', { name: /Update available/i });
    await user.click(updateButton);

    await waitFor(() => {
      expect(screen.getByText(/Updating.../i)).toBeInTheDocument();
    });
  });

  it('should log when service worker is registered', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const mockRegistration = {
      update: vi.fn(),
    };

    const { useRegisterSW } = await import('virtual:pwa-register/react');
    
    const mockUseRegisterSW = vi.fn((options: any) => {
      // Call onRegisteredSW immediately to simulate registration
      if (options?.onRegisteredSW) {
        options.onRegisteredSW('test-sw-url', mockRegistration);
      }
      return {
        offlineReady: [false, vi.fn()] as [boolean, ReturnType<typeof vi.fn>],
        needRefresh: [false, vi.fn()] as [boolean, ReturnType<typeof vi.fn>],
        updateServiceWorker: vi.fn(),
      };
    });

    vi.mocked(useRegisterSW).mockImplementation(mockUseRegisterSW as any);

    render(<PWAUpdatePrompt />);

    expect(consoleSpy).toHaveBeenCalledWith('[PWA] Service worker registered:', 'test-sw-url');
    
    consoleSpy.mockRestore();
  });

  it('should log when app is ready to work offline', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { useRegisterSW } = await import('virtual:pwa-register/react');
    
    vi.mocked(useRegisterSW).mockReturnValue({
      offlineReady: [true, vi.fn()],
      needRefresh: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    });

    render(<PWAUpdatePrompt />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('[PWA] App ready to work offline');
    });
    
    consoleSpy.mockRestore();
  });
});
