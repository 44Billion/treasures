import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { MAP_STYLES, ADVENTURE_COLORS } from "@/features/map/constants/mapStyles";

interface MapStyleSelectorProps {
  currentStyle: string;
  onStyleChange: (styleKey: string) => void;
  className?: string;
}

export function MapStyleSelector({ currentStyle, onStyleChange, className }: MapStyleSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  
  const currentStyleData = MAP_STYLES[currentStyle] || MAP_STYLES.original;
  const isAdventureTheme = currentStyle === 'adventure';

  const adventureColors = ADVENTURE_COLORS;

  const getTranslatedName = (styleKey: string): string => {
    return t(`mapStyle.${styleKey}`) || MAP_STYLES[styleKey]?.name || 'Original';
  };

  const getTranslatedDescription = (styleKey: string): string => {
    return t(`mapStyle.${styleKey}.description`) || MAP_STYLES[styleKey]?.description || '';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-10 w-10 sm:w-auto gap-0 sm:gap-2 bg-background/90 backdrop-blur-sm border hover:bg-background/95 ${isAdventureTheme ? 'adventure-map-style-button' : ''} ${className}`}
        >
          {currentStyleData?.icon || <MapIcon className="h-4 w-4" />}
          <span className="hidden sm:inline">{getTranslatedName(currentStyle)}</span>
          <MapIcon className="h-3 w-3 opacity-50 hidden sm:inline" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={`w-80 p-3 ${isAdventureTheme ? 'adventure-popover' : ''}`}
        align="end"
        side="bottom"
        sideOffset={8}
        alignOffset={0}
        avoidCollisions={true}
        sticky="always"
        style={isAdventureTheme ? {
          backgroundColor: adventureColors.background,
          borderColor: adventureColors.primary,
          color: adventureColors.text,
        } : {}}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b" style={isAdventureTheme ? {
            borderColor: adventureColors.primary,
          } : {}}>
            <MapIcon className={`h-4 w-4 ${isAdventureTheme ? '' : 'text-emerald-600'}`} style={isAdventureTheme ? {
              color: adventureColors.accent,
            } : {}} />
            <h4 className="font-semibold text-sm" style={isAdventureTheme ? {
              color: adventureColors.text,
            } : {}}>{t('mapStyle.title')}</h4>
          </div>
          
          <div className="grid gap-2">
            {Object.values(MAP_STYLES).map((style) => {
              const isActive = currentStyle === style.key;
              
              return (
                <button
                  key={style.key}
                  onClick={() => {
                    onStyleChange(style.key);
                    setOpen(false);
                  }}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left w-full
                    ${!isAdventureTheme && isActive 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm' 
                      : !isAdventureTheme 
                        ? 'border hover:border-muted-foreground hover:bg-muted/50 dark:bg-muted'
                        : ''
                    }
                  `}
                  style={isAdventureTheme ? {
                    borderColor: isActive ? adventureColors.accent : adventureColors.primary,
                    backgroundColor: isActive ? adventureColors.primaryLight + '40' : 'transparent',
                    color: adventureColors.text,
                  } : {}}

                >
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full transition-all
                    ${!isAdventureTheme && isActive 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300' 
                      : !isAdventureTheme 
                        ? 'bg-muted text-muted-foreground'
                        : ''
                    }
                  `}
                  style={isAdventureTheme ? {
                    backgroundColor: isActive ? adventureColors.accent + '30' : adventureColors.primaryLight + '50',
                    color: isActive ? adventureColors.accent : adventureColors.primary,
                  } : {}}>
                    {style.icon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span 
                        className="map-style-name font-medium text-sm" 
                        style={isAdventureTheme ? {
                          color: adventureColors.text,
                        } : {}}
                      >
                        {getTranslatedName(style.key)}
                      </span>
                      {isActive && (
                        <Badge 
                          variant="secondary" 
                          className="text-xs px-1.5 py-0"
                          style={isAdventureTheme ? {
                            backgroundColor: adventureColors.accent + '30',
                            color: adventureColors.text,
                            borderColor: adventureColors.accent,
                          } : {}}
                        >
                          {t('mapStyle.active')}
                        </Badge>
                      )}
                    </div>
                    <p 
                      className={`map-style-desc text-xs mt-0.5 ${!isAdventureTheme ? 'text-muted-foreground' : ''}`} 
                      style={isAdventureTheme ? {
                        color: adventureColors.textMuted,
                      } : {}}
                    >
                      {getTranslatedDescription(style.key)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="pt-2 border-t" style={isAdventureTheme ? {
            borderColor: adventureColors.primary,
          } : {}}>
            <p className={`text-xs ${!isAdventureTheme ? 'text-muted-foreground' : ''}`} style={isAdventureTheme ? {
              color: adventureColors.textMuted,
            } : {}}>
              {t('mapStyle.footer')}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}