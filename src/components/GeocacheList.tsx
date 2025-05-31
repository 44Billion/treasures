import { useNavigate } from "react-router-dom";
import { GeocacheCard } from "@/components/ui/geocache-card";
import type { Geocache } from "@/types/geocache";

interface GeocacheWithDistance extends Geocache {
  distance?: number;
}

interface GeocacheListProps {
  geocaches: (Geocache | GeocacheWithDistance)[];
  compact?: boolean;
}

export function GeocacheList({ geocaches, compact = false }: GeocacheListProps) {
  const navigate = useNavigate();

  const handleCacheClick = (cache: Geocache | GeocacheWithDistance) => {
    navigate(`/cache/${cache.dTag}`);
  };

  return (
    <div className={compact ? "space-y-2" : "grid md:grid-cols-2 lg:grid-cols-3 gap-4"}>
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