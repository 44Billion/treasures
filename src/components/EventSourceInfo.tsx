import { Globe, Terminal } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EventSourceInfoProps {
  relayUrl?: string;
  client?: string;
  className?: string;
}

export function EventSourceInfo({ relayUrl, client, className = "" }: EventSourceInfoProps) {
  if (!relayUrl && !client) return null;

  // Extract domain from relay URL for cleaner display
  const getRelayDomain = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        {relayUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 hover:text-foreground transition-colors cursor-help">
                <Globe className="h-3 w-3" />
                <span className="hidden sm:inline">{getRelayDomain(relayUrl)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Relay: {relayUrl}</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {client && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 hover:text-foreground transition-colors cursor-help">
                <Terminal className="h-3 w-3" />
                <span className="text-[10px] sm:text-xs">{client}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Client: {client}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}