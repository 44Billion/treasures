import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScrollToTop } from '@/components/ScrollToTop';

// Mock window.scrollTo
const mockScrollTo = vi.fn();
Object.defineProperty(window, 'scrollTo', {
  value: mockScrollTo,
  writable: true,
});

// Mock querySelector to return null (no main element)
const mockQuerySelector = vi.fn(() => null);
Object.defineProperty(document, 'querySelector', {
  value: mockQuerySelector,
  writable: true,
});

const mockQuerySelectorAll = vi.fn(() => []);
Object.defineProperty(document, 'querySelectorAll', {
  value: mockQuerySelectorAll,
  writable: true,
});

describe('ScrollToTop', () => {
  beforeEach(() => {
    mockScrollTo.mockClear();
    mockQuerySelector.mockClear();
    mockQuerySelectorAll.mockClear();
  });

  it('should scroll to top on initial render', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
      </MemoryRouter>
    );

    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'instant'
    });
  });

  it('should render without crashing', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <ScrollToTop />
        </MemoryRouter>
      );
    }).not.toThrow();
  });

  it('should not render any visible content', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });
});