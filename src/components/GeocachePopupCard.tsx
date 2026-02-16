import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from 'zustand';
import { Navigation, User, ChevronRight, Zap, Bookmark, BookmarkCheck, MapPin, Trophy, X as XIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeocacheLogs } from "../hooks/useGeocacheLogs";
import { useZapStore } from "@/stores/useZapStore";
import { ZapButton } from "@/components/ZapButton";
import { useSavedCaches } from "../hooks/useSavedCaches";
import { useToast } from "@/hooks/useToast";

import { useAuthor } from "@/hooks/useAuthor";
import { formatDistanceToNow } from "@/utils/date";
import { useNavigate } from "react-router-dom";
import { geocacheToNaddr } from "@/utils/naddr";
import { getTypeLabel, getSizeLabel } from "../utils/geocache-utils";
import type { Geocache, GeocacheLog } from "@/types/geocache";

interface GeocachePopupCardProps {
  geocache: Geocache;
  onClose?: () => void;
}

export function GeocachePopupCard({ geocache, onClose }: GeocachePopupCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isCacheSaved, toggleSaveCache, isNostrEnabled } = useSavedCaches();

  const { data: logsData = {} } = useGeocacheLogs(
    `${geocache.pubkey}:${geocache.dTag}`,
    geocache.dTag,
    geocache.pubkey,
    geocache.relays,
    geocache.verificationPubkey,
    geocache.kind || 37516
  );

  const logs: GeocacheLog[] = useMemo(() => Array.isArray(logsData) ? logsData : [], [logsData]);
  const author = useAuthor(geocache.pubkey);
  const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind || 37516);
  const zapStoreKey = `naddr:${naddr}`;
  const zapTotal = useStore(useZapStore, (state) => state.zapTotals[zapStoreKey] ?? 0);

  const recentLog = logs[0];
  const recentLogAuthor = useAuthor(recentLog?.pubkey || "");

  const totalSats = geocache.zapTotal ?? zapTotal;
  const authorName = author.data?.metadata?.name || geocache.pubkey.slice(0, 8);
  const profilePicture = author.data?.metadata?.picture;
  const findCount = logs.filter(log => log.type === "found").length;
  const dnfCount = logs.filter(log => log.type === "dnf").length;
  const hasImages = geocache.images && geocache.images.length > 0;
  const saved = isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey);
  const recentLogAuthorName = recentLogAuthor.data?.metadata?.name || recentLog?.pubkey?.slice(0, 8) || "";

  const handleViewFullDetails = () => {
    onClose?.();
    navigate(`/${geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind || 37516)}?fromMap=true`);
  };

  const handleSaveToggle = async () => {
    if (!isNostrEnabled) {
      toast({
        title: t('geocacheDialog.toast.loginRequired.title'),
        description: t('geocacheDialog.toast.loginRequired.description'),
        variant: 'destructive',
      });
      return;
    }

    try {
      await toggleSaveCache(geocache);
      toast({
        title: saved ? t('geocacheDialog.toast.removed.title') : t('geocacheDialog.toast.saved.title'),
        description: saved
          ? t('geocacheDialog.toast.removed.description', { name: geocache.name })
          : t('geocacheDialog.toast.saved.description', { name: geocache.name }),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('geocacheDialog.toast.error.description');
      toast({
        title: t('geocacheDialog.toast.error.title'),
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const getLogTypeIcon = (type: string) => {
    switch (type) {
      case 'found': return <Trophy className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />;
      case 'dnf': return <XIcon className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
      default: return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
    }
  };

  return (
    <div className="w-[340px] overflow-hidden">
      {/* Hero image */}
      {hasImages ? (
        <div className="relative w-full h-36 bg-muted overflow-hidden">
          <img
            src={geocache.images![0]}
            alt={geocache.name}
            className="w-full h-full object-cover"
          />
          {geocache.images!.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              +{geocache.images!.length - 1} more
            </div>
          )}
        </div>
      ) : (
        <div className="h-16 w-full bg-gradient-to-br from-muted to-muted/30 flex items-center justify-center">
          <MapPin className="h-6 w-6 text-muted-foreground/20" />
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-2.5">
        {/* Title + badges */}
        <div>
          <h3 className="font-semibold text-sm leading-snug">{geocache.name}</h3>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
            <span className="font-medium bg-muted rounded px-1 py-px">D{geocache.difficulty}</span>
            <span className="font-medium bg-muted rounded px-1 py-px">T{geocache.terrain}</span>
            <span className="mx-0.5">·</span>
            <span>{getSizeLabel(geocache.size)}</span>
            <span className="mx-0.5">·</span>
            <span>{getTypeLabel(geocache.type)}</span>
          </div>
        </div>

        {/* Author row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={authorName}
                className="h-6 w-6 rounded-full object-cover flex-shrink-0 ring-1 ring-border"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 ring-1 ring-border">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-xs font-medium truncate block leading-tight">{authorName}</span>
              <span className="text-[10px] text-muted-foreground leading-none">
                {formatDistanceToNow(new Date(geocache.created_at * 1000), { addSuffix: true })}
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground flex-shrink-0">
            {findCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Trophy className="h-3 w-3 text-green-600" />
                {findCount}
              </span>
            )}
            {dnfCount > 0 && (
              <span className="flex items-center gap-0.5">
                <XIcon className="h-3 w-3 text-red-500" />
                {dnfCount}
              </span>
            )}
            {totalSats > 0 && (
              <span className="flex items-center gap-0.5">
                <Zap className="h-3 w-3 text-amber-500" />
                {totalSats >= 1000 ? `${(totalSats / 1000).toFixed(1)}k` : totalSats}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {geocache.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {geocache.description}
          </p>
        )}

        {/* Recent log teaser */}
        {recentLog && (
          <button
            onClick={handleViewFullDetails}
            className="flex items-center gap-2 w-full min-w-0 overflow-hidden bg-muted/40 hover:bg-muted/70 transition-colors rounded-lg px-2.5 py-1.5 text-left"
          >
            {getLogTypeIcon(recentLog.type)}
            <p className="text-[11px] text-muted-foreground truncate min-w-0 flex-1">
              <span className="font-medium text-foreground">{recentLogAuthorName}</span>
              {" — "}
              {recentLog.text
                ? recentLog.text.replace(/nostr:\w+/g, '').trim().slice(0, 80)
                : recentLog.type === 'found' ? 'found this cache' : 'logged this cache'
              }
            </p>
            {logs.length > 1 && (
              <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                +{logs.length - 1}
              </span>
            )}
          </button>
        )}

        {/* Coordinates */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 font-mono">
          <MapPin className="h-3 w-3" />
          {geocache.location.lat.toFixed(5)}, {geocache.location.lng.toFixed(5)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={handleViewFullDetails}
          >
            {t('geocacheDialog.actions.viewFullDetails')}
            <ChevronRight className="h-3.5 w-3.5 ml-0.5 -mr-1" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 flex-shrink-0 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950 dark:hover:text-green-300"
            onClick={() => {
              window.open(
                `https://www.openstreetmap.org/directions?from=&to=${geocache.location.lat}%2C${geocache.location.lng}#map=15/${geocache.location.lat}/${geocache.location.lng}`,
                "_blank"
              );
            }}
            title={t('cacheDetail.details.getDirections')}
          >
            <Navigation className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 flex-shrink-0 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950 dark:hover:text-green-300"
            onClick={handleSaveToggle}
            title={saved ? t('geocacheDialog.actions.removeFromSaved') : t('geocacheDialog.actions.saveForLater')}
          >
            {saved ? (
              <BookmarkCheck className="h-3.5 w-3.5" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
          </Button>

          <ZapButton
            target={geocache}
            className="h-8 w-8 p-0 flex-shrink-0"
          />
        </div>
      </div>
    </div>
  );
}
