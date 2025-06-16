import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WotSettings } from './WotSettings';
import { useWotStore } from '../shared/stores/useWotStore';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '../features/auth/hooks/useCurrentUser';

// Mock the hooks
vi.mock('../shared/stores/useWotStore');
vi.mock('@nostrify/react');
vi.mock('../features/auth/hooks/useCurrentUser');

const renderComponent = () => {
  return render(<WotSettings />);
};

// Mock the hooks
vi.mock('../shared/stores/useWotStore');
vi.mock('@nostrify/react');
vi.mock('../features/auth/hooks/useCurrentUser');

describe('WotSettings', () => {
  const mockUseWotStore = useWotStore as jest.Mock;
  const mockUseNostr = useNostr as jest.Mock;
  const mockUseCurrentUser = useCurrentUser as jest.Mock;

  beforeEach(() => {
    mockUseWotStore.mockReturnValue({
      isWotEnabled: true,
      degrees: 2,
      startingPoint: '',
      wotPubkeys: new Set(['pubkey1', 'pubkey2']),
      isLoading: false,
      lastCalculated: Date.now(),
      progress: 0,
      followLimit: 250,
      setFollowLimit: vi.fn(),
      setEnabled: vi.fn(),
      setDegrees: vi.fn(),
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
    expect(screen.getByLabelText('Enable Web of Trust Filter')).toBeChecked();
    expect(screen.getByText('Follow Limit')).toBeInTheDocument();
    expect(screen.getByText(/Found 2 trusted authors/)).toBeInTheDocument();
  });

  it('calls setEnabled when the switch is toggled', () => {
    const setEnabled = vi.fn();
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), setEnabled });
    render(<WotSettings />);
    fireEvent.click(screen.getByLabelText('Enable Web of Trust Filter'));
    expect(setEnabled).toHaveBeenCalledWith(false);
  });

  it('calls setFollowLimit when a follow limit button is clicked', () => {
    const setFollowLimit = vi.fn();
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), setFollowLimit, followLimit: 250 });
    render(<WotSettings />);
    fireEvent.click(screen.getByText('500'));
    expect(setFollowLimit).toHaveBeenCalledWith(500);
  });

  it('calls calculateWot when the "Recalculate Now" button is clicked', () => {
    const calculateWot = vi.fn();
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), calculateWot });
    render(<WotSettings />);
    fireEvent.click(screen.getByText('Recalculate Now'));
    expect(calculateWot).toHaveBeenCalled();
  });

  it('shows the progress bar when loading', () => {
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), isLoading: true, progress: 50 });
    render(<WotSettings />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('calls cancelCalculation when the "Cancel" button is clicked', () => {
    const cancelCalculation = vi.fn();
    mockUseWotStore.mockReturnValueOnce({ ...mockUseWotStore(), isLoading: true, cancelCalculation });
    render(<WotSettings />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(cancelCalculation).toHaveBeenCalled();
  });
});
