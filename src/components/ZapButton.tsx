import { useState } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { requestProvider } from 'webln';
import type { WebLNProvider } from 'webln';
import type { ZapTarget } from '@/types/zaps';
import { ZapModal } from './ZapModal';
import { useAuthor } from '@/features/auth/hooks/useAuthor';

interface ZapButtonProps {
  target: ZapTarget;
  children?: React.ReactNode;
  className?: string;
}

export function ZapButton({ target, children, className }: ZapButtonProps) {
  const [webln, setWebln] = useState<WebLNProvider | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useCurrentUser();
  const { data: author } = useAuthor(target.pubkey);

  const handleOpenModal = async () => {
    if (!webln) {
      try {
        const provider = await requestProvider();
        setWebln(provider);
      } catch (err) {
        // Silently fail
      }
    }
    setIsModalOpen(true);
  };

  if (!user || user.pubkey === target.pubkey || !author?.metadata?.lud16) {
    return null;
  }

  return (
    <>
      <Button size="sm" onClick={handleOpenModal} className={className}>
        <Zap className={`h-4 w-4 ${children ? 'mr-2' : ''}`} />
        {children}
      </Button>
      {isModalOpen && <ZapModal open={isModalOpen} onOpenChange={setIsModalOpen} target={target} webln={webln} />}
    </>
  );
}
