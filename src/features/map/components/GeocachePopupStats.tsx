import { useGeocacheStats } from "@/features/geocache/hooks/useGeocacheStats";
import type { Geocache } from "@/shared/types";
import { Trophy, MessageSquare, Zap } from "lucide-react";
import { useStore } from 'zustand';
import { useZapStore } from '@/shared/stores/useZapStore';
import { useZaps } from '@/features/zaps/hooks/useZaps';

export function GeocachePopupStats({ geocache }: { geocache: Geocache }) {
  const stats = useGeocacheStats(geocache.dTag, geocache.pubkey);
  const getZapTotal = useStore(useZapStore, (state) => state.getZapTotal);
  const naddr = (geocache as any).naddr;
  useZaps(geocache.id, naddr);
  const totalZapAmount = getZapTotal(naddr ? `naddr:${naddr}` : `event:${geocache.id}`);

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
      <span className="flex items-center gap-1">
        <Zap className="h-3 w-3" />
        {totalZapAmount.toLocaleString()}
      </span>
      <span className="flex items-center gap-1">
        <Trophy className="h-3 w-3" />
        {stats.foundCount}
      </span>
      <span className="flex items-center gap-1">
        <MessageSquare className="h-3 w-3" />
        {stats.logCount}
      </span>
    </div>
  );
}
