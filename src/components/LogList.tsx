import { Trophy, X, FileText, User, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthor } from "@/hooks/useAuthor";
import { formatDistanceToNow } from "@/lib/date";
import { EventSourceInfo } from "@/components/EventSourceInfo";
import type { GeocacheLog } from "@/types/geocache";

interface LogListProps {
  logs: GeocacheLog[];
  compact?: boolean;
}

export function LogList({ logs, compact = false }: LogListProps) {
  return (
    <div className="space-y-4">
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
  const author = useAuthor(log.pubkey);
  const authorName = author.data?.metadata?.name || log.pubkey.slice(0, 8);
  const authorAvatar = author.data?.metadata?.picture;

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
        return "Write note";
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
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${compact ? "text-sm" : ""}`}>{authorName}</span>
                  <Badge variant={getLogTypeBadgeVariant()} className={`gap-1 ${compact ? "text-xs py-0 px-2" : ""}`}>
                    {getLogIcon()}
                    {getLogTypeLabel()}
                  </Badge>
                </div>
                <div className={`flex items-center gap-2 text-gray-600 mt-1 ${compact ? "text-xs" : "text-sm"}`}>
                  <Calendar className={compact ? "h-3 w-3" : "h-3 w-3"} />
                  {formatDistanceToNow(new Date(log.created_at * 1000), { addSuffix: true })}
                </div>
                {(log.client || log.sourceRelay || log.relays?.[0]) && (
                  <EventSourceInfo 
                    client={log.client} 
                    relayUrl={log.relays?.[0] || log.sourceRelay}
                    className="mt-1" 
                  />
                )}
              </div>
            </div>
            
            <p className={`whitespace-pre-wrap ${compact ? "text-xs" : "text-sm"}`}>{log.text}</p>
            
            {log.images && log.images.length > 0 && (
              <div className={`grid grid-cols-3 gap-2 mt-3`}>
                {log.images.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Log image ${index + 1}`}
                    className={`rounded w-full object-cover cursor-pointer hover:opacity-90 ${compact ? "h-16" : "h-24"}`}
                    onClick={() => window.open(url, "_blank")}
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