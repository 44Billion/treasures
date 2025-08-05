import { useNavigate } from "react-router-dom";
import { GeocacheCard } from "@/features/geocache/components/geocache-card";
import { geocacheToNaddr } from "@/shared/utils/naddr-utils";
import { cn } from "@/lib/utils";
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
}

export function GeocacheList({
  geocaches,
  compact = false,
  isLoading = false,
  statsLoading = false,
  className
}: GeocacheListProps) {
  const navigate = useNavigate();

  const handleCacheClick = (cache: Geocache | GeocacheWithDistance) => {
    navigate(`/${geocacheToNaddr(cache.pubkey, cache.dTag, cache.relays, cache.kind)}`);
  };

  return (
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
  );
}
