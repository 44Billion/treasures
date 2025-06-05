import { useState } from 'react';
import { RotateCcw, AlertTriangle, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VerificationQRDialog } from '@/components/VerificationQRDialog';
import { useRegenerateVerificationKey } from '@/hooks/useRegenerateVerificationKey';
import { geocacheToNaddr } from '@/lib/naddr-utils';
import type { Geocache } from '@/types/geocache';
import type { VerificationKeyPair } from '@/lib/verification';

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
  
  const { mutate: regenerateKey, isPending } = useRegenerateVerificationKey(geocache);

  const handleRegenerate = () => {
    regenerateKey(undefined, {
      onSuccess: (result) => {
        // Extract the verification key pair from the result
        const verificationKeyPair = result.verificationKeyPair;
        setNewVerificationKeyPair(verificationKeyPair);
        setShowNewQR(true);
        onOpenChange(false);
      },
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleQRDialogClose = () => {
    setShowNewQR(false);
    setNewVerificationKeyPair(null);
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
              This will create a new verification QR code for your geocache.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This action will invalidate the previous QR code and any verified found log events. 
                Finders who have already scanned the old QR code will need to scan the new one to submit verified logs.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                After regenerating:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• The old QR code will stop working</li>
                <li>• You'll need to print and place the new QR code</li>
                <li>• Previous verified logs will remain valid</li>
                <li>• New finders must use the new QR code</li>
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
                    Regenerating...
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