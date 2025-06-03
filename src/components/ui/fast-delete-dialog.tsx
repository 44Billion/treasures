/**
 * Fast deletion dialog with minimal UI for better performance
 */

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteGeocache } from '@/hooks/useDeleteGeocache';
import type { Geocache } from '@/types/geocache';

interface FastDeleteDialogProps {
  geocache: Geocache | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FastDeleteDialog({ 
  geocache, 
  isOpen, 
  onClose, 
  onSuccess 
}: FastDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { mutateAsync: deleteGeocache } = useDeleteGeocache();

  const handleDelete = async () => {
    if (!geocache) return;

    setIsDeleting(true);
    try {
      await deleteGeocache({
        geocacheId: geocache.id,
        reason: 'Deleted by author',
      });
      
      onSuccess?.();
      onClose();
    } catch (error) {
      // Error is handled by the hook's onError callback
    } finally {
      setIsDeleting(false);
    }
  };

  if (!geocache) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Geocache
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{geocache.name}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}