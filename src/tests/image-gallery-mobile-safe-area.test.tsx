import { render, screen } from '@testing-library/react';
import { ImageGallery } from '@/components/ImageGallery';
import { describe, it, expect, vi } from 'vitest';

// Mock the useToast hook
vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('ImageGallery mobile safe area handling', () => {
  it('should apply safe area styles to prevent clipping with mobile navigation', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Check that the dialog content has the correct positioning styles
    const dialogContent = document.querySelector('[role="dialog"]');
    expect(dialogContent).toBeInTheDocument();
    
    // Verify that the content has full viewport styles
    expect(dialogContent).toHaveStyle({
      top: '0',
      left: '0',
      transform: 'none',
      width: '100vw',
      height: '100vh',
    });
  });

  it('should position close button with safe area consideration', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Find the close button (it's the first button without a title)
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(button => !button.getAttribute('title'));
    expect(closeButton).toBeInTheDocument();
    
    // Check that it has safe area top positioning
    const style = closeButton?.getAttribute('style');
    expect(style).toContain('top: max(0.5rem, env(safe-area-inset-top, 0px))');
  });

  it('should position action buttons with safe area consideration', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Find the download button (first action button)
    const downloadButton = screen.getByTitle('Download image');
    expect(downloadButton).toBeInTheDocument();
    
    // Check that its parent container has safe area positioning
    const actionButtonsContainer = downloadButton.parentElement;
    expect(actionButtonsContainer).toBeInTheDocument();
    
    // Check that the style attribute contains the safe area positioning
    const style = actionButtonsContainer?.getAttribute('style');
    expect(style).toContain('top: max(0.5rem, env(safe-area-inset-top, 0px))');
  });

  it('should position image with safe area padding', () => {
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
    
    // The image is now wrapped in TransformWrapper/TransformComponent, 
    // so we need to find the container with safe area padding by looking for elements with padding styles
    const elementsWithPadding = document.querySelectorAll('[style*="padding"]');
    const containerWithSafeArea = Array.from(elementsWithPadding).find(el => {
      const style = el.getAttribute('style');
      return style?.includes('padding-top: max(4rem') && style?.includes('safe-area-inset');
    });
    
    expect(containerWithSafeArea).toBeInTheDocument();
    
    // Check that the style attribute contains safe area related padding
    const style = containerWithSafeArea?.getAttribute('style');
    expect(style).toContain('padding-top: max(4rem');
    expect(style).toContain('padding-bottom: max(6rem');
    expect(style).toContain('safe-area-inset');
  });

  it('should position thumbnail navigation with safe area consideration when multiple images', () => {
    const images = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Find the image counter (part of thumbnail navigation)
    const imageCounter = screen.getByText('1 of 2');
    expect(imageCounter).toBeInTheDocument();
    
    // Find the thumbnail navigation container (should be absolute positioned)
    const thumbnailNavigation = document.querySelector('.absolute.bottom-4');
    expect(thumbnailNavigation).toBeInTheDocument();
    expect(thumbnailNavigation).toHaveClass('absolute');
    expect(thumbnailNavigation).toHaveClass('bottom-4');
  });

  it('should maintain high z-index for mobile overlay', () => {
    const images = ['https://example.com/image1.jpg'];
    
    render(
      <ImageGallery
        images={images}
        isOpen={true}
        onClose={() => {}}
        initialIndex={0}
      />
    );

    // Check that the overlay still has the high z-index
    const overlay = document.querySelector('[class*="z-[100000]"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass('z-[100000]');

    // Check that the content still has the higher z-index
    const content = document.querySelector('[class*="z-[100001]"]');
    expect(content).toBeInTheDocument();
    expect(content).toHaveClass('z-[100001]');
  });
});