import { BlurredImage } from "@/components/BlurredImage";
import { NostrEventCard } from "./NostrEvent";

interface LogTextProps {
  text: string;
}

const URL_REGEX = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp)|nostr:nevent\w+)/gi;

export function LogText({ text }: LogTextProps) {
  const parts = text.split(URL_REGEX).filter(Boolean);

  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.match(/^nostr:nevent/)) {
          return <NostrEventCard key={index} nevent={part.replace('nostr:', '')} />;
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
        return <p key={index}>{part}</p>;
      })}
    </div>
  );
}
