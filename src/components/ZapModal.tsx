import { useAppContext } from '@/shared/hooks/useAppContext';
import { geocacheToNaddr } from '@/shared/utils/naddr';
import { useToast } from '@/shared/hooks/useToast';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import type { WebLNProvider } from 'webln';
import type { ZapTarget } from '@/types/zaps';
import { nip57, nip19, Event } from 'nostr-tools';
import QRCode from 'qrcode';
import { Zap, BadgeCent, Coins, HandCoins, Gem, Copy } from 'lucide-react';
import { chest as chestPaths } from '@lucide/lab';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ZapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ZapTarget;
  webln: WebLNProvider | null;
}

const Chest = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {chestPaths.map(([element, props], index) => 
        React.createElement(element, { key: props.key || index, ...props })
      )}
    </svg>
  )
);

Chest.displayName = "Chest";

const presetAmounts = [
  { amount: 1, icon: BadgeCent },
  { amount: 50, icon: Coins },
  { amount: 100, icon: HandCoins },
  { amount: 250, icon: Gem },
  { amount: 1000, icon: Chest },
];

export function ZapModal({ open, onOpenChange, target, webln }: ZapModalProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { mutate: publishEvent } = useNostrPublish();
  const author = useAuthor(target?.pubkey);
  const [amount, setAmount] = useState<number | string>(100);
  const [comment, setComment] = useState<string>('');

  useEffect(() => {
    if (target) {
      if ('geocacheId' in target) {
        // This is a GeocacheLog
        setComment(`Treasures - Zap for your Log on a Geocache!`);
      } else if ('name' in target) {
        // This is a Geocache
        setComment(`Treasures - Zap for your Geocache: ${target.name}!`);
      } else {
        setComment('Zap for your geocache!');
      }
    }
  }, [target]);
  const [isZapping, setIsZapping] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qrCodeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (invoice && qrCodeRef.current) {
      QRCode.toCanvas(qrCodeRef.current, invoice, { width: 256 });
    }
  }, [invoice]);

  const handleCopy = () => {
    if (invoice) {
      navigator.clipboard.writeText(invoice);
      toast({
        title: 'Copied to clipboard!',
      });
    }
  };

  useEffect(() => {
    if (open) {
      setAmount(100);
      setInvoice(null);
    }
  }, [open]);

    const handleZap = async () => {
    if (!target) return;
    const finalAmount = typeof amount === 'string' ? parseInt(amount, 10) : amount;
    if (finalAmount <= 0) {
      return;
    }

    setIsZapping(true);

    if (!user) {
      toast({
        title: 'Login required',
        description: 'You must be logged in to send a zap.',
        variant: 'destructive',
      });
      setIsZapping(false);
      return;
    }

    try {
      const lud16 = author.data?.metadata?.lud16;
      if (!lud16) {
        toast({
          title: 'Lightning address not found',
          description: 'The author does not have a lightning address configured.',
          variant: 'destructive',
        });
        setIsZapping(false);
        return;
      }

      if (!author.data) {
        toast({
          title: 'Author not found',
          description: 'Could not find the author of this item.',
          variant: 'destructive',
        });
        setIsZapping(false);
        return;
      }

      const zapEndpoint = await nip57.getZapEndpoint(author.data.event as Event);
      if (!zapEndpoint) {
        toast({
          title: 'Zap endpoint not found',
          description: 'Could not find a zap endpoint for the author.',
          variant: 'destructive',
        });
        setIsZapping(false);
        return;
      }

      const zapAmount = finalAmount * 1000; // convert to millisats
      const relays = [config.relayUrl];
      const zapRequest = nip57.makeZapRequest({
        profile: target.pubkey,
        event: target.id,
        amount: zapAmount,
        relays,
        comment: comment,
      });

      if ('dTag' in target && target.dTag) {
        const naddr = geocacheToNaddr(target.pubkey, target.dTag, target.relays, target.kind);
        const decodedNaddr = nip19.decode(naddr).data as nip19.AddressPointer;
        zapRequest.tags.push(["a", `${decodedNaddr.kind}:${decodedNaddr.pubkey}:${decodedNaddr.identifier}`]);
        // remove the e tag
        zapRequest.tags = zapRequest.tags.filter(t => t[0] !== 'e');
      } else if ('naddr' in target && target.naddr) {
        const naddr = nip19.decode(target.naddr).data as nip19.AddressPointer;
        zapRequest.tags.push(["a", `${naddr.kind}:${naddr.pubkey}:${naddr.identifier}`]);
        // remove the e tag
        zapRequest.tags = zapRequest.tags.filter(t => t[0] !== 'e');
      }

      publishEvent(zapRequest, {
        onSuccess: async (event) => {
          try {
            const res = await fetch(`${zapEndpoint}?amount=${zapAmount}&nostr=${encodeURI(JSON.stringify(event))}`);
            const { pr: invoice } = await res.json();

            if (webln) {
              await webln.sendPayment(invoice);
              toast({
                title: 'Zap successful!',
                description: `You sent ${finalAmount} sats to the author.`,
              });
              onOpenChange(false);
            } else {
              setInvoice(invoice);
            }
          } catch (err) {
            console.error('Zap error:', err);
            toast({
              title: 'Zap failed',
              description: (err as Error).message,
              variant: 'destructive',
            });
          } finally {
            setIsZapping(false);
          }
        },
      });
    } catch (err) {
      toast({
        title: 'Zap failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
      setIsZapping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-testid="zap-modal">
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Manual Zap' : 'Send a Zap'}</DialogTitle>
          <DialogDescription asChild>
            {invoice ? (
              <div>Scan the QR code with a lightning-enabled wallet or copy the invoice below.</div>
            ) : (
              <>
                <div>Zaps are small Bitcoin payments that support the creator of this item.</div>
                <div className="mt-2">If you enjoyed this, consider sending a zap!</div>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {invoice ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <canvas ref={qrCodeRef} />
            <div className="flex w-full items-center gap-2">
              <Input value={invoice} readOnly className="flex-1" />
              <Button onClick={handleCopy} variant="outline" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <ToggleGroup
                type="single"
                value={String(amount)}
                onValueChange={(value: string) => {
                  if (value) {
                    setAmount(parseInt(value, 10));
                  }
                }}
                className="grid grid-cols-5 gap-2"
              >
                {presetAmounts.map(({ amount: presetAmount, icon: Icon }) => (
                  <ToggleGroupItem
                    key={presetAmount}
                    value={String(presetAmount)}
                    className="flex flex-col h-auto"
                  >
                    <Icon className="h-6 w-6 mb-1" />
                    {presetAmount}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-muted" />
                <span className="text-xs text-muted-foreground">OR</span>
                <div className="h-px flex-1 bg-muted" />
              </div>
              <Input
                ref={inputRef}
                id="custom-amount"
                type="number"
                placeholder="Custom amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Textarea
                id="custom-comment"
                placeholder="Custom comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleZap} className="w-full" disabled={isZapping}>
                {isZapping ? (
                  'Creating invoice...'
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Zap {amount} sats
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
