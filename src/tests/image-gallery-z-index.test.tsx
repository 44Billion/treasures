import { render, screen } from '@testing-library/react';
import { ImageGallery } from '@/components/ImageGallery';
import { describe, it, expect, vi } from 'vitest';

// Mock the useToast hook
vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('ImageGallery z-index fix', () => {
  it('should have higher z-index than standard dialogs', () => {
    const images = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Check that the overlay has the correct z-index class
    const overlay = document.querySelector('[class*="z-[100000]"]');
    expect(overlay).toBeInTheDocument();

    // Check that the content has the correct z-index class
    const content = document.querySelector('[class*="z-[100001]"]');
    expect(content).toBeInTheDocument();
  });

  it('should render image gallery when open', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Should show the image
    const image = screen.getByAltText('Cache image 1');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg');
  });

  it('should not render when closed', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={false}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Should not show the image
    const image = screen.queryByAltText('Cache image 1');
    expect(image).not.toBeInTheDocument();
  });
});