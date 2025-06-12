import { useState } from 'react';
import { useToast } from '@/shared/hooks/useToast';

interface UseAsyncActionOptions {
  onSuccess?: (data?: any) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

export function useAsyncAction({
  onSuccess,
  onError,
  successMessage = "Operation completed successfully",
  errorMessage = "Operation failed. Please try again.",
  showSuccessToast = true,
  showErrorToast = true,
}: UseAsyncActionOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const execute = async (asyncFn: () => Promise<any>) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await asyncFn();
      
      if (showSuccessToast) {
        toast({
          title: 'Success',
          description: successMessage,
        });
      }
      
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      setError(error);
      
      if (showErrorToast) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    execute,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}