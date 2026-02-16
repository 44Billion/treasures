/**
 * Generic form hook with validation and submission handling
 */

import { useState, useCallback, useMemo } from 'react';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FormField<T> {
  value: T;
  error?: string;
  touched: boolean;
}

export interface FormState<T extends Record<string, any>> {
  fields: { [K in keyof T]: FormField<T[K]> };
  isValid: boolean;
  isSubmitting: boolean;
  submitError?: string;
}

export type FormValidators<T extends Record<string, any>> = {
  [K in keyof T]?: (value: T[K], allValues: T) => ValidationResult;
};

export interface UseFormOptions<T extends Record<string, any>> {
  initialValues: T;
  validators?: FormValidators<T>;
  onSubmit: (values: T) => Promise<void>;
  onSuccess?: (values: T) => void;
  onError?: (error: string) => void;
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

export function useForm<T extends Record<string, any>>({
  initialValues,
  validators = {},
  onSubmit,
  onSuccess,
  onError,
}: UseFormOptions<T>) {
  const [state, setState] = useState<FormState<T>>(() => ({
    fields: Object.keys(initialValues).reduce((acc, key) => {
      acc[key as keyof T] = {
        value: initialValues[key],
        touched: false,
      };
      return acc;
    }, {} as FormState<T>['fields']),
    isValid: false,
    isSubmitting: false,
  }));

  // Get current form values
  const values = useMemo(() => {
    return Object.keys(state.fields).reduce((acc, key) => {
      acc[key as keyof T] = state.fields[key as keyof T].value;
      return acc;
    }, {} as T);
  }, [state.fields]);

  // Validate a single field
  const validateField = useCallback((fieldName: keyof T, value: T[keyof T]) => {
    const validator = validators[fieldName];
    if (!validator) return { isValid: true };
    
    return validator(value, values);
  }, [validators, values]);

  // Validate all fields
  const validateForm = useCallback(() => {
    const fieldValidations: ValidationResult[] = [];
    const newFields = { ...state.fields };
    
    Object.keys(newFields).forEach(key => {
      const fieldKey = key as keyof T;
      const validation = validateField(fieldKey, newFields[fieldKey].value);
      
      newFields[fieldKey] = {
        ...newFields[fieldKey],
        error: validation.isValid ? undefined : validation.error,
      };
      
      fieldValidations.push(validation);
    });

    const overallValidation = combineValidations(...fieldValidations);
    
    setState(prev => ({
      ...prev,
      fields: newFields,
      isValid: overallValidation.isValid,
    }));

    return overallValidation.isValid;
  }, [state.fields, validateField]);

  // Set field value
  const setFieldValue = useCallback((fieldName: keyof T, value: T[keyof T]) => {
    setState(prev => {
      const newFields = {
        ...prev.fields,
        [fieldName]: {
          ...prev.fields[fieldName],
          value,
          touched: true,
        },
      };

      // Validate the field
      const validation = validateField(fieldName, value);
      newFields[fieldName].error = validation.isValid ? undefined : validation.error;

      // Check overall form validity
      const allValidations = Object.keys(newFields).map(key => {
        const fieldKey = key as keyof T;
        const fieldValidator = validators[fieldKey];
        if (!fieldValidator) return { isValid: true };
        return fieldValidator(newFields[fieldKey].value, values);
      });

      const isValid = combineValidations(...allValidations).isValid;

      return {
        ...prev,
        fields: newFields,
        isValid,
      };
    });
  }, [validateField, validators, values]);

  // Set field touched
  const setFieldTouched = useCallback((fieldName: keyof T, touched: boolean = true) => {
    setState(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldName]: {
          ...prev.fields[fieldName],
          touched,
        },
      },
    }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Mark all fields as touched
    setState(prev => ({
      ...prev,
      fields: Object.keys(prev.fields).reduce((acc, key) => {
        acc[key as keyof T] = {
          ...prev.fields[key as keyof T],
          touched: true,
        };
        return acc;
      }, {} as FormState<T>['fields']),
    }));

    // Validate form
    const isValid = validateForm();
    if (!isValid) return;

    setState(prev => ({ ...prev, isSubmitting: true, submitError: undefined }));

    try {
      await onSubmit(values);
      onSuccess?.(values);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Submission failed';
      setState(prev => ({ ...prev, submitError: errorMessage }));
      onError?.(errorMessage);
    } finally {
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [validateForm, onSubmit, onSuccess, onError, values]);

  // Reset form
  const reset = useCallback(() => {
    setState({
      fields: Object.keys(initialValues).reduce((acc, key) => {
        acc[key as keyof T] = {
          value: initialValues[key],
          touched: false,
        };
        return acc;
      }, {} as FormState<T>['fields']),
      isValid: false,
      isSubmitting: false,
      submitError: undefined,
    });
  }, [initialValues]);

  // Get field props for easy binding to inputs
  const getFieldProps = useCallback((fieldName: keyof T) => {
    const field = state.fields[fieldName];
    return {
      value: field.value,
      onChange: (value: T[keyof T]) => setFieldValue(fieldName, value),
      onBlur: () => setFieldTouched(fieldName, true),
      error: field.touched ? field.error : undefined,
      name: fieldName as string,
    };
  }, [state.fields, setFieldValue, setFieldTouched]);

  return {
    values,
    fields: state.fields,
    isValid: state.isValid,
    isSubmitting: state.isSubmitting,
    submitError: state.submitError,
    setFieldValue,
    setFieldTouched,
    getFieldProps,
    handleSubmit,
    reset,
    validateForm,
  };
}