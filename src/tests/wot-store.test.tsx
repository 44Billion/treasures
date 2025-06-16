import { renderHook, act } from '@testing-library/react';
import { useWotStore } from '@/shared/stores/useWotStore';
import { NostrClient } from '@nostrify/react';

// Mock NostrClient
const mockNostrClient = {
  query: vi.fn(),
} as unknown as NostrClient;

describe('useWotStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useWotStore.setState(useWotStore.getInitialState());
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should not persist isLoading, progress, or abortController', () => {
    const { result } = renderHook(() => useWotStore());

    // Start a calculation
    act(() => {
      result.current.calculateWot(mockNostrClient, 'test-pubkey');
    });

    // Check that the state is updated
    expect(result.current.isLoading).toBe(true);
    expect(result.current.abortController).toBeInstanceOf(AbortController);

    // Simulate a "hard refresh" by re-creating the store from localStorage
    const savedState = localStorage.getItem('wot-storage');
    expect(savedState).not.toBeNull();

    const parsedState = JSON.parse(savedState!);
    
    // Check that the sensitive fields are not in the persisted state
    expect(parsedState.state.isLoading).toBeUndefined();
    expect(parsedState.state.progress).toBeUndefined();
    expect(parsedState.state.abortController).toBeUndefined();
  });

  it('should cancel a running calculation correctly', () => {
    const { result } = renderHook(() => useWotStore());
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

    act(() => {
      result.current.calculateWot(mockNostrClient, 'test-pubkey');
    });

    expect(result.current.isLoading).toBe(true);
    
    act(() => {
      result.current.cancelCalculation();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.abortController).toBeNull();
    expect(abortSpy).toHaveBeenCalled();
  });

  it('should reset to a clean state after a simulated refresh during calculation', () => {
    const { result: initialResult } = renderHook(() => useWotStore());

    // Start calculation
    act(() => {
      initialResult.current.calculateWot(mockNostrClient, 'test-pubkey');
    });

    // Simulate refresh
    const { result: refreshedResult } = renderHook(() => useWotStore());

    // After refresh, the store should not be in a loading state
    expect(refreshedResult.current.isLoading).toBe(false);
    expect(refreshedResult.current.progress).toBe(0);
    expect(refreshedResult.current.abortController).toBeNull();
  });
});
