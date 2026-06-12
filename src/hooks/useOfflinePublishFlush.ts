/**
 * Flushes the offline publish queue when connectivity returns.
 *
 * Mount once near the app root. Listens for the browser `online` event
 * (plus one check on mount) and re-broadcasts any queued signed events,
 * letting the user know how many of their offline actions went through.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNostr } from '@nostrify/react';
import { useToast } from '@/hooks/useToast';
import { flushQueuedEvents, getQueuedEventCount } from '@/lib/offlinePublishQueue';
import { TIMEOUTS } from '@/config';

export function useOfflinePublishFlush(): void {
  const { nostr } = useNostr();
  const { toast } = useToast();
  const { t } = useTranslation();
  const flushing = useRef(false);

  useEffect(() => {
    const flush = async () => {
      if (flushing.current) return;
      flushing.current = true;
      try {
        const queued = await getQueuedEventCount();
        if (queued === 0) return;

        const { published } = await flushQueuedEvents(async (event) => {
          await nostr.event(event, { signal: AbortSignal.timeout(TIMEOUTS.PUBLISH) });
        });

        if (published > 0) {
          toast({
            title: t('offlineQueue.flushed.title', 'Back online'),
            description: t('offlineQueue.flushed.description', {
              count: published,
              defaultValue: 'Published {{count}} queued event(s) from offline mode.',
            }),
          });
        }
      } catch {
        // Queue stays intact; we'll retry on the next online event.
      } finally {
        flushing.current = false;
      }
    };

    const onOnline = () => { void flush(); };

    window.addEventListener('online', onOnline);
    // Also try once on mount — the app may have been reopened with
    // connectivity already restored.
    if (navigator.onLine) void flush();

    return () => window.removeEventListener('online', onOnline);
  }, [nostr, toast, t]);
}
