/**
 * OfflineQueueSection - Profile "Pending offline" list.
 *
 * Unifies everything on the device that hasn't reached a relay yet:
 *
 *   1. Queued publishes — treasures the user tapped Publish on while offline
 *      (or while every relay was unreachable). Stored in the offline publish
 *      queue and broadcast automatically on reconnect. Actions: Retry / Discard.
 *
 *   2. Unsynced drafts — explicit "Save Draft" calls that couldn't reach the
 *      relay (`source === 'local'`). Actions: Resume (continue editing) /
 *      Discard.
 *
 * Only rendered on the user's OWN profile (both sources are device-local).
 */
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CloudOff, RefreshCw, Trash2, FileEdit } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { parseGeocacheEvent } from '@/utils/nip-gc';
import type { TreasureDraft } from '@/hooks/useTreasureDrafts';

interface OfflineQueueSectionProps {
  /** Local-only (unsynced) drafts to surface alongside queued publishes. */
  localDrafts: TreasureDraft[];
  /** Discard an unsynced draft by slug + (synthetic) event id. */
  onDeleteDraft: (slug: string, eventId: string) => void;
}

export function OfflineQueueSection({ localDrafts, onDeleteDraft }: OfflineQueueSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { queued, retryOne, discardOne } = useOfflineQueue();

  const queuedEvents = queued.data ?? [];
  const total = queuedEvents.length + localDrafts.length;
  if (total === 0) return null;

  const handleRetry = (event: NostrEvent) => {
    retryOne.mutate(event, {
      onSuccess: (status) => {
        if (status === 'published') {
          toast({
            title: t('offlineQueue.retry.published.title', 'Published'),
            description: t('offlineQueue.retry.published.description', 'Your treasure is now live.'),
          });
        } else {
          toast({
            title: t('offlineQueue.retry.stillOffline.title', 'Still offline'),
            description: t('offlineQueue.retry.stillOffline.description', 'Couldn\'t reach a relay. It will publish automatically when you\'re back online.'),
            variant: 'destructive',
          });
        }
      },
    });
  };

  const handleDiscardQueued = (eventId: string) => {
    discardOne.mutate(eventId, {
      onSuccess: () => {
        toast({
          title: t('offlineQueue.discard.done.title', 'Discarded'),
          description: t('offlineQueue.discard.done.description', 'The pending treasure was removed from this device.'),
        });
      },
    });
  };

  return (
    <Card className="mb-6 border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CloudOff className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            {t('offlineQueue.section.title', 'Pending offline')}
          </h3>
          <Badge variant="secondary" className="ml-auto">{total}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {t('offlineQueue.section.description', 'These treasures are saved on this device and will publish automatically when you\'re back online.')}
        </p>

        <ul className="space-y-3">
          {/* Queued publishes */}
          {queuedEvents.map((event) => {
            const parsed = parseGeocacheEvent(event);
            const name = parsed?.name || t('offlineQueue.item.untitled', 'Untitled treasure');
            const isRetrying = retryOne.isPending && retryOne.variables?.id === event.id;
            const isDiscarding = discardOne.isPending && discardOne.variables === event.id;
            return (
              <li
                key={event.id}
                className="flex items-center gap-3 rounded-md border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('offlineQueue.item.waiting', 'Waiting to publish')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRetry(event)}
                  disabled={isRetrying || isDiscarding}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  {t('offlineQueue.item.retry', 'Retry')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDiscardQueued(event.id)}
                  disabled={isRetrying || isDiscarding}
                  aria-label={t('offlineQueue.item.discard', 'Discard')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}

          {/* Unsynced drafts */}
          {localDrafts.map((draft) => {
            const name = draft.formData.name?.trim() || t('offlineQueue.item.untitledDraft', 'Untitled draft');
            return (
              <li
                key={draft.eventId}
                className="flex items-center gap-3 rounded-md border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('offlineQueue.item.draftNotSynced', 'Draft — not synced')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/create?draft=${encodeURIComponent(draft.slug)}`)}
                >
                  <FileEdit className="h-3.5 w-3.5 mr-1.5" />
                  {t('offlineQueue.item.resume', 'Resume')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeleteDraft(draft.slug, draft.eventId)}
                  aria-label={t('offlineQueue.item.discard', 'Discard')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
