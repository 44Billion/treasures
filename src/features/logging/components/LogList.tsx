import { Trophy, X, FileText, User, Calendar, Trash2, MoreVertical, Copy, ShieldCheck } from "lucide-react";
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
import { BlurredImage } from "@/components/BlurredImage";

import type { GeocacheLog } from "@/types/geocache";

interface LogListProps {
  logs: GeocacheLog[];
  compact?: boolean;
  onProfileClick?: (pubkey: string) => void;
}

export function LogList({ logs, compact = false, onProfileClick }: LogListProps) {
  return (
    <div className="space-y-4">
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
  
  // Graceful handling of author data loading
  const isLoadingAuthor = author.isLoading;
  const hasProfile = author.data?.hasProfile !== false; // undefined means still loading, false means no profile
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
    <Card>
      <CardContent className={compact ? "p-3" : "p-4"}>
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
          
          <div className="flex-1 space-y-2">
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
                </div>

              </div>
              
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
            
            <p className={`whitespace-pre-wrap ${compact ? "text-xs" : "text-sm"}`}>{log.text}</p>
            
            {log.images && log.images.length > 0 && (
              <div className={`grid grid-cols-3 gap-2 mt-3`}>
                {log.images.map((url, index) => (
                  <BlurredImage
                    key={index}
                    src={url}
                    alt={`Log image ${index + 1}`}
                    className={`rounded w-full ${compact ? "h-16" : "h-24"}`}
                    onClick={() => window.open(url, "_blank")}
                    blurIntensity="medium"
                    defaultBlurred={true}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}