import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BlurredImage } from '@/components/BlurredImage';

describe('BlurredImage', () => {
  const defaultProps = {
    src: 'https://example.com/image.jpg',
    alt: 'Test image',
  };

  it('renders image with blur by default', () => {
    render(<BlurredImage {...defaultProps} />);
    
    const image = screen.getByAltText('Test image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveClass('blur-md'); // default medium blur
  });

  it('shows center eye overlay when blurred', () => {
    render(<BlurredImage {...defaultProps} />);
    
    const centerEyeButton = screen.getByTitle('Show image');
    expect(centerEyeButton).toBeInTheDocument();
  });

  it('unhides image when center eye is clicked', () => {
    render(<BlurredImage {...defaultProps} />);
    
    const image = screen.getByAltText('Test image');
    const centerEyeButton = screen.getByTitle('Show image');
    
    // Initially blurred
    expect(image).toHaveClass('blur-md');
    
    // Click center eye to unblur
    fireEvent.click(centerEyeButton);
    expect(image).not.toHaveClass('blur-md');
    
    // Corner blur button should now be visible
    expect(screen.getByTitle('Blur image')).toBeInTheDocument();
  });

  it('shows corner blur button when not blurred', () => {
    render(<BlurredImage {...defaultProps} defaultBlurred={false} />);
    
    const image = screen.getByAltText('Test image');
    expect(image).not.toHaveClass('blur-md');
    
    // Corner button should be visible
    const blurButton = screen.getByTitle('Blur image');
    expect(blurButton).toBeInTheDocument();
    
    // Click to blur
    fireEvent.click(blurButton);
    expect(image).toHaveClass('blur-md');
  });

  it('calls onClick when image is clicked', () => {
    const handleClick = vi.fn();
    render(<BlurredImage {...defaultProps} onClick={handleClick} />);
    
    const image = screen.getByAltText('Test image');
    fireEvent.click(image);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when center eye button is clicked', () => {
    const handleClick = vi.fn();
    render(<BlurredImage {...defaultProps} onClick={handleClick} />);
    
    const centerEyeButton = screen.getByTitle('Show image');
    fireEvent.click(centerEyeButton);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies different blur intensities', () => {
    const { rerender } = render(
      <BlurredImage {...defaultProps} blurIntensity="light" />
    );
    
    let image = screen.getByAltText('Test image');
    expect(image).toHaveClass('blur-sm');
    
    rerender(<BlurredImage {...defaultProps} blurIntensity="heavy" />);
    image = screen.getByAltText('Test image');
    expect(image).toHaveClass('blur-lg');
  });

  it('can start unblurred when defaultBlurred is false', () => {
    render(<BlurredImage {...defaultProps} defaultBlurred={false} />);
    
    const image = screen.getByAltText('Test image');
    expect(image).not.toHaveClass('blur-md');
    expect(screen.getByTitle('Blur image')).toBeInTheDocument();
    expect(screen.queryByTitle('Show image')).not.toBeInTheDocument();
  });

  it('hides toggle when showToggle is false', () => {
    render(<BlurredImage {...defaultProps} showToggle={false} />);
    
    expect(screen.queryByTitle('Show image')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Blur image')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<BlurredImage {...defaultProps} className="custom-class" />);
    
    const container = screen.getByAltText('Test image').parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('shows clickable center overlay when blurred', () => {
    render(<BlurredImage {...defaultProps} />);
    
    // The center overlay should be clickable
    const centerButton = screen.getByTitle('Show image');
    expect(centerButton).toBeInTheDocument();
    expect(centerButton.tagName).toBe('BUTTON');
  });

  it('hides center overlay when not blurred', () => {
    render(<BlurredImage {...defaultProps} defaultBlurred={false} />);
    
    // Should not have center overlay when not blurred
    expect(screen.queryByTitle('Show image')).not.toBeInTheDocument();
    // Should have corner blur button
    expect(screen.getByTitle('Blur image')).toBeInTheDocument();
  });
});