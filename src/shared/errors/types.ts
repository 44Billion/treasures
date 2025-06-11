/**
 * Error types and interfaces for consistent error handling
 */

export interface AppError extends Error {
  code?: string;
  context?: string;
  details?: Record<string, unknown>;
  timestamp?: number;
}

export interface NetworkError extends AppError {
  status?: number;
  statusText?: string;
  url?: string;
}

export interface ValidationError extends AppError {
  field?: string;
  value?: unknown;
  rule?: string;
}

export interface NostrError extends AppError {
  relay?: string;
  eventId?: string;
  pubkey?: string;
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  NOSTR = 'nostr',
  STORAGE = 'storage',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown'
}

export interface ErrorReport {
  error: AppError;
  severity: ErrorSeverity;
  category: ErrorCategory;
  timestamp: number;
  userAgent?: string;
  url?: string;
  userId?: string;
}

// Factory functions for creating typed errors
export function createNetworkError(
  message: string,
  status?: number,
  url?: string
): NetworkError {
  const error = new Error(message) as NetworkError;
  error.name = 'NetworkError';
  error.status = status;
  error.url = url;
  error.timestamp = Date.now();
  return error;
}

export function createValidationError(
  message: string,
  field?: string,
  value?: unknown
): ValidationError {
  const error = new Error(message) as ValidationError;
  error.name = 'ValidationError';
  error.field = field;
  error.value = value;
  error.timestamp = Date.now();
  return error;
}

export function createNostrError(
  message: string,
  relay?: string,
  eventId?: string
): NostrError {
  const error = new Error(message) as NostrError;
  error.name = 'NostrError';
  error.relay = relay;
  error.eventId = eventId;
  error.timestamp = Date.now();
  return error;
}

// Type guards
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof Error && error.name === 'NetworkError';
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof Error && error.name === 'ValidationError';
}

export function isNostrError(error: unknown): error is NostrError {
  return error instanceof Error && error.name === 'NostrError';
}