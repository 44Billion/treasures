/**
 * Test setup and configuration for data management tests
 */

import { beforeAll, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock window APIs that might not be available in test environment
beforeAll(() => {
  // Mock window.matchMedia for theme detection
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock document.visibilityState
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    writable: true,
  });

  // Mock window.addEventListener for focus/blur events
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;
  
  window.addEventListener = vi.fn((event, handler, options) => {
    if (['focus', 'blur', 'visibilitychange'].includes(event)) {
      // Store the handler for manual triggering in tests
      return;
    }
    return originalAddEventListener.call(window, event, handler, options);
  });

  window.removeEventListener = vi.fn((event, handler, options) => {
    if (['focus', 'blur', 'visibilitychange'].includes(event)) {
      return;
    }
    return originalRemoveEventListener.call(window, event, handler, options);
  });

  // Mock document.addEventListener for visibilitychange
  const originalDocAddEventListener = document.addEventListener;
  const originalDocRemoveEventListener = document.removeEventListener;
  
  document.addEventListener = vi.fn((event, handler, options) => {
    if (event === 'visibilitychange') {
      return;
    }
    return originalDocAddEventListener.call(document, event, handler, options);
  });

  document.removeEventListener = vi.fn((event, handler, options) => {
    if (event === 'visibilitychange') {
      return;
    }
    return originalDocRemoveEventListener.call(document, event, handler, options);
  });

  // Mock AbortSignal.timeout for older environments
  if (!AbortSignal.timeout) {
    AbortSignal.timeout = vi.fn((delay: number) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), delay);
      return controller.signal;
    });
  }

  // Mock AbortSignal.any for older environments
  if (!AbortSignal.any) {
    AbortSignal.any = vi.fn((signals: AbortSignal[]) => {
      const controller = new AbortController();
      
      signals.forEach(signal => {
        if (signal.aborted) {
          controller.abort();
          return;
        }
        
        signal.addEventListener('abort', () => {
          controller.abort();
        });
      });
      
      return controller.signal;
    });
  }

  // Mock crypto.getRandomValues for verification key generation
  if (!global.crypto) {
    global.crypto = {
      getRandomValues: vi.fn((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      }),
    } as any;
  } else if (!global.crypto.getRandomValues) {
    global.crypto.getRandomValues = vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    });
  }

  // Mock setInterval and clearInterval for timer tests
  global.setInterval = vi.fn(global.setInterval);
  global.clearInterval = vi.fn(global.clearInterval);
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

// Suppress console warnings during tests unless testing error handling
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = vi.fn((...args) => {
  // Allow warnings that start with specific test-related messages
  const message = args[0]?.toString() || '';
  if (message.includes('test') || process.env.VITEST_VERBOSE) {
    originalConsoleWarn(...args);
  }
});

console.error = vi.fn((...args) => {
  // Allow errors that are part of error testing
  const message = args[0]?.toString() || '';
  if (message.includes('test') || process.env.VITEST_VERBOSE) {
    originalConsoleError(...args);
  }
});

// Global test utilities
global.testUtils = {
  // Helper to wait for next tick
  nextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Helper to trigger visibility change
  triggerVisibilityChange: (state: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', {
      value: state,
      writable: true,
    });
    
    const event = new Event('visibilitychange');
    document.dispatchEvent(event);
  },
  
  // Helper to trigger focus/blur
  triggerFocus: () => {
    const event = new Event('focus');
    window.dispatchEvent(event);
  },
  
  triggerBlur: () => {
    const event = new Event('blur');
    window.dispatchEvent(event);
  },
};

// Type augmentation for global test utilities
declare global {
  var testUtils: {
    nextTick: () => Promise<void>;
    triggerVisibilityChange: (state: 'visible' | 'hidden') => void;
    triggerFocus: () => void;
    triggerBlur: () => void;
  };
}