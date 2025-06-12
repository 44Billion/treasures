/**
 * Common type definitions used across the application
 */

/** Generic API response wrapper */
export interface ApiResponse<T = unknown> {
  data: T;
  error?: string;
  success: boolean;
}

/** Generic error type for consistent error handling */
export interface AppError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

/** Coordinates type for geographic locations */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Generic pagination parameters */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/** Generic sort parameters */
export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

/** Generic filter parameters */
export interface FilterParams {
  [key: string]: string | number | boolean | undefined;
}

/** Query options for data fetching */
export interface QueryOptions extends PaginationParams {
  sort?: SortParams;
  filters?: FilterParams;
}

/** Generic ID type for entities */
export type EntityId = string;

/** Generic timestamp type */
export type Timestamp = number;

/** Generic status type for entities */
export type EntityStatus = 'active' | 'inactive' | 'pending' | 'deleted';

/** File upload result */
export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  type: string;
}

/** Generic form field props */
export interface FormFieldProps {
  fieldId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

/** Generic select field props */
export interface SelectFieldProps extends FormFieldProps {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

/** Generic async operation state */
export interface AsyncState<T = unknown> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

/** Generic cache entry */
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: Timestamp;
  expiresAt?: Timestamp;
}

/** Generic event handler type */
export type EventHandler<T = Event> = (event: T) => void;

/** Generic callback type */
export type Callback<T = void> = () => T;

/** Generic async callback type */
export type AsyncCallback<T = void> = () => Promise<T>;

/** Generic validation result */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/** Generic configuration object */
export interface Config {
  [key: string]: string | number | boolean | Config;
}

/** Generic metadata object */
export interface Metadata {
  [key: string]: unknown;
}