/**
 * Common type definitions used across the application
 */

import { ReactNode } from 'react';

/**
 * Base props that many components share
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Props for components that can be in loading state
 */
export interface LoadableProps {
  isLoading?: boolean;
  loadingText?: string;
}

/**
 * Props for components that can show errors
 */
export interface ErrorableProps {
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Combined props for components with loading and error states
 */
export interface AsyncComponentProps extends LoadableProps, ErrorableProps {}

/**
 * Props for components that can be disabled
 */
export interface DisableableProps {
  disabled?: boolean;
}

/**
 * Props for components with size variants
 */
export interface SizeableProps {
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Props for components with variant styles
 */
export interface VariantProps {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

/**
 * Common callback function types
 */
export type VoidCallback = () => void;
export type AsyncVoidCallback = () => Promise<void>;
export type ValueCallback<T> = (value: T) => void;
export type AsyncValueCallback<T> = (value: T) => Promise<void>;

/**
 * Common data states
 */
export type DataState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Pagination types
 */
export interface PaginationProps {
  page: number;
  limit: number;
  total?: number;
  onPageChange: (page: number) => void;
}

/**
 * Search/filter types
 */
export interface SearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder?: string;
}

export interface FilterProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
}