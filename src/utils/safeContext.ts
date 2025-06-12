/**
 * Safe context creation utility
 * Ensures React is available before creating contexts
 */

import { createContext } from 'react';

/**
 * Safely create a React context with error handling
 * @param defaultValue - The default value for the context
 * @param contextName - Name of the context for error messages
 * @returns React context
 */
export function createSafeContext<T>(defaultValue: T, contextName: string = 'Unknown') {
  // Ensure React is available
  if (typeof createContext !== 'function') {
    throw new Error(`React is not properly loaded when creating ${contextName} context. Please ensure React is available before importing this module.`);
  }

  try {
    return createContext<T>(defaultValue);
  } catch (error) {
    console.error(`Failed to create ${contextName} context:`, error);
    throw new Error(`Failed to create ${contextName} context: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate that React is properly loaded
 * Call this before importing modules that create contexts
 */
export function validateReactAvailability(): void {
  if (typeof createContext !== 'function') {
    throw new Error('React is not properly loaded. Please ensure React is available.');
  }
  
  // Additional checks
  if (typeof window !== 'undefined') {
    // In browser environment, check if React is on window (for debugging)
    if (!(window as any).React && process.env.NODE_ENV === 'development') {
      console.warn('React is not available on window object. This may indicate a bundling issue.');
    }
  }
}