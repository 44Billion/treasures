import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { ZapTarget } from '@/types/zaps';
import { ZapDialog } from './ZapDialog';
import { useAuthor } from '@/hooks/useAuthor';

interface ZapButtonProps {
  target: ZapTarget;
  children?: React.ReactNode;
  className?: string;
}

export function ZapButton({ target, children, className }: ZapButtonProps) {
  const { user } = useCurrentUser();
  const { data: author } = useAuthor(target.pubkey);

  if (!user || user.pubkey === target.pubkey || !author?.metadata?.lud16 && !author?.metadata?.lud16) {
    return null;
  }

  return (
    <ZapDialog target={target}>
      <Button size="sm" className={className}>
        <Zap className={`h-4 w-4 ${children ? 'mr-2' : ''}`} />
        {children}
      </Button>
    </ZapDialog>
  );
}
