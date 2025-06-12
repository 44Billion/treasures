import { useCallback } from 'react';
import { toast } from 'sonner';
import { getErrorMessage, logError } from '@/shared/utils/errorUtils';

export interface ErrorHandlerOptions {
  showToast?: boolean;
  toastTitle?: string;
  logToConsole?: boolean;
  context?: string;
  fallbackMessage?: string;
}

export function useErrorHandler() {
  const handleError = useCallback((
    error: unknown, 
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      toastTitle = 'Error',
      logToConsole = true,
      context = 'Unknown',
      fallbackMessage = 'An unexpected error occurred'
    } = options;

    const errorMessage = getErrorMessage(error) || fallbackMessage;

    // Log to console if enabled
    if (logToConsole) {
      logError(context, error);
    }

    // Show toast notification if enabled
    if (showToast) {
      toast.error(toastTitle, {
        description: errorMessage,
        duration: 5000,
      });
    }

    return errorMessage;
  }, []);

  // Specialized handlers for common scenarios
  const handleNetworkError = useCallback((error: unknown) => {
    return handleError(error, {
      toastTitle: 'Network Error',
      context: 'Network Operation',
      fallbackMessage: 'Unable to connect to the server. Please check your internet connection.',
    });
  }, [handleError]);

  const handleValidationError = useCallback((error: unknown) => {
    return handleError(error, {
      toastTitle: 'Validation Error',
      context: 'Form Validation',
      fallbackMessage: 'Please check your input and try again.',
    });
  }, [handleError]);

  const handleNostrError = useCallback((error: unknown) => {
    return handleError(error, {
      toastTitle: 'Nostr Error',
      context: 'Nostr Operation',
      fallbackMessage: 'Unable to complete Nostr operation. Please try again.',
    });
  }, [handleError]);

  const handleSilentError = useCallback((error: unknown, context?: string) => {
    return handleError(error, {
      showToast: false,
      context: context || 'Silent Operation',
    });
  }, [handleError]);

  return {
    handleError,
    handleNetworkError,
    handleValidationError,
    handleNostrError,
    handleSilentError,
  };
}

// Hook for handling async operations with error handling
export function useAsyncErrorHandler() {
  const { handleError } = useErrorHandler();

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    options?: ErrorHandlerOptions
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      handleError(error, options);
      return null;
    }
  }, [handleError]);

  return { executeWithErrorHandling };
}