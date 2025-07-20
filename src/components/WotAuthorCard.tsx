import { useAuthor } from '../features/auth/hooks/useAuthor';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { nip19 } from 'nostr-tools';

interface WotAuthorCardProps {
  pubkey: string;
}

export function WotAuthorCard({ pubkey }: WotAuthorCardProps) {
  let authorPubkey = '';
  try {
    if (pubkey?.startsWith('npub')) {
      const decoded = nip19.decode(pubkey);
      if (decoded.type === 'npub') {
        authorPubkey = decoded.data;
      }
    } else {
      authorPubkey = pubkey || '';
    }
  } catch (e) {
    // Invalid pubkey, do nothing
  }

  const { data: author, isLoading } = useAuthor(authorPubkey || '');

  if (!pubkey || !authorPubkey) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!author) {
    return null;
  }

  const metadata = author.metadata;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar>
          <AvatarImage src={metadata?.picture} alt={metadata?.name} />
          <AvatarFallback>{metadata?.name?.charAt(0) || '?'}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{metadata?.name || 'Unknown User'} {metadata?.nip05 && `(${metadata.nip05})`}</p>
          <p className="text-sm text-muted-foreground">
            {authorPubkey ? nip19.npubEncode(authorPubkey).slice(0, 20) + '...' : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
