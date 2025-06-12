/**
 * Common validation utilities
 */

import { Location as Coordinates } from '@/features/map/types';

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate required text field
 */
export function validateRequired(value: string, fieldName: string = 'Field'): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  return { isValid: true };
}

/**
 * Validate text length
 */
export function validateLength(
  value: string,
  min: number = 0,
  max: number = Infinity,
  fieldName: string = 'Field'
): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    return { isValid: false, error: `${fieldName} must be at least ${min} characters` };
  }
  if (trimmed.length > max) {
    return { isValid: false, error: `${fieldName} must be no more than ${max} characters` };
  }
  return { isValid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Invalid email format' };
  }
  return { isValid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): ValidationResult {
  try {
    new URL(url.trim());
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate numeric range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = 'Value'
): ValidationResult {
  if (isNaN(value)) {
    return { isValid: false, error: `${fieldName} must be a number` };
  }
  if (value < min || value > max) {
    return { isValid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }
  return { isValid: true };
}

/**
 * Validate coordinates
 */
export function validateCoordinates(coords: Coordinates): ValidationResult {
  const latResult = validateRange(coords.lat, -90, 90, 'Latitude');
  if (!latResult.isValid) return latResult;
  
  const lngResult = validateRange(coords.lng, -180, 180, 'Longitude');
  if (!lngResult.isValid) return lngResult;
  
  return { isValid: true };
}

/**
 * Validate difficulty/terrain ratings
 */
export function validateRating(rating: number, fieldName: string = 'Rating'): ValidationResult {
  return validateRange(rating, 1, 5, fieldName);
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.isValid) {
      return result;
    }
  }
  return { isValid: true };
}

/**
 * Validate geocache form data
 */
export interface GeocacheFormData {
  name: string;
  description: string;
  coordinates: Coordinates;
  difficulty: number;
  terrain: number;
  type: string;
  hint?: string;
  hidden?: boolean;
}

export function validateGeocacheForm(data: GeocacheFormData): ValidationResult {
  return combineValidations(
    validateRequired(data.name, 'Name'),
    validateLength(data.name, 3, 100, 'Name'),
    validateRequired(data.description, 'Description'),
    validateLength(data.description, 10, 1000, 'Description'),
    validateCoordinates(data.coordinates),
    validateRating(data.difficulty, 'Difficulty'),
    validateRating(data.terrain, 'Terrain'),
    validateRequired(data.type, 'Type'),
    data.hint ? validateLength(data.hint, 0, 200, 'Hint') : { isValid: true }
  );
}

/**
 * Validate log form data
 */
export interface LogFormData {
  text: string;
  type: string;
}

export function validateLogForm(data: LogFormData): ValidationResult {
  return combineValidations(
    validateRequired(data.text, 'Log text'),
    validateLength(data.text, 5, 500, 'Log text'),
    validateRequired(data.type, 'Log type')
  );
}