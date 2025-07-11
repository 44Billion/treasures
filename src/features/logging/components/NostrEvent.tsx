import { useEffect, useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useNostr } from '@nostrify/react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { NostrEvent } from '@nostrify/nostrify';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { formatDistanceToNow } from '@/shared/utils/date';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface NostrEventProps {
  nevent: string;
}

export function NostrEventCard({ nevent }: NostrEventProps) {
  const { nostr } = useNostr();
  const [event, setEvent] = useState<NostrEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { type, data } = nip19.decode(nevent);
        if (type !== 'nevent' || !data.id) {
          throw new Error('Invalid nevent');
        }

        const filter = {
          ids: [data.id],
        };
        
        const events = await nostr.query([filter]);
        if (events.length > 0) {
          setEvent(events[0]);
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
    return <p>Event not found.</p>;
  }

  return <EventCard event={event} />;
}

function EventCard({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const authorName = author.data?.metadata?.name || event.pubkey.slice(0, 8);

  return (
    <Card className="my-2">
      <CardContent className="p-4">
        <div className="flex items-center mb-2">
          <img
            src={author.data?.metadata?.picture || ''}
            alt={authorName}
            className="w-8 h-8 rounded-full mr-2"
          />
          <div>
            <p className="font-bold">{authorName}</p>
            <p className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true })}
            </p>
          </div>
        </div>
        <p>{event.content}</p>
      </CardContent>
    </Card>
  );
}

function EventSkeleton() {
  return (
    <Card className="my-2">
      <CardContent className="p-4">
        <div className="flex items-center mb-2">
          <Skeleton className="w-8 h-8 rounded-full mr-2" />
          <div>
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 mt-2" />
      </CardContent>
    </Card>
  );
}
