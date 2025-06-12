import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditProfileForm } from '../components/EditProfileForm';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useUploadFile } from '@/shared/hooks/useUploadFile';
import { useToast } from '@/shared/hooks/useToast';

// Mock the hooks
vi.mock('@/features/auth/hooks/useCurrentUser');
vi.mock('@/shared/hooks/useNostrPublish');
vi.mock('@/hooks/useUploadFile');
vi.mock('@/shared/hooks/useToast');

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUseNostrPublish = vi.mocked(useNostrPublish);
const mockUseUploadFile = vi.mocked(useUploadFile);
const mockUseToast = vi.mocked(useToast);

describe('EditProfileForm', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup default mocks
    mockUseCurrentUser.mockReturnValue({
      user: {
        pubkey: 'test-pubkey',
        signer: {} as any,
      },
      metadata: {
        name: 'Test User',
        about: 'Test bio',
        picture: 'https://example.com/pic.jpg',
      },
    });

    mockUseNostrPublish.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    mockUseUploadFile.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    mockUseToast.mockReturnValue({
      toast: vi.fn(),
    });
  });

  it('renders basic information section', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileForm />
      </QueryClientProvider>
    );

    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Your public profile information that others will see.')).toBeInTheDocument();
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Bio')).toBeInTheDocument();
  });

  it('renders profile images section', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileForm />
      </QueryClientProvider>
    );

    expect(screen.getByText('Profile Images')).toBeInTheDocument();
    expect(screen.getByText('Upload or provide URLs for your profile picture and banner.')).toBeInTheDocument();
    expect(screen.getByLabelText('Profile Picture')).toBeInTheDocument();
    expect(screen.getByLabelText('Banner Image')).toBeInTheDocument();
  });

  it('renders advanced options in accordion', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileForm />
      </QueryClientProvider>
    );

    expect(screen.getByText('Advanced Options')).toBeInTheDocument();
    
    // Advanced options should be collapsed by default
    expect(screen.queryByLabelText('Website')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('NIP-05 Identifier')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bot Account')).not.toBeInTheDocument();
  });

  it('shows advanced options when accordion is expanded', async () => {
    const user = userEvent.setup();
    
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileForm />
      </QueryClientProvider>
    );

    // Click on the accordion trigger
    await user.click(screen.getByText('Advanced Options'));

    // Advanced options should now be visible
    expect(screen.getByLabelText('Website')).toBeInTheDocument();
    expect(screen.getByLabelText('NIP-05 Identifier')).toBeInTheDocument();
    expect(screen.getByLabelText('Bot Account')).toBeInTheDocument();
  });

  it('renders save button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileForm />
      </QueryClientProvider>
    );

    expect(screen.getByRole('button', { name: 'Save Profile' })).toBeInTheDocument();
  });

  it('renders cancel button when onSuccess prop is provided', () => {
    const onSuccess = vi.fn();
    
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileForm onSuccess={onSuccess} />
      </QueryClientProvider>
    );

    expect(screen.getByRole('button', { name: 'Save Profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('populates form with existing metadata', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EditProfileForm />
      </QueryClientProvider>
    );

    const nameInput = screen.getByLabelText('Display Name') as HTMLInputElement;
    const bioInput = screen.getByLabelText('Bio') as HTMLTextAreaElement;
    const pictureInput = screen.getByLabelText('Profile Picture') as HTMLInputElement;

    expect(nameInput.value).toBe('Test User');
    expect(bioInput.value).toBe('Test bio');
    expect(pictureInput.value).toBe('https://example.com/pic.jpg');
  });
});