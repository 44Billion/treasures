import { Zap, BadgeCent, Coins, HandCoins, Gem } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ZapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onZap: (amount: number) => void;
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

export function ZapModal({ open, onOpenChange, onZap }: ZapModalProps) {
  const [amount, setAmount] = useState<number | string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setAmount('');
    }
  }, [open]);

  const handleZap = () => {
    const finalAmount = typeof amount === 'string' ? parseInt(amount, 10) : amount;
    if (finalAmount > 0) {
      onZap(finalAmount);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-testid="zap-modal">
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send a Zap</DialogTitle>
          <DialogDescription>
            Choose an amount or enter a custom value to send to the geocache owner.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <ToggleGroup
            type="single"
            value={String(amount)}
            onValueChange={(value) => {
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
        </div>
        <DialogFooter>
          <Button onClick={handleZap} className="w-full">
            <Zap className="h-4 w-4 mr-2" />
            Zap {amount} sats
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
