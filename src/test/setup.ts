import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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

// Mock IndexedDB for offline storage tests
const mockIDBRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
  readyState: 'done',
  source: null,
  transaction: null,
};

const mockIDBDatabase = {
  name: 'test',
  version: 1,
  objectStoreNames: {
    contains: vi.fn(() => false),
  },
  createObjectStore: vi.fn(() => ({
    createIndex: vi.fn(),
  })),
  transaction: vi.fn(() => ({
    objectStore: vi.fn(() => ({
      put: vi.fn(() => mockIDBRequest),
      get: vi.fn(() => mockIDBRequest),
      getAll: vi.fn(() => mockIDBRequest),
      delete: vi.fn(() => mockIDBRequest),
      index: vi.fn(() => ({
        getAll: vi.fn(() => mockIDBRequest),
        openCursor: vi.fn(() => mockIDBRequest),
      })),
    })),
  })),
  close: vi.fn(),
};

const mockIDBFactory = {
  open: vi.fn(() => {
    const request = { ...mockIDBRequest };
    setTimeout(() => {
      (request as any).result = mockIDBDatabase;
      if ((request as any).onsuccess) (request as any).onsuccess({ target: request } as any);
    }, 0);
    return request;
  }),
  deleteDatabase: vi.fn(() => mockIDBRequest),
  databases: vi.fn(() => Promise.resolve([])),
};

Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: mockIDBFactory,
});

// Mock IDBKeyRange
Object.defineProperty(window, 'IDBKeyRange', {
  writable: true,
  value: {
    upperBound: vi.fn((value) => ({ upper: value, upperOpen: false })),
    lowerBound: vi.fn((value) => ({ lower: value, lowerOpen: false })),
    bound: vi.fn((lower, upper) => ({ lower, upper, lowerOpen: false, upperOpen: false })),
    only: vi.fn((value) => ({ lower: value, upper: value, lowerOpen: false, upperOpen: false })),
  },
});

// Mock navigator.storage for storage quota tests
Object.defineProperty(navigator, 'storage', {
  writable: true,
  value: {
    estimate: vi.fn(() => Promise.resolve({ usage: 0, quota: 1000000 })),
  },
});

// Mock caches API for service worker tests
Object.defineProperty(window, 'caches', {
  writable: true,
  value: {
    open: vi.fn(() => Promise.resolve({
      put: vi.fn(() => Promise.resolve()),
      match: vi.fn(() => Promise.resolve()),
      keys: vi.fn(() => Promise.resolve([])),
    })),
    keys: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve(true)),
  },
});