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

  const label = isLocating
    ? t('map.nearMe.locating')
    : isActive
      ? t('map.nearMe.active')
      : t('map.nearMe.title');

  // Use aria-disabled + pointer-events-none instead of the native `disabled`
  // attribute so the button stays focusable for screen-reader users while
  // locating is in progress.
  const handleClick = () => {
    if (isLocating) return;
    onNearMe();
  };

  return (
    <Button
      variant={isActive ? 'default' : 'secondary'}
      size="lg"
      className={`
        !p-0 h-10 w-10 min-w-10 rounded-full transition-all duration-200 flex items-center justify-center border
        ${isLocating ? 'opacity-80 cursor-not-allowed' : ''}
        ${isAdventureTheme
          ? isActive
            ? 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary'
            : 'bg-background/95 backdrop-blur-sm hover:bg-background'
          : isActive
            ? 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary'
            : 'bg-background/95 backdrop-blur-sm hover:bg-background'
        }
      `}
      onClick={handleClick}
      aria-label={label}
      aria-pressed={isActive}
      aria-busy={isLocating}
      aria-disabled={isLocating}
      title={label}
    >
      <Locate className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} aria-hidden="true" />
    </Button>
  );
}
