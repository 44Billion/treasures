import { useState } from 'react';
import { RotateCcw, AlertTriangle, QrCode, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VerificationQRDialog } from '@/components/VerificationQRDialog';
import { useRegenerateVerificationKey } from '@/features/geocache/hooks/useRegenerateVerificationKey';
import type { VerificationKeyPair } from '@/features/geocache/utils/verification';

interface RegenerateQRDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  naddr: string;
  pubkey: string;
  dTag: string;
  relays?: string[];
  name: string;
}

export function RegenerateQRDialog({
  isOpen,
  onOpenChange,
  naddr,
  pubkey,
  dTag,
  relays,
  name,
}: RegenerateQRDialogProps) {
  const [showNewQR, setShowNewQR] = useState(false);
  const [newVerificationKeyPair, setNewVerificationKeyPair] = useState<VerificationKeyPair | null>(null);
  const [useCompact, setUseCompact] = useState(false);
  
  const { mutate: regenerateKey, isPending, reset } = useRegenerateVerificationKey({ pubkey, dTag, relays });

  const handleRegenerate = (compact: boolean = false) => {
    setUseCompact(compact);
    console.log('[RegenerateQR] Starting regeneration', { compact, dTag });
    
    regenerateKey(undefined, {
      onSuccess: (result) => {
        console.log('[RegenerateQR] Success', { eventId: result.event.id });
        const verificationKeyPair = result.verificationKeyPair;
        setNewVerificationKeyPair(verificationKeyPair);
        setShowNewQR(true);
        onOpenChange(false);
      },
      onError: (error) => {
        console.error('[RegenerateQR] Error', error);
      },
    });
  };

  const handleCancel = () => {
    if (isPending) {
      reset();
    }
    onOpenChange(false);
  };

  const handleQRDialogClose = () => {
    setShowNewQR(false);
    setNewVerificationKeyPair(null);
  };

  

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={isPending} className="flex-1">
                    {isPending ? (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4 mr-2" />
                        Regenerate QR
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleRegenerate(false)}>
                    Standard QR Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRegenerate(true)}>
                    <span className="text-green-600 font-medium">Compact QR Code</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
          cacheName={name}
          useCompact={useCompact}
        />
      )}
    </>
  );
}