import { Trophy, X, FileText, User, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthor } from "@/hooks/useAuthor";
import { formatDistanceToNow } from "@/lib/date";
import type { GeocacheLog } from "@/types/geocache";

interface LogListProps {
  logs: GeocacheLog[];
}

export function LogList({ logs }: LogListProps) {
  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <LogCard key={log.id} log={log} />
      ))}
    </div>
  );
}

interface LogCardProps {
  log: GeocacheLog;
}

function LogCard({ log }: LogCardProps) {
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
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={authorName}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-500" />
              </div>
            )}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{authorName}</span>
                  <Badge variant={getLogTypeBadgeVariant()} className="gap-1">
                    {getLogIcon()}
                    {getLogTypeLabel()}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(log.created_at * 1000), { addSuffix: true })}
                </div>
              </div>
            </div>
            
            <p className="text-sm whitespace-pre-wrap">{log.text}</p>
            
            {log.images && log.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {log.images.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Log image ${index + 1}`}
                    className="rounded w-full h-24 object-cover cursor-pointer hover:opacity-90"
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