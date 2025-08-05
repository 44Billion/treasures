import { LogText } from "./LogText";
import { Trophy, X, FileText, User, Calendar, Trash2, MoreVertical, Copy, ShieldCheck, Zap } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/shared/components/ui/dropdown-menu";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/shared/components/ui/alert-dialog";
import { useAuthor } from "@/features/auth/hooks/useAuthor";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useDeleteLog } from "@/features/logging/hooks/useDeleteLog";
import { useToast } from "@/shared/hooks/useToast";
import { formatDistanceToNow } from "@/shared/utils/date";
import { useLogStore } from "@/shared/stores/useLogStore";
import { ZapButton } from "@/components/ZapButton";
import { useEffect, useMemo } from "react";
import { nip57 } from "nostr-tools";

import type { GeocacheLog } from "@/types/geocache";


interface LogListProps {
  logs: GeocacheLog[];
  compact?: boolean;
  onProfileClick?: (pubkey: string) => void;
}

export function LogList({ logs, compact = false, onProfileClick }: LogListProps) {
  // Logs received from LogsSection
  
  return (
    <div className="space-y-3 md:space-y-4">
      {logs.map((log) => (
        <LogCard key={log.id} log={log} compact={compact} onProfileClick={onProfileClick} />
      ))}
    </div>
  );
}

interface LogCardProps {
  log: GeocacheLog;
  compact?: boolean;
  onProfileClick?: (pubkey: string) => void;
}

