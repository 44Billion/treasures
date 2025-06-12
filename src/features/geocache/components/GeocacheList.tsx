import { useNavigate } from "react-router-dom";
import { GeocacheCard } from "@/components/ui/geocache-card";
import { geocacheToNaddr } from "@/shared/utils/naddr-utils";
import { cn } from "@/lib/utils";
import type { Geocache } from "@/types/geocache";

interface GeocacheWithDistance extends Geocache {
  distance?: number;
}

interface GeocacheListProps {
  geocaches: (Geocache | GeocacheWithDistance)[];
  compact?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function GeocacheList({ 
  geocaches, 
  compact = false, 
  isLoading = false,
  className 
}: GeocacheListProps) {
  const navigate = useNavigate();

  const handleCacheClick = (cache: Geocache | GeocacheWithDistance) => {
    navigate(`/${geocacheToNaddr(cache.pubkey, cache.dTag, cache.relays)}`);
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
          cache={geocache}
          distance={('distance' in geocache) ? geocache.distance : undefined}
          variant={compact ? 'compact' : 'default'}
          onClick={() => handleCacheClick(geocache)}
        />
      ))}
    </div>
  );
}