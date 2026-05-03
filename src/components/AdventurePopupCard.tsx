import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthor } from "@/hooks/useAuthor";
import { useThumbnailUrl } from "@/hooks/useThumbnailUrl";
import type { Adventure } from "@/types/adventure";

interface AdventurePopupCardProps {
  adventure: Adventure;
  onClose?: () => void;
}

export function AdventurePopupCard({ adventure, onClose }: AdventurePopupCardProps) {
  const navigate = useNavigate();
  const author = useAuthor(adventure.pubkey);
  const thumbnail = useThumbnailUrl();
  const authorName = author.data?.metadata?.name || adventure.pubkey.slice(0, 8);
  const authorPicture = author.data?.metadata?.picture;

  const handleView = () => {
    onClose?.();
    navigate(`/adventure/${adventure.naddr}`);
  };

  const hasImage = !!adventure.image;

  return (
    <div className="adventure-popup-card w-[min(260px,calc(100vw-4rem))] sm:w-[min(320px,calc(100vw-4rem))] overflow-hidden">
      {/* Banner with info baked in — mirrors AdventureDetail sidebar */}
      <div className="relative cursor-pointer" onClick={handleView}>
        {hasImage ? (
          <div className="h-32 sm:h-40 bg-muted overflow-hidden">
            <img
              src={thumbnail(adventure.image ?? '', 400)}
              alt={adventure.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/15" />
          </div>
        ) : (
          <div className="h-20 sm:h-28 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary/30" />
          </div>
        )}

        {/* Info overlaid at bottom of banner */}
        <div className={`absolute bottom-0 left-0 right-0 px-2 sm:px-3 pb-1.5 ${hasImage ? '[text-shadow:0_2px_8px_rgba(0,0,0,0.7),0_1px_2px_rgba(0,0,0,0.9)]' : ''}`}>
          <h3 className={`font-semibold text-xs sm:text-sm leading-snug line-clamp-2 ${hasImage ? 'text-white' : 'text-foreground'}`}>
            {adventure.title}
          </h3>
          <div className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] mt-0.5 ${hasImage ? 'text-white' : 'text-muted-foreground'}`}>
            {authorPicture && (
              <img
                src={thumbnail(authorPicture, 32)}
                alt=""
                className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full object-cover flex-shrink-0 ring-1 ring-white/30"
              />
            )}
            <span className="truncate">{authorName}</span>
            <span className="text-white/60">&middot;</span>
            <span className="flex-shrink-0">{adventure.geocacheRefs.length} {adventure.geocacheRefs.length === 1 ? 'treasure' : 'treasures'}</span>
          </div>
          {(adventure.summary || adventure.description) && (
            <p className={`text-[10px] sm:text-[11px] mt-0.5 line-clamp-2 leading-snug ${hasImage ? 'text-white/95' : 'text-muted-foreground'}`}>
              {adventure.summary || adventure.description}
            </p>
          )}
        </div>
      </div>

      {/* Action below the banner */}
      <div className="p-2 sm:p-3">
        <Button
          className="w-full h-7 sm:h-8 text-[10px] sm:text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={handleView}
        >
          View Adventure
          <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-0.5 -mr-1" />
        </Button>
      </div>
    </div>
  );
}
