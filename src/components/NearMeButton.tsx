import { useTranslation } from 'react-i18next';
import { Locate } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NearMeButtonProps {
  onNearMe: () => void;
  isActive: boolean;
  isLocating: boolean;
  isAdventureTheme?: boolean;
}

export function NearMeButton({ onNearMe, isActive, isLocating, isAdventureTheme = false }: NearMeButtonProps) {
  const { t } = useTranslation();

  return (
    <Button
      variant={isActive ? "default" : "secondary"}
      size="lg"
      className={`
        !p-0 h-10 w-10 min-w-10 rounded-full transition-all duration-200 flex items-center justify-center border
        ${isAdventureTheme
          ? isActive
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
            : 'bg-background/95 backdrop-blur-sm hover:bg-background'
          : isActive
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
            : 'bg-background/95 backdrop-blur-sm hover:bg-background'
        }
      `}
      onClick={onNearMe}
      disabled={isLocating}
      title={isLocating ? t('map.nearMe.locating') : isActive ? t('map.nearMe.active') : t('map.nearMe.title')}
    >
      <Locate className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />
    </Button>
  );
}
