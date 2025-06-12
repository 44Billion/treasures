import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageGallery } from '@/components/ImageGallery';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock react-zoom-pan-pinch
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => <div data-testid="transform-wrapper">{children}</div>,
  TransformComponent: ({ children }: { children: React.ReactNode }) => <div data-testid="transform-component">{children}</div>,
  useControls: () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetTransform: vi.fn(),
  }),
}));

// Mock the useToast hook
const mockToast = vi.fn();
vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock window.open
const mockWindowOpen = vi.fn();
global.window.open = mockWindowOpen;

describe('ImageGallery download functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show download button', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    const downloadButton = screen.getByTitle('Download image');
    expect(downloadButton).toBeInTheDocument();
  });

  it('should attempt to download image when download button is clicked', async () => {
    const images = ['https://example.com/image1.jpg'];
    
    // Mock successful fetch
    const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    const downloadButton = screen.getByTitle('Download image');
    fireEvent.click(downloadButton);

    // Should call fetch with the image URL
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/image1.jpg');
    });

    // Should show success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download started',
        description: 'Downloading image1.jpg',
      });
    });
  });

  it('should handle fetch failure gracefully', async () => {
    const images = ['https://example.com/image1.jpg'];
    
    // Mock failed fetch
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    const downloadButton = screen.getByTitle('Download image');
    fireEvent.click(downloadButton);

    // Should still show success toast for fallback method
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download started',
        description: 'Downloading image1.jpg (fallback method)',
      });
    });
  });

  it('should extract filename from URL correctly', async () => {
    const images = ['https://example.com/path/to/my-image.png?v=123'];
    
    const mockBlob = new Blob(['fake image data'], { type: 'image/png' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    const downloadButton = screen.getByTitle('Download image');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download started',
        description: 'Downloading my-image.png',
      });
    });
  });

  it('should generate default filename for URLs without extension', async () => {
    const images = ['https://example.com/api/image/123'];
    
    const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    const downloadButton = screen.getByTitle('Download image');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download started',
        description: 'Downloading cache-image-1.jpg',
      });
    });
  });

  it('should disable download button while downloading', async () => {
    const images = ['https://example.com/image1.jpg'];
    
    // Mock slow fetch that resolves after a delay
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['fake'], { type: 'image/jpeg' })),
        }), 100)
      )
    );

    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    const downloadButton = screen.getByTitle('Download image');
    fireEvent.click(downloadButton);

    // Button should be disabled and show loading state
    await waitFor(() => {
      const loadingButton = screen.getByTitle('Downloading...');
      expect(loadingButton).toBeInTheDocument();
      expect(loadingButton).toBeDisabled();
    });

    // Wait for download to complete
    await waitFor(() => {
      expect(screen.getByTitle('Download image')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should open image in new tab as final fallback', async () => {
    const images = ['https://example.com/image1.jpg'];
    
    // Mock fetch failure and DOM manipulation failure
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    // Mock document.createElement to throw error for anchor elements only
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        throw new Error('DOM error');
      }
      return originalCreateElement.call(document, tagName);
    });

    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    const downloadButton = screen.getByTitle('Download image');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Download failed',
        description: 'Opening image in new tab instead',
        variant: 'destructive',
      });
    });

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://example.com/image1.jpg',
      '_blank',
      'noopener,noreferrer'
    );

    // Restore original createElement
    document.createElement = originalCreateElement;
  });
});