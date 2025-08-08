import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { geocacheToNaddr } from '@/shared/utils/naddr';

interface ShareLogAsEventParams {
  geocache: {
    id: string;
    name: string;
    dTag: string;
    pubkey: string;
    relays?: string[];
    kind?: number;
  };
  logText: string;
  logType: 'found' | 'dnf' | 'note' | 'maintenance' | 'archived';
  isVerified?: boolean;
}

export function useShareLogAsEvent() {
  const { mutate: publishEvent, isPending: isPublishing } = useNostrPublish();

  const shareLogAsEvent = async ({ 
    geocache, 
    logText, 
    logType, 
    isVerified = false 
  }: ShareLogAsEventParams) => {
    if (logType !== 'found') return;

    // Generate the geocache URL
    const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind);
    const geocacheUrl = `https://treasures.to/${naddr}`;
    const verificationText = isVerified ? ' (Verified ✨)' : '';

    // Format the content with generic message, link, and actual log entry
    let content = `Just found a treasure${verificationText}! #treasures #geocache`;
    
    if (geocache.name) {
      content += `\n\n🧭 ${geocache.name}`;
    }
    
    content += `\n${geocacheUrl}\n\nMy experience:\n"${logText}"`;

    // Publish as kind 1 event
    await publishEvent({
      kind: 1,
      content: content.trim(),
      tags: [
        ['t', 'treasures'], // Add treasures hashtag
        ['r', geocacheUrl], // Add reference to the geocache URL
        ['client', 'treasures'] // Client identifier
      ]
    });
  };

  return {
    shareLogAsEvent,
    isPublishing
  };
}