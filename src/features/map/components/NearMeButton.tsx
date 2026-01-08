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
        !p-[4px] h-14 w-14 min-w-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center
        ${isAdventureTheme
          ? isActive
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-700'
            : 'bg-background/95 backdrop-blur-sm hover:bg-background border-2'
          : isActive
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-700'
            : 'bg-background/95 backdrop-blur-sm hover:bg-background border-2'
        }
        ${isActive ? 'scale-110' : 'hover:scale-105'}
      `}
      onClick={onNearMe}
      disabled={isLocating}
      title={isLocating ? t('map.nearMe.locating') : isActive ? t('map.nearMe.active') : t('map.nearMe.title')}
    >
      <Locate className={`h-6 w-6 ${isLocating ? 'animate-spin' : ''}`} />
    </Button>
  );
}
