import { useMemo, useState, useCallback } from "react";
import { nip19 } from "nostr-tools";
import { BlurredImage } from "@/components/BlurredImage";
import { ImageGallery } from "@/components/ImageGallery";
import { NostrEventCard } from "./NostrEvent";
import { NostrPubkey } from "./NostrPubkey";
import { cn } from "@/lib/utils";

interface LogTextProps {
  text: string;
  onProfileClick?: (pubkey: string) => void;
  hideNostrLinks?: boolean;
}

/** Image extensions rendered inline. */
const IMAGE_EXTS = "jpg|jpeg|png|gif|webp|svg|avif";
const IMAGE_URL_REGEX = new RegExp(
  `https?:\\/\\/[^\\s]+\\.(${IMAGE_EXTS})(\\?[^\\s]*)?`,
  "i",
);

/** Video extensions rendered as embeds. */
const VIDEO_EXTS = "mp4|webm|mov";
const VIDEO_URL_REGEX = new RegExp(
  `https?:\\/\\/[^\\s]+\\.(${VIDEO_EXTS})(\\?[^\\s]*)?`,
  "i",
);

/** A parsed token from log content. */
type ContentToken =
  | { type: "text"; value: string }
  | { type: "image-embed"; url: string }
  | { type: "image-gallery"; urls: string[] }
  | { type: "video-embed"; url: string }
  | { type: "inline-link"; url: string }
  | { type: "mention"; npub: string; pubkey: string }
  | { type: "nevent-embed"; neventId: string; eventId: string; relays?: string[]; author?: string }
  | { type: "note-link"; noteId: string; eventId: string }
  | { type: "naddr-link"; naddrId: string }
  | { type: "nprofile-link"; nprofileId: string; pubkey: string }
  | { type: "hashtag"; tag: string; raw: string };

/**
 * Tokenizes log text content into structured tokens for rendering.
 *
 * Inspired by ditto's NoteContent tokenizer, this handles:
 * - Image URLs (grouped into galleries when consecutive)
 * - Video URLs
 * - nostr: URIs (nevent, npub, nprofile, note, naddr)
 * - Regular URLs as clickable links
 * - Hashtags
 */
