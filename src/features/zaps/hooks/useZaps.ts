import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { useAppContext } from '@/shared/hooks/useAppContext';
import { useToast } from '@/shared/hooks/useToast';
import { useNWC } from '@/shared/hooks/useNWCContext';
import type { NWCConnection } from '@/shared/hooks/useNWC';
import { nip57 } from 'nostr-tools';
import type { Event } from 'nostr-tools';
import type { WebLNProvider } from 'webln';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';

export function useZaps(
  target: Event | Event[],
  webln: WebLNProvider | null,
  _nwcConnection: NWCConnection | null,
  onZapSuccess?: () => void
) {
  const { nostr } = useNostr();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const queryClient = useQueryClient();

  // Handle the case where an empty array is passed (from ZapButton when external data is provided)
  const actualTarget = Array.isArray(target) ? (target.length > 0 ? target[0] : null) : target;

  const author = useAuthor(actualTarget?.pubkey);
  const { sendPayment, getActiveConnection } = useNWC();
  const [isZapping, setIsZapping] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);

  // Cleanup state when component unmounts
  useEffect(() => {
    return () => {
      setIsZapping(false);
      setInvoice(null);
    };
  }, []);

  const { data: zapEvents, ...query } = useQuery<NostrEvent[], Error>({
    queryKey: ['zaps', actualTarget?.id],
    staleTime: 30000, // 30 seconds
    refetchInterval: (query) => {
      // Only refetch if the query is currently being observed (component is mounted)
      return query.getObserversCount() > 0 ? 60000 : false;
    },
    queryFn: async (c) => {
      if (!actualTarget) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      // Query for zap receipts for this specific event
      if (actualTarget.kind >= 30000 && actualTarget.kind < 40000) {
        // Addressable event
        const identifier = actualTarget.tags.find((t) => t[0] === 'd')?.[1] || '';
        const events = await nostr.query([{
          kinds: [9735],
          '#a': [`${actualTarget.kind}:${actualTarget.pubkey}:${identifier}`],
          limit: QUERY_LIMITS.ZAPS,
        }], { signal });
        return events;
      } else {
        // Regular event
        const events = await nostr.query([{
          kinds: [9735],
          '#e': [actualTarget.id],
          limit: QUERY_LIMITS.ZAPS,
        }], { signal });
        return events;
      }
    },
    enabled: !!actualTarget?.id,
  });

  // Process zap events into simple counts and totals
  const { zapCount, totalSats, zaps } = useMemo(() => {
    if (!zapEvents || !Array.isArray(zapEvents) || !actualTarget) {
      return { zapCount: 0, totalSats: 0, zaps: [] };
    }

    let count = 0;
    let sats = 0;

    zapEvents.forEach(zap => {
      count++;

      // Try multiple methods to extract the amount:

      // Method 1: amount tag (from zap request, sometimes copied to receipt)
      const amountTag = zap.tags.find(([name]) => name === 'amount')?.[1];
      if (amountTag) {
        const millisats = parseInt(amountTag);
        sats += Math.floor(millisats / 1000);
        return;
      }

      // Method 2: Extract from bolt11 invoice
      const bolt11Tag = zap.tags.find(([name]) => name === 'bolt11')?.[1];
      if (bolt11Tag) {
        try {
          const invoiceSats = nip57.getSatoshisAmountFromBolt11(bolt11Tag);
          sats += invoiceSats;
          return;
        } catch (error) {
          console.warn('Failed to parse bolt11 amount:', error);
        }
      }

      // Method 3: Parse from description (zap request JSON)
      const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
      if (descriptionTag) {
        try {
          const zapRequest = JSON.parse(descriptionTag);
          const requestAmountTag = zapRequest.tags?.find(([name]: string[]) => name === 'amount')?.[1];
          if (requestAmountTag) {
            const millisats = parseInt(requestAmountTag);
            sats += Math.floor(millisats / 1000);
            return;
          }
        } catch (error) {
          console.warn('Failed to parse description JSON:', error);
        }
      }

      console.warn('Could not extract amount from zap receipt:', zap.id);
    });


    return { zapCount: count, totalSats: sats, zaps: zapEvents };
  }, [zapEvents, actualTarget]);

  const zap = async (amount: number, comment: string) => {
    if (amount <= 0) {
      return;
    }

    setIsZapping(true);
    setInvoice(null); // Clear any previous invoice at the start

    if (!user) {
      toast({
        title: t('zap.toast.loginRequired.title'),
        description: t('zap.toast.loginRequired.description'),
        variant: 'destructive',
      });
      setIsZapping(false);
      return;
    }

    if (!actualTarget) {
      toast({
        title: t('zap.toast.eventNotFound.title'),
        description: t('zap.toast.eventNotFound.description'),
        variant: 'destructive',
      });
      setIsZapping(false);
      return;
    }

    try {
      if (!author.data || !author.data?.metadata || !author.data?.event ) {
        toast({
          title: t('zap.toast.authorNotFound.title'),
          description: t('zap.toast.authorNotFound.description'),
          variant: 'destructive',
        });
        setIsZapping(false);
        return;
      }

      const { lud06, lud16 } = author.data.metadata;
      if (!lud06 && !lud16) {
        toast({
          title: t('zap.toast.lightningAddressNotFound.title'),
          description: t('zap.toast.lightningAddressNotFound.description'),
          variant: 'destructive',
        });
        setIsZapping(false);
        return;
      }

      // Get zap endpoint using the old reliable method
      const zapEndpoint = await nip57.getZapEndpoint(author.data.event);
      if (!zapEndpoint) {
        toast({
          title: t('zap.toast.endpointNotFound.title'),
          description: t('zap.toast.endpointNotFound.description'),
          variant: 'destructive',
        });
        setIsZapping(false);
        return;
      }

      // Create zap request - use appropriate event format based on kind
      // For addressable events (30000-39999), pass the object to get 'a' tag
      // For all other events, pass the ID string to get 'e' tag
      const eventParam = (actualTarget.kind >= 30000 && actualTarget.kind < 40000)
        ? actualTarget
        : actualTarget.id;

      const zapAmount = amount * 1000; // convert to millisats

      // nip57.makeZapRequest has strict types but accepts both profile and event
      const zapRequest = nip57.makeZapRequest({
        profile: actualTarget.pubkey,
        event: eventParam as any,
        amount: zapAmount,
        relays: [config.relayUrl],
        comment
      } as any);

      // Sign the zap request (but don't publish to relays - only send to LNURL endpoint)
      if (!user.signer) {
        throw new Error(t('zap.toast.noSigner'));
      }
      const signedZapRequest = await user.signer.signEvent(zapRequest);

      try {
        const res = await fetch(`${zapEndpoint}?amount=${zapAmount}&nostr=${encodeURI(JSON.stringify(signedZapRequest))}`);
            const responseData = await res.json();

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${responseData.reason || 'Unknown error'}`);
            }

            const newInvoice = responseData.pr;
            if (!newInvoice || typeof newInvoice !== 'string') {
              throw new Error(t('zap.toast.invalidInvoice'));
            }

            // Get the current active NWC connection dynamically
            const currentNWCConnection = getActiveConnection();

            // Try NWC first if available and properly connected
            if (currentNWCConnection && currentNWCConnection.connectionString && currentNWCConnection.isConnected) {
              try {
                await sendPayment(currentNWCConnection, newInvoice);

                // Clear states immediately on success
                setIsZapping(false);
                setInvoice(null);

                toast({
                  title: t('zap.toast.success.title'),
                  description: t('zap.toast.success.nwcDescription', { amount }),
                });

                // Invalidate zap queries to refresh counts
                queryClient.invalidateQueries({ queryKey: ['zaps'] });

                // Close dialog last to ensure clean state
                onZapSuccess?.();
                return;
              } catch (nwcError) {
                console.error('NWC payment failed, falling back:', nwcError);

                // Show specific NWC error to user for debugging
                const errorMessage = nwcError instanceof Error ? nwcError.message : 'Unknown NWC error';
                toast({
                  title: t('zap.toast.nwcFailed.title'),
                  description: t('zap.toast.nwcFailed.description', { errorMessage }),
                  variant: 'destructive',
                });
              }
            }
            
            if (webln) {  // Try WebLN next
              try {
                await webln.sendPayment(newInvoice);

                // Clear states immediately on success
                setIsZapping(false);
                setInvoice(null);

                toast({
                  title: t('zap.toast.success.title'),
                  description: t('zap.toast.success.weblnDescription', { amount }),
                });

                // Invalidate zap queries to refresh counts
                queryClient.invalidateQueries({ queryKey: ['zaps'] });

                // Close dialog last to ensure clean state
                onZapSuccess?.();
              } catch (weblnError) {
                console.error('webln payment failed, falling back:', weblnError);

                // Show specific WebLN error to user for debugging
                const errorMessage = weblnError instanceof Error ? weblnError.message : 'Unknown WebLN error';
                toast({
                  title: t('zap.toast.weblnFailed.title'),
                  description: t('zap.toast.weblnFailed.description', { errorMessage }),
                  variant: 'destructive',
                });

                setInvoice(newInvoice);
                setIsZapping(false);
              }
            } else { // Default - show QR code and manual Lightning URI
              setInvoice(newInvoice);
              setIsZapping(false);
            }
          } catch (err) {
            console.error('Zap error:', err);
            toast({
              title: t('zap.toast.failed.title'),
              description: (err as Error).message,
              variant: 'destructive',
            });
            setIsZapping(false);
          }
    } catch (err) {
      console.error('Zap error:', err);
      toast({
        title: t('zap.toast.failed.title'),
        description: (err as Error).message,
        variant: 'destructive',
      });
      setIsZapping(false);
    }
  };

  const resetInvoice = useCallback(() => {
    setInvoice(null);
  }, []);

  return {
    zaps,
    zapCount,
    totalSats,
    ...query,
    zap,
    isZapping,
    invoice,
    setInvoice,
    resetInvoice,
  };
}