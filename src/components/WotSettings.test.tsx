import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WotSettings } from './WotSettings';
import { useWotStore } from '../shared/stores/useWotStore';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '../features/auth/hooks/useCurrentUser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the hooks
vi.mock('../shared/stores/useWotStore');
vi.mock('@nostrify/react');
vi.mock('../features/auth/hooks/useCurrentUser');

const queryClient = new QueryClient();

const renderComponent = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <WotSettings />
    </QueryClientProvider>
  );
};

describe('WotSettings', () => {
  const mockUseWotStore = useWotStore as jest.Mock;
  const mockUseNostr = useNostr as jest.Mock;
  const mockUseCurrentUser = useCurrentUser as jest.Mock;

  beforeEach(() => {
    mockUseWotStore.mockReturnValue({
      trustLevel: 2,
      startingPoint: '',
      wotPubkeys: new Set(['pubkey1', 'pubkey2']),
      isLoading: false,
      lastCalculated: Date.now(),
      progress: 0,
      followLimit: 250,
      setTrustLevel: vi.fn(),
      setFollowLimit: vi.fn(),
      setStartingPoint: vi.fn(),
      calculateWot: vi.fn(),
      cancelCalculation: vi.fn(),
    });
    mockUseNostr.mockReturnValue({ nostr: {} });
    mockUseCurrentUser.mockReturnValue({ user: { pubkey: 'user_pubkey' } });
  });

  it('renders the component with initial state', () => {
    renderComponent();
    expect(screen.getByText('Web of Trust Filter')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toHaveClass('btn-secondary');
    expect(screen.getByText('Follow Limit')).toBeInTheDocument();
    expect(screen.getByText(/Found 2 trusted authors/)).toBeInTheDocument();
  });

  it('calls setTrustLevel when a trust level button is clicked', () => {
    const setTrustLevel = vi.fn();
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), setTrustLevel });
    renderComponent();
    fireEvent.click(screen.getByText('Strict'));
    expect(setTrustLevel).toHaveBeenCalledWith(1);
  });

  it('calls setFollowLimit when the slider is moved', () => {
    const setFollowLimit = vi.fn();
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), setFollowLimit, followLimit: 250 });
    renderComponent();
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '500' } });
    expect(setFollowLimit).toHaveBeenCalledWith(500);
  });

  it('calls calculateWot when the "Recalculate Now" button is clicked', () => {
    const calculateWot = vi.fn();
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), calculateWot });
    renderComponent();
    fireEvent.click(screen.getByText('Recalculate Now'));
    expect(calculateWot).toHaveBeenCalled();
  });

  it('shows the progress bar when loading', () => {
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), isLoading: true, progress: 50 });
    renderComponent();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('calls cancelCalculation when the "Cancel" button is clicked', () => {
    const cancelCalculation = vi.fn();
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), isLoading: true, cancelCalculation });
    renderComponent();
    fireEvent.click(screen.getByText('Cancel'));
    expect(cancelCalculation).toHaveBeenCalled();
  });
});
