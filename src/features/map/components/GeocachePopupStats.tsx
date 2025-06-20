import { useGeocacheStore } from "@/shared/stores/useGeocacheStore";
import { useLogStore } from "@/shared/stores/useLogStore";
import type { Geocache } from "@/shared/types";
import { Trophy, MessageSquare, Zap } from "lucide-react";

export function GeocachePopupStats({ geocache }: { geocache: Geocache }) {
  const { geocaches } = useGeocacheStore();
  const { logsByGeocache } = useLogStore();

  const g = geocaches.find((g) => g.id === geocache.id);
  const foundCount = g?.foundCount || 0;
  const logCount = g?.logCount || 0;

  const logs = logsByGeocache[geocache.id] || [];

  const zapTotal = Math.floor(
    logs.reduce((acc, log) => acc + (log.zapAmount || 0), 0) / 1000
  );

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
      <span className="flex items-center gap-1">
        <Trophy className="h-3 w-3" />
        {foundCount}
      </span>
      <span className="flex items-center gap-1">
        <MessageSquare className="h-3 w-3" />
        {logCount}
      </span>
      <span className="flex items-center gap-1">
        <Zap className="h-3 w-3" />
        {zapTotal}
      </span>
    </div>
  );
}
