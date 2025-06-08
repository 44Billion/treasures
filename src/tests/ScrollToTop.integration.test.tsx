import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScrollToTop } from '@/components/ScrollToTop';
import userEvent from '@testing-library/user-event';

// Mock window.scrollTo
const mockScrollTo = vi.fn();
Object.defineProperty(window, 'scrollTo', {
  value: mockScrollTo,
  writable: true,
});

// Simple test pages
function HomePage() {
  return (
    <div>
      <h1>Home Page</h1>
      <Link to="/about">Go to About</Link>
      <Link to="/contact">Go to Contact</Link>
      <Link to="/about#section1">Go to About Section 1</Link>
    </div>
  );
}

function AboutPage() {
  return (
    <div>
      <h1>About Page</h1>
      <Link to="/">Go to Home</Link>
      <Link to="/contact">Go to Contact</Link>
      <div id="section1">Section 1</div>
    </div>
  );
}

function ContactPage() {
  return (
    <div>
      <h1>Contact Page</h1>
      <Link to="/">Go to Home</Link>
    </div>
  );
}

function TestApp({ initialEntries = ['/'] }: { initialEntries?: string[] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ScrollToTop Integration', () => {
  beforeEach(() => {
    mockScrollTo.mockClear();
  });

  it('should scroll to top when navigating between pages', async () => {
    const user = userEvent.setup();
    
    render(<TestApp />);
    
    // Initial render should trigger scroll to top
    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'instant'
    });
    
    mockScrollTo.mockClear();
    
    // Navigate to About page
    const aboutLink = screen.getByText('Go to About');
    await user.click(aboutLink);
    
    // Should scroll to top on navigation
    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'instant'
    });
    
    mockScrollTo.mockClear();
    
    // Navigate to Contact page
    const contactLink = screen.getByText('Go to Contact');
    await user.click(contactLink);
    
    // Should scroll to top again
    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'instant'
    });
  });

  it('should not scroll to top for hash navigation', async () => {
    const user = userEvent.setup();
    
    render(<TestApp />);
    
    // Clear initial scroll call
    mockScrollTo.mockClear();
    
    // Navigate to hash link (same page)
    const hashLink = screen.getByText('Go to About Section 1');
    await user.click(hashLink);
    
    // Should not scroll to top for hash navigation
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it('should handle initial page load with hash', () => {
    render(<TestApp initialEntries={['/about#section1']} />);
    
    // Should not scroll to top when initially loading a page with hash
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it('should scroll to top when navigating from hash to different page', async () => {
    const user = userEvent.setup();
    
    render(<TestApp initialEntries={['/about#section1']} />);
    
    // Clear any initial calls
    mockScrollTo.mockClear();
    
    // Navigate to different page
    const homeLink = screen.getByText('Go to Home');
    await user.click(homeLink);
    
    // Should scroll to top when changing pages
    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'instant'
    });
  });
});