function tokenize(text: string): ContentToken[] {
  // Match: URLs | nostr:-prefixed NIP-19 ids | hashtags
  const regex =
    /((?:https?):\/\/[^\s]+)|nostr:(npub1|note1|nprofile1|nevent1|naddr1)([023456789acdefghjklmnpqrstuvwxyz]+)|(#[\p{L}\p{N}_]+)/giu;

  const result: ContentToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    let [fullMatch] = match;
    let url = match[1];
    const nostrPrefix = match[2];
    const nostrData = match[3];
    const hashtag = match[4];
    const index = match.index;

    // Add text before this match
    if (index > lastIndex) {
      result.push({ type: "text", value: text.substring(lastIndex, index) });
    }

    if (url) {
      // Strip common trailing punctuation that's likely not part of the URL
      const trailingPunctMatch = url.match(/^(.*?)([.,;:!?)\]]+)$/);
      if (trailingPunctMatch) {
        const [, urlWithoutPunct] = trailingPunctMatch;
        if (urlWithoutPunct && urlWithoutPunct.length > 10) {
          url = urlWithoutPunct;
          fullMatch = urlWithoutPunct;
        }
      }

      // Image URLs -> render inline
      if (IMAGE_URL_REGEX.test(url)) {
        // Strip trailing whitespace from preceding text token
        if (result.length > 0) {
          const prev = result[result.length - 1];
          if (prev.type === "text") {
            prev.value = prev.value.replace(/\s+$/, "");
          }
        }
        result.push({ type: "image-embed", url });
        lastIndex = index + fullMatch.length;
        // Strip leading whitespace after the image URL
        const remaining = text.substring(lastIndex);
        const leadingWs = remaining.match(/^\s+/);
        if (leadingWs) {
          lastIndex += leadingWs[0].length;
        }
        continue;
      }

      // Video URLs -> render as video player
      if (VIDEO_URL_REGEX.test(url)) {
        if (result.length > 0) {
          const prev = result[result.length - 1];
          if (prev.type === "text") {
            prev.value = prev.value.replace(/\s+$/, "");
          }
        }
        result.push({ type: "video-embed", url });
        lastIndex = index + fullMatch.length;
        const remaining = text.substring(lastIndex);
        const leadingWs = remaining.match(/^\s+/);
        if (leadingWs) {
          lastIndex += leadingWs[0].length;
        }
        continue;
      }

      // Regular URL -> inline clickable link
      result.push({ type: "inline-link", url });
    } else if (nostrPrefix && nostrData) {
      const nostrId = `${nostrPrefix}${nostrData}`;
      try {
        const decoded = nip19.decode(nostrId);

        if (decoded.type === "npub") {
          result.push({ type: "mention", npub: nostrId, pubkey: decoded.data });
        } else if (decoded.type === "nprofile") {
          result.push({
            type: "nprofile-link",
            nprofileId: nostrId,
            pubkey: decoded.data.pubkey,
          });
        } else if (decoded.type === "note") {
          result.push({
            type: "note-link",
            noteId: nostrId,
            eventId: decoded.data as string,
          });
        } else if (decoded.type === "nevent") {
          result.push({
            type: "nevent-embed",
            neventId: nostrId,
            eventId: decoded.data.id,
            relays: decoded.data.relays,
            author: decoded.data.author,
          });
        } else if (decoded.type === "naddr") {
          result.push({ type: "naddr-link", naddrId: nostrId });
        } else {
          result.push({ type: "text", value: fullMatch });
        }
      } catch {
        result.push({ type: "text", value: fullMatch });
      }
    } else if (hashtag) {
      const tag = hashtag.slice(1);
      result.push({ type: "hashtag", tag, raw: hashtag });
    }

    lastIndex = index + fullMatch.length;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    result.push({ type: "text", value: text.substring(lastIndex) });
  }

  if (result.length === 0) {
    result.push({ type: "text", value: text });
  }

  // Collapse excessive whitespace around block-level tokens
  for (let i = 0; i < result.length; i++) {
    const token = result[i];
    const isBlock =
      token.type === "image-embed" ||
      token.type === "video-embed" ||
      token.type === "nevent-embed";

    if (isBlock) {
      if (i > 0) {
        const prev = result[i - 1];
        if (prev.type === "text") {
          prev.value = prev.value.replace(/\s+$/, "");
        }
      }
      if (i < result.length - 1) {
        const next = result[i + 1];
        if (next.type === "text") {
          next.value = next.value.replace(/^\s+/, "");
        }
      }
    }
  }

  // Filter out empty text tokens
  return result.filter((t) => !(t.type === "text" && t.value === ""));
}

/**
 * Groups consecutive image-embed tokens (2+) into image-gallery tokens.
 * Single images remain as image-embed tokens.
 */
function groupImages(tokens: ContentToken[]): ContentToken[] {
  const result: ContentToken[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === "image-embed") {
      const run: string[] = [token.url];
      let j = i + 1;
      while (j < tokens.length && tokens[j].type === "image-embed") {
        run.push((tokens[j] as { type: "image-embed"; url: string }).url);
        j++;
      }
      if (run.length >= 2) {
        result.push({ type: "image-gallery", urls: run });
      } else {
        result.push(token);
      }
      i = j;
    } else {
      result.push(token);
      i++;
    }
  }
  return result;
}

