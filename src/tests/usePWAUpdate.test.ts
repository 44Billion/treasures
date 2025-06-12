import { renderHook, act } from '@testing-library/react';
import { usePWAUpdate } from '@/shared/hooks/usePWAUpdate';

// Mock service worker
const mockServiceWorker = {
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'installed',
};

const mockRegistration = {
  waiting: null as ServiceWorker | null,
  installing: null as ServiceWorker | null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  update: vi.fn(),
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

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: vi.fn(),
  },
  writable: true,
});

describe('usePWAUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistration.waiting = null;
    mockRegistration.installing = null;
    mockRegistration.update.mockResolvedValue(undefined);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => usePWAUpdate());

    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.needsRefresh).toBe(false);
    expect(result.current.checkingForUpdate).toBe(false);
  });

  it('should detect waiting worker on initialization', async () => {
    mockRegistration.waiting = mockServiceWorker as unknown as ServiceWorker;
    
    const { result } = renderHook(() => usePWAUpdate());

    // Wait for the effect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.updateAvailable).toBe(true);
  });

  it('should check for updates', async () => {
    const { result } = renderHook(() => usePWAUpdate());

    // Wait for the hook to initialize
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      const success = await result.current.checkForUpdate();
      expect(success).toBe(true);
    });

    expect(mockRegistration.update).toHaveBeenCalled();
  });

  it('should handle check for updates failure', async () => {
    mockRegistration.update.mockRejectedValue(new Error('Update failed'));
    
    const { result } = renderHook(() => usePWAUpdate());

    await act(async () => {
      const success = await result.current.checkForUpdate();
      expect(success).toBe(false);
    });

    expect(result.current.checkingForUpdate).toBe(false);
  });

  it('should apply update', async () => {
    mockRegistration.waiting = mockServiceWorker as unknown as ServiceWorker;
    
    const { result } = renderHook(() => usePWAUpdate());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.applyUpdate();
    });

    expect(mockServiceWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(result.current.isUpdating).toBe(true);
  });

  it('should reload app', async () => {
    const { result } = renderHook(() => usePWAUpdate());

    await act(async () => {
      result.current.reloadApp();
    });

    expect(window.location.reload).toHaveBeenCalled();
  });

  it('should dismiss update', async () => {
    mockRegistration.waiting = mockServiceWorker as unknown as ServiceWorker;
    
    const { result } = renderHook(() => usePWAUpdate());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.dismissUpdate();
    });

    expect(result.current.updateAvailable).toBe(false);
  });

  it('should handle controller change', async () => {
    const { result } = renderHook(() => usePWAUpdate());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Simulate controller change event
    const controllerChangeHandler = (navigator.serviceWorker.addEventListener as any).mock.calls
      .find((call: any[]) => call[0] === 'controllerchange')?.[1];

    if (controllerChangeHandler) {
      await act(async () => {
        controllerChangeHandler();
      });

      expect(result.current.needsRefresh).toBe(true);
      expect(result.current.isUpdating).toBe(false);
    }
  });
});