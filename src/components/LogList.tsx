import { LogText } from "./LogText";
import { Link } from "react-router-dom";
import { Trophy, X, FileText, User, Calendar, Trash2, MoreVertical, Copy, ShieldCheck, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/alert-dialog";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDeleteLog } from "@/hooks/useDeleteLog";
import { useToast } from "@/hooks/useToast";
import { formatDistanceToNow } from "@/utils/date";
import { useLogStore } from "@/stores/useLogStore";
import { ZapButton } from "@/components/ZapButton";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { nip19, nip57 } from "nostr-tools";

import type { GeocacheLog } from "@/types/geocache";


interface LogListProps {
  logs: GeocacheLog[];
  compact?: boolean;
  onProfileClick?: (pubkey: string) => void;
}

export function LogList({ logs, compact = false }: LogListProps) {
  // Logs received from LogsSection
  
  return (
    <div className="px-2 space-y-3 md:space-y-4">
      {logs.map((log) => (
        <LogCard key={log.id} log={log} compact={compact} />
      ))}
    </div>
  );
}

interface LogCardProps {
  log: GeocacheLog;
  compact?: boolean;
}

function LogCard({ log, compact = false }: LogCardProps) {
  // The log is always signed by the actual user now
  const { t } = useTranslation();
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

  const handleDeleteLog = () => {
    deleteLog(log.id);
  };

  const handleCopyEventId = async () => {
    try {
      await navigator.clipboard.writeText(log.id);
      toast({
        title: t('logs.eventIdCopied.title'),
        description: t('logs.eventIdCopied.description'),
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
        title: t('logs.eventIdCopied.title'),
        description: t('logs.eventIdCopied.description'),
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

  const dittoUrl = useMemo(() => {
    try {
      const neventId = nip19.neventEncode({ id: log.id, author: log.pubkey });
      return `https://ditto.pub/${neventId}`;
    } catch {
      return `https://ditto.pub/${log.id}`;
    }
  }, [log.id, log.pubkey]);

  const handleViewOnDitto = () => {
    window.open(dittoUrl, '_blank', 'noopener,noreferrer');
  };

  const getLogIcon = () => {
    switch (log.type) {
      case "found":
        return <Trophy className="h-3 w-3 md:h-4 md:w-4 text-primary-foreground" />;
      case "dnf":
        return <X className="h-3 w-3 md:h-4 md:w-4 text-red-600" />;
      case "note":
        return <FileText className="h-3 w-3 md:h-4 md:w-4 text-blue-600" />;
      default:
        return <FileText className="h-3 w-3 md:h-4 md:w-4 text-gray-600" />;
    }
  };

  const getLogTypeLabel = () => {
    switch (log.type) {
      case "found":
        return t('logs.type.found');
      case "dnf":
        return t('logs.type.dnf');
      case "note":
        return t('logs.type.note');
      case "maintenance":
        return t('logs.type.maintenance');
      case "archived":
        return t('logs.type.archive');
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
        <div className="flex gap-3 md:gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={authorName}
                className={`rounded-full object-cover ${compact ? "h-8 w-8" : "h-9 w-9 md:h-10 md:w-10"}`}
              />
            ) : (
              <div className={`rounded-full bg-gray-200 flex items-center justify-center ${compact ? "h-8 w-8" : "h-9 w-9 md:h-10 md:w-10"}`}>
                <User className={`text-gray-500 ${compact ? "h-4 w-4" : "h-4 w-4 md:h-5 md:w-5"}`} />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2 overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Name + badges: inline on desktop, stacked on mobile */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/profile/${log.pubkey}`}
                    className="font-medium hover:underline cursor-pointer truncate"
                  >
                    {authorName}
                  </Link>
                  <Badge variant={getLogTypeBadgeVariant()} className="gap-0.5 md:gap-1 text-[10px] md:text-xs px-1.5 md:px-2.5 py-0 md:py-0.5">
                    {getLogIcon()}
                    <span className="lg:hidden">{getLogTypeLabel().split(' ')[0]}</span>
                    <span className="hidden lg:inline">{getLogTypeLabel()}</span>
                  </Badge>
                  {log.isVerified && (
                    <Badge variant="outline" className="gap-0.5 md:gap-1 border-primary text-primary text-[10px] md:text-xs px-1.5 md:px-2.5 py-0 md:py-0.5">
                      <ShieldCheck className="h-2.5 w-2.5 md:h-3 md:w-3" />
                      <span className="lg:hidden">&#10003;</span>
                      <span className="hidden lg:inline">Verified</span>
                    </Badge>
                  )}
                </div>
                {/* Timestamp */}
                <div className="flex items-center gap-2 text-muted-foreground text-xs md:text-sm mt-1">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span>{formatDistanceToNow(new Date(log.created_at * 1000), { addSuffix: true })}</span>
                  {totalZapAmount > 0 && (
                    <>
                      <span>·</span>
                      <Zap className="h-3 w-3 flex-shrink-0" />
                      <span>{totalZapAmount.toLocaleString()} sats</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                <ZapButton target={log} />
                <AlertDialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                        disabled={isDeleting}
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
                      <DropdownMenuItem onClick={handleCopyEventId}>
                        <Copy className="h-4 w-4 mr-2" />
                        {t('logs.copyEventId', 'Copy Event ID')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleViewOnDitto}>
                        <img src="https://ditto.pub/favicon.ico" alt="" className="h-4 w-4 mr-2" />
                        {t('logs.viewOnDitto', 'View on Ditto')}
                      </DropdownMenuItem>
                      {isOwnLog && (
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('logs.deleteLog', 'Delete log')}
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {isOwnLog && (
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('logs.delete.confirm.title', 'Delete this log?')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {logPreview
                            ? t('logs.delete.confirm.descriptionWithType', {
                                type: logTypeLabel,
                                preview: logPreview,
                                defaultValue:
                                  'Delete your "{{type}}" log: "{{preview}}"? This action cannot be undone.',
                              })
                            : t('logs.delete.confirm.descriptionNoText', {
                                type: logTypeLabel,
                                defaultValue:
                                  'Delete your "{{type}}" log? This action cannot be undone.',
                              })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {t('logs.delete.confirm.cancel', 'Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteLog}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={isDeleting}
                        >
                          {isDeleting
                            ? t('logs.delete.confirm.deleting', 'Deleting...')
                            : t('logs.delete.confirm.confirm', 'Delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  )}
                </AlertDialog>
              </div>
            </div>

            {/* Log text */}
            <LogText text={log.text} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