export function LogText({ text, hideNostrLinks = false }: LogTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const groupedTokens = useMemo(() => groupImages(tokens), [tokens]);

  // Collect all image URLs for the shared lightbox
  const allImages = useMemo(
    () =>
      groupedTokens.flatMap((t) => {
        if (t.type === "image-embed") return [t.url];
        if (t.type === "image-gallery") return t.urls;
        return [];
      }),
    [groupedTokens],
  );

  // Shared lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const openLightbox = useCallback((idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  }, []);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  // Build a map from grouped token index -> starting image list index
  const tokenImageIndex = useMemo(() => {
    const map = new Map<number, number>();
    let imgCount = 0;
    groupedTokens.forEach((t, i) => {
      if (t.type === "image-embed") {
        map.set(i, imgCount++);
      } else if (t.type === "image-gallery") {
        map.set(i, imgCount);
        imgCount += t.urls.length;
      }
    });
    return map;
  }, [groupedTokens]);

  return (
    <div className="whitespace-pre-wrap break-words">
      {groupedTokens.map((token, i) => {
        switch (token.type) {
          case "text":
            return <span key={i}>{token.value}</span>;

          case "image-embed": {
            const imgIndex = tokenImageIndex.get(i) ?? 0;
            return (
              <BlurredImage
                key={i}
                src={token.url}
                alt="log image"
                className="rounded w-full h-32 object-cover my-1"
                onClick={() => openLightbox(imgIndex)}
                blurIntensity="medium"
                defaultBlurred={true}
              />
            );
          }

          case "image-gallery": {
            const galleryStartIndex = tokenImageIndex.get(i) ?? 0;
            return (
              <InlineImageGrid
                key={i}
                urls={token.urls}
                onImageClick={(idx) => openLightbox(galleryStartIndex + idx)}
              />
            );
          }

          case "video-embed":
            return (
              <video
                key={i}
                src={token.url}
                controls
                className="rounded w-full max-h-64 my-1"
                preload="metadata"
              />
            );

          case "inline-link":
            return (
              <a
                key={i}
                href={token.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline break-all"
              >
                {token.url}
              </a>
            );

          case "nevent-embed": {
            if (hideNostrLinks) return null;
            return (
              <div key={i} className="my-1">
                <NostrEventCard nevent={token.neventId} />
              </div>
            );
          }

          case "note-link": {
            if (hideNostrLinks) return null;
            return (
              <NostrEventCard key={i} nevent={token.noteId} />
            );
          }

          case "mention":
            return <NostrPubkey key={i} npub={token.npub} />;

          case "nprofile-link":
            return <NostrPubkey key={i} npub={nip19.npubEncode(token.pubkey)} />;

          case "naddr-link": {
            if (hideNostrLinks) return null;
            return (
              <a
                key={i}
                href={`https://ditto.pub/${token.naddrId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline break-all inline text-sm"
              >
                {token.naddrId.slice(0, 24)}...
              </a>
            );
          }

          case "hashtag":
            return (
              <span key={i} className="text-blue-600">
                {token.raw}
              </span>
            );
        }
      })}

      {/* Shared lightbox for all images in this log */}
      {allImages.length > 0 && (
        <ImageGallery
          images={allImages}
          isOpen={lightboxOpen}
          onClose={closeLightbox}
          initialIndex={lightboxIndex}
        />
      )}
    </div>
  );
}

/**
 * Inline image grid for displaying 2+ consecutive images.
 * Uses a 2-column grid with a "+N" overflow indicator like ditto.
 */
function InlineImageGrid({
  urls,
  onImageClick,
  maxVisible = 4,
}: {
  urls: string[];
  onImageClick: (index: number) => void;
  maxVisible?: number;
}) {
  const visibleUrls = urls.slice(0, maxVisible);
  const overflowCount = urls.length - maxVisible;

  return (
    <div
      className={cn(
        "grid gap-0.5 rounded-lg overflow-hidden my-1",
        visibleUrls.length === 2 && "grid-cols-2",
        visibleUrls.length === 3 && "grid-cols-2",
        visibleUrls.length >= 4 && "grid-cols-2",
      )}
    >
      {visibleUrls.map((url, idx) => {
        const isLast = idx === visibleUrls.length - 1;
        // For 3 images, first image spans full width
        const spanFull = visibleUrls.length === 3 && idx === 0;

        return (
          <button
            key={idx}
            type="button"
            className={cn(
              "relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              spanFull && "col-span-2",
            )}
            onClick={() => onImageClick(idx)}
          >
            <BlurredImage
              src={url}
              alt={`Image ${idx + 1}`}
              className={cn(
                "w-full object-cover",
                spanFull ? "h-40" : "h-32",
              )}
              blurIntensity="medium"
              defaultBlurred={true}
              showToggle={!isLast || overflowCount <= 0}
            />
            {/* Overflow indicator on last visible image */}
            {isLast && overflowCount > 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                <span className="text-white text-2xl font-bold">
                  +{overflowCount}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
