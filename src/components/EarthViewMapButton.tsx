import { useTranslation } from 'react-i18next';
import { Earth } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EarthViewMapButtonProps {
  onClick: () => void;
}

export function EarthViewMapButton({ onClick }: EarthViewMapButtonProps) {
  const { t } = useTranslation();
  const label = t('map.earthView', 'Earth View');

  return (
    <Button
      variant="secondary"
      size="lg"
      className="!p-0 h-10 w-10 min-w-10 rounded-full transition-all duration-200 flex items-center justify-center border bg-background/95 backdrop-blur-sm hover:bg-background"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Earth className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
