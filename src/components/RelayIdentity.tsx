import { Server, Shield, Zap } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRelayInfo } from '@/hooks/useRelayInfo';

export function renderRelayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'wss:') {
      return parsed.pathname === '/' ? parsed.host : parsed.host + parsed.pathname;
    }
    return parsed.href;
  } catch {
    return url;
  }
}

export function RelayIdentity({ url }: { url: string }) {
  const { data: relayInfo } = useRelayInfo(url);

  const relayName = relayInfo?.name?.trim() || renderRelayUrl(url);
  const relayDescription = relayInfo?.description?.trim();

  const hasPaymentRequired = Boolean(relayInfo?.limitation?.payment_required ?? relayInfo?.payment_required);
  const hasAuthRequired = Boolean(relayInfo?.limitation?.auth_required ?? relayInfo?.auth_required);

  const notableNips = (relayInfo?.supported_nips ?? []).filter((nip) => nip === 42 || nip === 50);

  const identityContent = (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium leading-tight" title={relayName}>
        {relayName}
      </p>
      <p className="truncate text-[11px] text-muted-foreground" title={url}>
        {url}
      </p>
      {(hasPaymentRequired || hasAuthRequired || notableNips.length > 0) && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {notableNips.includes(50) && <Badge variant="outline" className="text-[10px]">NIP-50</Badge>}
          {notableNips.includes(42) && <Badge variant="outline" className="text-[10px]">NIP-42</Badge>}
          {hasAuthRequired && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Shield className="size-2.5" />
              Auth
            </Badge>
          )}
          {hasPaymentRequired && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Zap className="size-2.5" />
              Paid
            </Badge>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar className="size-8 shrink-0 border border-border/70">
        <AvatarImage src={relayInfo?.icon} alt={`${relayName} icon`} />
        <AvatarFallback>
          <Server className="size-4 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
      {relayDescription ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="min-w-0 flex-1">
              {identityContent}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-72 text-xs leading-relaxed">
            {relayDescription}
          </TooltipContent>
        </Tooltip>
      ) : (
        identityContent
      )}
    </div>
  );
}
