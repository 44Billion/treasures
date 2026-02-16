import { BlurredImage } from "@/components/BlurredImage";
import { NostrEventCard } from "./NostrEvent";
import { NostrPubkey } from "./NostrPubkey";

interface LogTextProps {
  text: string;
  onProfileClick?: (pubkey: string) => void;
  hideNostrLinks?: boolean;
}

const URL_REGEX = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp)|nostr:nevent\w+|nostr:npub\w+|nostr:note\w+)/gi;

export function LogText({ text, onProfileClick, hideNostrLinks = false }: LogTextProps) {
  const parts = text.split(URL_REGEX).filter(Boolean);

  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.match(/^nostr:nevent/)) {
          if (hideNostrLinks) {
            // Hide nevent links to prevent recursion
            return null;
          }
          const neventId = part.replace('nostr:', '');
          return (
            <div key={index} className="space-y-2">
              <NostrEventCard nevent={neventId} onProfileClick={onProfileClick} />
              <a
                href={`https://njump.me/${neventId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline text-sm inline-block"
              >
                View event on njump →
              </a>
            </div>
          );
        }
        if (part.match(/^nostr:npub/)) {
          // Always render npub links, even when hideNostrLinks is true
          return <NostrPubkey key={index} npub={part.replace('nostr:', '')} onProfileClick={onProfileClick} />;
        }
        if (part.match(/^nostr:note/)) {
          if (hideNostrLinks) {
            // Hide note links to prevent recursion
            return null;
          }
          const noteId = part.replace('nostr:', '');
          return (
            <a
              key={index}
              href={`https://njump.me/${noteId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline inline"
            >
              View quoted note on njump →
            </a>
          );
        }
        if (part.match(/^https?/)) {
          return (
            <BlurredImage
              key={index}
              src={part}
              alt="log image"
              className="rounded w-full h-32 object-cover"
              onClick={() => window.open(part, "_blank")}
              blurIntensity="medium"
              defaultBlurred={true}
            />
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}
