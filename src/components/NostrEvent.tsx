import { useEffect, useState } from 'react';
import { nip19 } from 'nostr-tools';
import { Link } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { Card, CardContent } from '@/components/ui/card';
import { NostrEvent } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';
import { formatDistanceToNow } from '@/utils/date';
import { Skeleton } from '@/components/ui/skeleton';
import { LogText } from './LogText';
import { TIMEOUTS } from '@/config';

interface NostrEventProps {
  nevent: string;
  onProfileClick?: (pubkey: string) => void;
}

export function NostrEventCard({ nevent }: NostrEventProps) {
  const { nostr } = useNostr();
  const [event, setEvent] = useState<NostrEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { type, data } = nip19.decode(nevent);
        let eventId: string;
        if (type === 'nevent') {
          eventId = data.id;
        } else if (type === 'note') {
          eventId = data as string;
        } else {
          throw new Error('Invalid nevent or note identifier');
        }

        const signal = AbortSignal.timeout(TIMEOUTS.FAST_QUERY);
        const events = await nostr.query([{ ids: [eventId] }], { signal });
        if (events && events.length > 0) {
          setEvent(events[0] || null);
        }
      } catch (error) {
        console.error('Failed to fetch event:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [nevent, nostr]);

  if (isLoading) {
    return <EventSkeleton />;
  }

  if (!event) {
    return (
      <Card className="my-2 border-dashed opacity-60">
        <CardContent className="p-3 text-sm text-muted-foreground">
          Event not found
        </CardContent>
      </Card>
    );
  }

  return <EventCard event={event} />;
}

function EventCard({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const authorName = author.data?.metadata?.name || event.pubkey.slice(0, 8);

  return (
    <Card className="my-2 border-l-2 border-l-blue-500/30">
      <CardContent className="p-3">
        <div className="flex items-center mb-2">
          {author.data?.metadata?.picture ? (
            <img
              src={author.data.metadata.picture}
              alt={authorName}
              className="w-7 h-7 rounded-full mr-2 object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-muted mr-2 flex items-center justify-center text-xs text-muted-foreground">
              {authorName[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link
              to={`/profile/${event.pubkey}`}
              className="font-medium text-sm hover:underline cursor-pointer truncate block"
            >
              {authorName}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true })}
            </p>
          </div>
        </div>
        {/* Render content with hideNostrLinks to prevent recursive embedding (max depth = 2) */}
        <div className="max-h-[200px] overflow-hidden relative">
          <LogText text={event.content} hideNostrLinks={true} />
          {/* Fade overlay for overflow */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        </div>
      </CardContent>
    </Card>
  );
}

function EventSkeleton() {
  return (
    <Card className="my-2">
      <CardContent className="p-3">
        <div className="flex items-center mb-2">
          <Skeleton className="w-7 h-7 rounded-full mr-2" />
          <div>
            <Skeleton className="h-3 w-24 mb-1" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4 mt-1.5" />
      </CardContent>
    </Card>
  );
}