function LogCard({ log, compact = false, onProfileClick }: LogCardProps) {
  // The log is always signed by the actual user now
  const author = useAuthor(log.pubkey);
  const { user } = useCurrentUser();
  const { mutate: deleteLog, isPending: isDeleting } = useDeleteLog();
  const { toast } = useToast();
  const { zapsByLogId, fetchZapsForLog } = useLogStore();

  useEffect(() => {
    if (log.id && !zapsByLogId[log.id]) {
      fetchZapsForLog(log.id);
    }
  }, [log.id, fetchZapsForLog, zapsByLogId]);

  const zaps = useMemo(() => zapsByLogId[log.id] || [], [zapsByLogId, log.id]);
  const totalZapAmount = useMemo(() => {
    return zaps.reduce((total, zap) => {
      const pTag = zap.tags.find((t) => t[0] === 'p')?.[1];
      const PTag = zap.tags.find((t) => t[0] === 'P')?.[1];
      if (pTag && PTag && pTag === PTag) {
        return total;
      }

      const bolt11 = zap.tags.find((t) => t[0] === 'bolt11')?.[1];
      if (bolt11) {
        try {
          return total + nip57.getSatoshisAmountFromBolt11(bolt11);
        } catch (e) {
          console.error("Invalid bolt11 invoice", bolt11, e);
          return total;
        }
      }
      return total;
    }, 0);
  }, [zaps]);
  
  // Graceful handling of author data loading
  const isLoadingAuthor = author.isLoading;

  const authorName = author.data?.metadata?.name || 
                    author.data?.metadata?.display_name || 
                    (isLoadingAuthor ? 'Loading...' : log.pubkey.slice(0, 8));
  const authorAvatar = author.data?.metadata?.picture;
  
  // Check if the current user is the author of this log
  const isOwnLog = user?.pubkey === log.pubkey;
  
  // Log card rendering

  const handleProfileClick = () => {
    if (onProfileClick) {
      onProfileClick(log.pubkey);
    }
  };

  const handleDeleteLog = () => {
    deleteLog(log.id);
  };

  const handleCopyEventId = async () => {
    try {
      await navigator.clipboard.writeText(log.id);
      toast({
        title: "Event ID copied",
        description: "The event ID has been copied to your clipboard.",
      });
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = log.id;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      toast({
        title: "Event ID copied",
        description: "The event ID has been copied to your clipboard.",
      });
    }
    
    // Remove focus from the trigger button after copying
    setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
        // Force remove any lingering focus styles
        activeElement.style.outline = 'none';
        activeElement.style.boxShadow = 'none';
      }
      // Also blur any button elements in the area
      const buttons = document.querySelectorAll('button[data-state]');
      buttons.forEach((button) => {
        if (button instanceof HTMLElement) {
          button.blur();
          button.style.outline = 'none';
          button.style.boxShadow = 'none';
        }
      });
    }, 100);
  };

  const getLogIcon = () => {
    switch (log.type) {
      case "found":
        return <Trophy className="h-5 w-5 text-green-600" />;
      case "dnf":
        return <X className="h-5 w-5 text-red-600" />;
      case "note":
        return <FileText className="h-5 w-5 text-blue-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  const getLogTypeLabel = () => {
    switch (log.type) {
      case "found":
        return "Found it";
      case "dnf":
        return "Didn't find it";
      case "note":
        return "Note";
      default:
        return log.type;
    }
  };

  const getLogTypeBadgeVariant = () => {
    switch (log.type) {
      case "found":
        return "default" as const;
      case "dnf":
        return "destructive" as const;
      case "note":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <Card className="mobile-card-spacing">
      <CardContent className={compact ? "p-3" : "p-3 md:p-4"}>
        {/* Mobile layout (md:hidden) */}
        <div className="space-y-3 md:hidden overflow-hidden">
          {/* Header row with avatar, name, and actions */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorName}
                  className={`rounded-full object-cover ${compact ? "h-8 w-8" : "h-9 w-9"}`}
                />
              ) : (
                <div className={`rounded-full bg-gray-200 flex items-center justify-center ${compact ? "h-8 w-8" : "h-9 w-9"}`}>
                  <User className={`text-gray-500 ${compact ? "h-4 w-4" : "h-4 w-4"}`} />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              {onProfileClick ? (
                <button
                  onClick={handleProfileClick}
                  className={`font-medium hover:underline cursor-pointer truncate block ${compact ? "text-sm" : "text-sm"}`}
                >
                  {authorName}
                </button>
              ) : (
                <span className={`font-medium truncate block ${compact ? "text-sm" : "text-sm"}`}>{authorName}</span>
              )}
            </div>
            
            {/* Actions - always visible on mobile */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <ZapButton target={log} />
              <AlertDialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-9 w-9 p-0 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:shadow-none focus-visible:shadow-none active:outline-none touch-target"
                      disabled={isDeleting}
                      style={{ outline: 'none', boxShadow: 'none' }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end"
                    side="bottom"
                    sideOffset={8}
                    avoidCollisions={true}
                    collisionPadding={{ bottom: 80 }} // Account for mobile nav bar
                  >
                    <DropdownMenuItem onClick={handleCopyEventId} className="focus:outline-none">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Event ID
                    </DropdownMenuItem>
                    {isOwnLog && (
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete log
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {isOwnLog && (
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete log?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete your log. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteLog}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={isDeleting}
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                )}
              </AlertDialog>
            </div>
          </div>

          {/* Badges row - mobile only */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={getLogTypeBadgeVariant()} className={`gap-1 ${compact ? "text-xs py-0.5 px-1.5 h-5" : "text-xs py-0.5 px-1.5 h-5"}`}>
              <span className="h-3 w-3 flex items-center justify-center">
                {getLogIcon()}
              </span>
              <span>{getLogTypeLabel().split(' ')[0]}</span>
            </Badge>
            {log.isVerified && (
              <Badge variant="outline" className={`gap-1 border-green-500 text-green-700 ${compact ? "text-xs py-0.5 px-1.5 h-5" : "text-xs py-0.5 px-1.5 h-5"}`}>
                <ShieldCheck className="h-3 w-3" />
                <span>✓</span>
              </Badge>
            )}
          </div>

          {/* Timestamp and zap info */}
          <div className={`flex items-center gap-2 text-gray-600 ${compact ? "text-xs" : "text-xs"}`}>
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{formatDistanceToNow(new Date(log.created_at * 1000), { addSuffix: true })}</span>
            {totalZapAmount > 0 && (
              <>
                <span className="text-gray-400">·</span>
                <Zap className="h-3 w-3 flex-shrink-0" />
                <span className="flex-shrink-0">{totalZapAmount.toLocaleString()} sats</span>
              </>
            )}
          </div>
          
          {/* Log text - mobile */}
          <LogText text={log.text} onProfileClick={onProfileClick} />
          
          
        </div>

        {/* Desktop layout (hidden md:block) - original design */}
        <div className="hidden md:block">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorName}
                  className={`rounded-full object-cover ${compact ? "h-8 w-8" : "h-10 w-10"}`}
                />
              ) : (
                <div className={`rounded-full bg-gray-200 flex items-center justify-center ${compact ? "h-8 w-8" : "h-10 w-10"}`}>
                  <User className={`text-gray-500 ${compact ? "h-4 w-4" : "h-5 w-5"}`} />
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-2 overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {onProfileClick ? (
                      <button
                        onClick={handleProfileClick}
                        className={`font-medium hover:underline cursor-pointer ${compact ? "text-sm" : ""}`}
                      >
                        {authorName}
                      </button>
                    ) : (
                      <span className={`font-medium ${compact ? "text-sm" : ""}`}>{authorName}</span>
                    )}
                    <Badge variant={getLogTypeBadgeVariant()} className={`gap-1 ${compact ? "text-xs py-0 px-2" : ""}`}>
                      {getLogIcon()}
                      {getLogTypeLabel()}
                    </Badge>
                    {log.isVerified && (
                      <Badge variant="outline" className={`gap-1 border-green-500 text-green-700 ${compact ? "text-xs py-0 px-2" : ""}`}>
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 text-gray-600 mt-1 ${compact ? "text-xs" : "text-sm"}`}>
                    <Calendar className={compact ? "h-3 w-3" : "h-3 w-3"} />
                    {formatDistanceToNow(new Date(log.created_at * 1000), { addSuffix: true })}
                    {totalZapAmount > 0 && (
                      <>
                        <span>·</span>
                        <Zap className="h-3 w-3" />
                        <span>{totalZapAmount.toLocaleString()} sats</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <ZapButton target={log} />
                  <AlertDialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size={compact ? "sm" : "sm"}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:shadow-none focus-visible:shadow-none active:outline-none"
                          disabled={isDeleting}
                          style={{ outline: 'none', boxShadow: 'none' }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="end"
                        side="bottom"
                        sideOffset={8}
                        avoidCollisions={true}
                        collisionPadding={{ bottom: 80 }}
                      >
                        <DropdownMenuItem onClick={handleCopyEventId} className="focus:outline-none">
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Event ID
                        </DropdownMenuItem>
                        {isOwnLog && (
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-red-600 focus:text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete log
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {isOwnLog && (
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete log?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete your log. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDeleteLog}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isDeleting}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    )}
                  </AlertDialog>
                </div>
              </div>
              
              <LogText text={log.text} onProfileClick={onProfileClick} />
              
              
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
