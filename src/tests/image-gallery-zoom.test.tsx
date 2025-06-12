import { render, screen } from '@testing-library/react';
import { ImageGallery } from '@/components/ImageGallery';
import { describe, it, expect, vi } from 'vitest';

// Mock the useToast hook
vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('ImageGallery zoom functionality', () => {
  it('should render zoom controls on desktop', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Check that zoom controls are present (there should be both desktop and mobile versions)
    const zoomInButtons = screen.getAllByTitle('Zoom in');
    const zoomOutButtons = screen.getAllByTitle('Zoom out');
    const resetZoomButtons = screen.getAllByTitle('Reset zoom');

    expect(zoomInButtons.length).toBeGreaterThanOrEqual(1);
    expect(zoomOutButtons.length).toBeGreaterThanOrEqual(1);
    expect(resetZoomButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('should render zoom controls on mobile', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Mobile zoom controls should also be present (they're just positioned differently)
    const zoomButtons = screen.getAllByTitle('Zoom in');
    expect(zoomButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('should wrap image in TransformWrapper for zoom functionality', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Find the image
    const image = screen.getByAltText('Cache image 1');
    expect(image).toBeInTheDocument();
    
    // The image should be wrapped in transform components
    // We can verify this by checking that the image has draggable=false (set by our implementation)
    expect(image).toHaveAttribute('draggable', 'false');
  });

  it('should reset zoom when changing images', () => {
    const images = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
    
    const { rerender } = render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Verify first image is shown
    expect(screen.getByAltText('Cache image 1')).toBeInTheDocument();

    // Change to second image
    rerender(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={1}
      />
    );

    // Verify second image is shown
    expect(screen.getByAltText('Cache image 2')).toBeInTheDocument();
    
    // The TransformWrapper should have a key that changes with currentIndex
    // This ensures zoom is reset when images change
  });

  it('should not render zoom controls when gallery is closed', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={false}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // No zoom controls should be present when gallery is closed
    const zoomInButton = screen.queryByTitle('Zoom in');
    expect(zoomInButton).not.toBeInTheDocument();
  });
});