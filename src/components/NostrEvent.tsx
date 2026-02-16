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
        if (type !== 'nevent' || !data.id) {
          throw new Error('Invalid nevent');
        }

        const filter = {
          ids: [data.id],
        };
        
        const events = await nostr.query([filter]);
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
          {author.data?.metadata?.picture ? (
            <img
              src={author.data.metadata.picture}
              alt={authorName}
              className="w-8 h-8 rounded-full mr-2"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 mr-2" />
          )}
          <div>
            <Link
              to={`/profile/${event.pubkey}`}
              className="font-bold hover:underline cursor-pointer"
            >
              {authorName}
            </Link>
            <p className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true })}
            </p>
          </div>
        </div>
        <LogText text={event.content} hideNostrLinks={true} />
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
