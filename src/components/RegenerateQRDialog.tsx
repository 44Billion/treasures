import { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VerificationQRDialog } from '@/components/VerificationQRDialog';
import { useRegenerateVerificationKey } from '@/features/geocache/hooks/useRegenerateVerificationKey';
import { geocacheToNaddr } from '@/shared/utils/naddr';
import type { Geocache } from '@/types/geocache';
import type { VerificationKeyPair } from '@/features/geocache/utils/verification';

interface RegenerateQRDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  geocache: Geocache;
}

export function RegenerateQRDialog({
  isOpen,
  onOpenChange,
  geocache
}: RegenerateQRDialogProps) {
  const [showNewQR, setShowNewQR] = useState(false);
  const [newVerificationKeyPair, setNewVerificationKeyPair] = useState<VerificationKeyPair | null>(null);
  const [operationTimeout, setOperationTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const { mutate: regenerateKey, isPending, reset } = useRegenerateVerificationKey(geocache);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (operationTimeout) {
        clearTimeout(operationTimeout);
      }
    };
  }, [operationTimeout]);

  const handleRegenerate = () => {
    // Clear any existing timeout
    if (operationTimeout) {
      clearTimeout(operationTimeout);
    }

    // Set a timeout to reset the operation if it takes too long (30 seconds)
    const timeout = setTimeout(() => {
      reset();
      console.warn('QR regeneration operation timed out after 30 seconds');
    }, 30000);
    setOperationTimeout(timeout);

    // This creates a new Nostr event (kind 37515) with a new verification key
    // The new event replaces the previous geocache event, invalidating old QR codes
    regenerateKey(undefined, {
      onSuccess: (result) => {
        // Clear the timeout on success
        if (operationTimeout) {
          clearTimeout(operationTimeout);
          setOperationTimeout(null);
        }
        
        // Extract the verification key pair from the result
        const verificationKeyPair = result.verificationKeyPair;
        setNewVerificationKeyPair(verificationKeyPair);
        setShowNewQR(true);
        onOpenChange(false);
      },
      onError: () => {
        // Clear the timeout on error
        if (operationTimeout) {
          clearTimeout(operationTimeout);
          setOperationTimeout(null);
        }
      },
    });
  };

  const handleCancel = () => {
    // Clear any pending timeout
    if (operationTimeout) {
      clearTimeout(operationTimeout);
      setOperationTimeout(null);
    }
    
    // Reset the mutation state if it's pending
    if (isPending) {
      reset();
    }
    
    onOpenChange(false);
  };

  const handleQRDialogClose = () => {
    setShowNewQR(false);
    setNewVerificationKeyPair(null);
    
    // Clear any remaining timeout
    if (operationTimeout) {
      clearTimeout(operationTimeout);
      setOperationTimeout(null);
    }
  };

  const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Regenerate QR Code
            </DialogTitle>
            <DialogDescription>
              This will create a new geocache event with a fresh verification QR code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This action will create a new geocache event and invalidate all previous QR codes. 
                Anyone who tries to use an old QR code will see an "Outdated QR Code" error and must find the new QR code.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                After regenerating:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• A new geocache event will be published to Nostr</li>
                <li>• Old QR codes will immediately stop working</li>
                <li>• You must print and place the new QR code at the cache location</li>
                <li>• Finders with old QR codes will see an "Outdated QR Code" error</li>
                <li>• Remove or cover any old QR codes to avoid confusion</li>
              </ul>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRegenerate}
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    Publishing new event...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Regenerate QR Code
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show new QR code dialog after successful regeneration */}
      {newVerificationKeyPair && (
        <VerificationQRDialog
          isOpen={showNewQR}
          onOpenChange={handleQRDialogClose}
          naddr={naddr}
          verificationKeyPair={newVerificationKeyPair}
          cacheName={geocache.name}
        />
      )}
    </>
  );
}