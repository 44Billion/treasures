import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/shared/hooks/useToast';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { requestProvider } from 'webln';
import type { WebLNProvider } from 'webln';
import type { Geocache } from '@/types/geocache';
import { nip57, Event } from 'nostr-tools';

interface ZapButtonProps {
  geocache: Geocache;
}

export function ZapButton({ geocache }: ZapButtonProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const [webln, setWebln] = useState<WebLNProvider | null>(null);
  const author = useAuthor(geocache.pubkey);

  useEffect(() => {
    async function getWeblnProvider() {
      try {
        const provider = await requestProvider();
        setWebln(provider);
      } catch (err) {
        // Silently fail
      }
    }
    getWeblnProvider();
  }, []);

  const handleZap = async () => {
    if (!webln) {
      toast({
        title: 'WebLN not found',
        description: 'Please install a WebLN compatible extension like Alby.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Login required',
        description: 'You must be logged in to send a zap.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const lud16 = author.data?.metadata?.lud16;
      if (!lud16) {
        toast({
          title: 'Lightning address not found',
          description: 'The geocache owner does not have a lightning address configured.',
          variant: 'destructive',
        });
        return;
      }

      if (!author.data) {
        toast({
          title: 'Author not found',
          description: 'Could not find the author of this geocache.',
          variant: 'destructive',
        });
        return;
      }

      const zapEndpoint = await nip57.getZapEndpoint(author.data.event as Event);
      if (!zapEndpoint) {
        toast({
          title: 'Zap endpoint not found',
          description: 'Could not find a zap endpoint for the geocache owner.',
          variant: 'destructive',
        });
        return;
      }

      const amount = 21000; // 21 sats in millisats
      const relays = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.snort.social'];
      const zapRequest = nip57.makeZapRequest({
        profile: geocache.pubkey,
        event: geocache.id,
        amount,
        relays,
        comment: 'Zap for a geocache!',
      });

      publishEvent(zapRequest, {
        onSuccess: async (event) => {
          try {
            const res = await fetch(`${zapEndpoint}?amount=${amount}&nostr=${encodeURI(JSON.stringify(event))}`);
            const { pr: invoice } = await res.json();
            await webln.sendPayment(invoice);
            toast({
              title: 'Zap successful!',
              description: `You sent ${amount / 1000} sats to the cache owner.`,
            });
          } catch (err) {
            console.error('Zap error:', err);
            toast({
              title: 'Zap failed',
              description: (err as Error).message,
              variant: 'destructive',
            });
          }
        },
      });
    } catch (err) {
      toast({
        title: 'Zap failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleZap} disabled={!webln || !user}>
      <Zap className="h-4 w-4" />
    </Button>
  );
}
