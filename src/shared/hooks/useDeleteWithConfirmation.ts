import { useState } from 'react';
import { useDeleteGeocache } from '@/features/geocache/hooks/useDeleteGeocache';
import { useBatchDeleteGeocaches } from '@/features/geocache/hooks/useBatchDeleteGeocaches';
import type { NostrEvent } from '@nostrify/nostrify';

interface GeocacheToDelete {
  id: string;
  name: string;
  event?: NostrEvent;
}

export function useDeleteWithConfirmation() {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<{
    type: 'single' | 'batch';
    geocaches: GeocacheToDelete[];
    reason?: string;
    onSuccess?: () => void;
  } | null>(null);

  const { mutate: deleteSingle, isPending: isDeletingSingle } = useDeleteGeocache();
  const { mutate: deleteBatch, isPending: isDeletingBatch } = useBatchDeleteGeocaches();

  const isDeletingAny = isDeletingSingle || isDeletingBatch;

  const confirmSingleDeletion = (
    geocache: GeocacheToDelete,
    reason?: string,
    onSuccess?: () => void
  ) => {
    setPendingDeletion({
      type: 'single',
      geocaches: [geocache],
      reason,
      onSuccess,
    });
    setIsConfirmDialogOpen(true);
  };

  const confirmBatchDeletion = (
    geocaches: GeocacheToDelete[],
    reason?: string,
    onSuccess?: () => void
  ) => {
    setPendingDeletion({
      type: 'batch',
      geocaches,
      reason,
      onSuccess,
    });
    setIsConfirmDialogOpen(true);
  };

  const executeDeletion = () => {
    if (!pendingDeletion) return;

    const { type, geocaches, reason, onSuccess } = pendingDeletion;

    if (type === 'single' && geocaches.length === 1) {
      const geocache = geocaches[0];
      deleteSingle({
        geocacheId: geocache.id,
        geocacheEvent: geocache.event,
        reason: reason || 'Deleted by cache owner'
      }, {
        onSuccess: () => {
          onSuccess?.();
          setIsConfirmDialogOpen(false);
          setPendingDeletion(null);
        },
        onError: (error) => {
          // Only keep dialog open for signing errors
          const errorObj = error as { message?: string };
          const isSigningError = errorObj.message?.includes('User rejected') || 
                                errorObj.message?.includes('cancelled') ||
                                errorObj.message?.includes('No signer');
          
          if (!isSigningError) {
            // For network errors, close dialog since deletion was optimistic
            setIsConfirmDialogOpen(false);
            setPendingDeletion(null);
          }
          // For signing errors, keep dialog open so user can try again
        }
      });
    } else if (type === 'batch') {
      deleteBatch({
        geocaches: geocaches.map(g => ({ id: g.id, event: g.event })),
        reason: reason || 'Deleted by cache owner'
      }, {
        onSuccess: () => {
          onSuccess?.();
          setIsConfirmDialogOpen(false);
          setPendingDeletion(null);
        },
        onError: (error) => {
          // Only keep dialog open for signing errors
          const errorObj = error as { message?: string };
          const isSigningError = errorObj.message?.includes('User rejected') || 
                                errorObj.message?.includes('cancelled') ||
                                errorObj.message?.includes('No signer');
          
          if (!isSigningError) {
            // For network errors, close dialog since deletion was optimistic
            setIsConfirmDialogOpen(false);
            setPendingDeletion(null);
          }
          // For signing errors, keep dialog open so user can try again
        }
      });
    }
  };

  const cancelDeletion = () => {
    setIsConfirmDialogOpen(false);
    setPendingDeletion(null);
  };

  const getConfirmationMessage = () => {
    if (!pendingDeletion) return '';

    const { type, geocaches } = pendingDeletion;
    
    if (type === 'single') {
      return `Are you sure you want to delete "${geocaches[0].name}"? The deletion request will be sent to relays immediately.`;
    } else {
      return `Are you sure you want to delete ${geocaches.length} geocaches? Deletion requests will be sent to relays for all selected geocaches.`;
    }
  };

  const getConfirmationTitle = () => {
    if (!pendingDeletion) return '';

    const { type, geocaches } = pendingDeletion;
    
    if (type === 'single') {
      return 'Delete Geocache?';
    } else {
      return `Delete ${geocaches.length} Geocaches?`;
    }
  };

  return {
    // State
    isConfirmDialogOpen,
    isDeletingAny,
    pendingDeletion,
    
    // Actions
    confirmSingleDeletion,
    confirmBatchDeletion,
    executeDeletion,
    cancelDeletion,
    
    // UI helpers
    getConfirmationMessage,
    getConfirmationTitle,
  };
}