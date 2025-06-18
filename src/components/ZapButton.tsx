import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { requestProvider } from 'webln';
import type { WebLNProvider } from 'webln';
import type { Geocache } from '@/types/geocache';
import { ZapModal } from './ZapModal';

interface ZapButtonProps {
  geocache: Geocache;
}

export function ZapButton({ geocache }: ZapButtonProps) {
  const [webln, setWebln] = useState<WebLNProvider | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useCurrentUser();

  useEffect(() => {
    async function getWeblnProvider() {
      try {
        const provider = await requestProvider();
        setWebln(provider);
      } catch (err) {
        // Silently fail
      }
    }
    getWeblnProvider();
  }, []);

  return (
    <>
      <Button size="sm" onClick={() => setIsModalOpen(true)} disabled={!user} className="bg-black text-white hover:bg-gray-800">
        <Zap className="h-4 w-4" />
      </Button>
      <ZapModal open={isModalOpen} onOpenChange={setIsModalOpen} geocache={geocache} webln={webln} />
    </>
  );
}
