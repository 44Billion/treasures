import { useNavigate } from "react-router-dom";
import { GeocacheCard } from "@/features/geocache/components/geocache-card";
import { geocacheToNaddr } from "@/shared/utils/naddr-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown } from "lucide-react";
import type { Geocache } from "@/types/geocache";

interface GeocacheWithDistance extends Geocache {
  distance?: number;
  isOffline?: boolean;
}

interface GeocacheListProps {
  geocaches: (Geocache | GeocacheWithDistance)[];
  compact?: boolean;
  isLoading?: boolean;
  statsLoading?: boolean;
  className?: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export function GeocacheList({
  geocaches,
  compact = false,
  isLoading = false,
  statsLoading = false,
  className,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore
}: GeocacheListProps) {
  const navigate = useNavigate();

  const handleCacheClick = (cache: Geocache | GeocacheWithDistance) => {
    navigate(`/${geocacheToNaddr(cache.pubkey, cache.dTag, cache.relays, cache.kind)}`);
  };

  return (
    <div className="space-y-6">
      <div className={cn(
        compact ? "space-y-2" : "grid md:grid-cols-2 lg:grid-cols-3 gap-4",
        isLoading && "opacity-75 transition-opacity duration-200",
        className
      )}>
        {geocaches.map((geocache) => (
          <GeocacheCard
            key={geocache.id}
            cache={{...geocache, isOffline: 'isOffline' in geocache ? geocache.isOffline : false}}
            distance={('distance' in geocache) ? geocache.distance : undefined}
            variant={compact ? 'compact' : 'default'}
            onClick={() => handleCacheClick(geocache)}
            statsLoading={statsLoading}
          />
        ))}
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="lg"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="min-w-[200px]"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Load More
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
