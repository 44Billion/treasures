import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompassMapButtonProps {
  onClick: () => void;
  isAdventureTheme?: boolean;
}

export function CompassMapButton({ onClick, isAdventureTheme: _ = false }: CompassMapButtonProps) {
  const { t } = useTranslation();

  return (
    <Button
      variant="secondary"
      size="lg"
      className="!p-0 h-10 w-10 min-w-10 rounded-full transition-all duration-200 flex items-center justify-center border bg-background/95 backdrop-blur-sm hover:bg-background"
      onClick={onClick}
      title={t('radar.openCompass', 'Magic Compass')}
    >
      <Compass className="h-4 w-4" />
    </Button>
  );
}
