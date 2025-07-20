import { useState } from "react";
import { Map, Moon, Satellite, Sword } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Badge } from "@/shared/components/ui/badge";

export interface MapStyle {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  url: string;
  attribution: string;
  preview?: string;
}

export const MAP_STYLES: Record<string, MapStyle> = {
  original: {
    key: "original",
    name: "Original",
    description: "Clean, bright cartography",
    icon: <Map className="h-4 w-4" />,
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  dark: {
    key: "dark",
    name: "Dark Mode", 
    description: "Dark theme for night use",
    icon: <Moon className="h-4 w-4" />,
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  satellite: {
    key: "satellite",
    name: "Satellite",
    description: "Aerial imagery view",
    icon: <Satellite className="h-4 w-4" />,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
  },
  adventure: {
    key: "adventure",
    name: "Quest Map",
    description: "For true adventurers",
    icon: <Sword className="h-4 w-4" />,
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

interface MapStyleSelectorProps {
  currentStyle: string;
  onStyleChange: (styleKey: string) => void;
  className?: string;
}

export function MapStyleSelector({ currentStyle, onStyleChange, className }: MapStyleSelectorProps) {
  const [open, setOpen] = useState(false);
  
  const currentStyleData = MAP_STYLES[currentStyle] || MAP_STYLES.original;
  const isAdventureTheme = currentStyle === 'adventure';

  // Adventure theme colors
  const adventureColors = {
    primary: '#a0825a', // Bronze
    primaryLight: '#b4966e', // Light bronze
    accent: '#d4af37', // Gold
    background: '#f5f1e8', // Parchment
    text: '#3c2e1f', // Dark brown
    textMuted: '#6b5b3f', // Medium brown
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-10 w-10 sm:w-auto gap-0 sm:gap-2 bg-background/90 backdrop-blur-sm border hover:bg-background/95 ${isAdventureTheme ? 'adventure-map-style-button' : ''} ${className}`}
        >
          {currentStyleData?.icon || <Map className="h-4 w-4" />}
          <span className="hidden sm:inline">{currentStyleData?.name || 'Original'}</span>
          <Map className="h-3 w-3 opacity-50 hidden sm:inline" />
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
            <Map className={`h-4 w-4 ${isAdventureTheme ? '' : 'text-emerald-600'}`} style={isAdventureTheme ? {
              color: adventureColors.accent,
            } : {}} />
            <h4 className="font-semibold text-sm" style={isAdventureTheme ? {
              color: adventureColors.text,
            } : {}}>Map Styles</h4>
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
                        {style.name}
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
                          Active
                        </Badge>
                      )}
                    </div>
                    <p 
                      className={`map-style-desc text-xs mt-0.5 ${!isAdventureTheme ? 'text-muted-foreground' : ''}`} 
                      style={isAdventureTheme ? {
                        color: adventureColors.textMuted,
                      } : {}}
                    >
                      {style.description}
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
              Choose between clean, dark, or adventure-themed styles for your adventure.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}