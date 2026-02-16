import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';

interface NostrPubkeyProps {
  npub: string;
  onProfileClick?: (pubkey: string) => void;
}

export function NostrPubkey({ npub, onProfileClick }: NostrPubkeyProps) {
  // Decode the npub to get the hex pubkey - always attempt decoding
  let pubkey: string | null = null;
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') {
      pubkey = decoded.data;
    }
  } catch (error) {
    // If decoding fails, pubkey remains null
  }

  // Always call useAuthor, even if pubkey is null
  const author = useAuthor(pubkey || '');
  
  // Determine display name
  const displayName = author.data?.metadata?.name || 
                     author.data?.metadata?.display_name ||
                     npub.slice(0, 12) + '...';

  const handleClick = () => {
    if (onProfileClick && pubkey) {
      onProfileClick(pubkey);
    }
  };

  if (onProfileClick && pubkey) {
    return (
      <button
        onClick={handleClick}
        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer inline"
      >
        @{displayName}
      </button>
    );
  }

  return <span className="text-blue-600 inline">@{displayName}</span>;
}