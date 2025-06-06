import { useState } from "react";
import { Map, Moon, Satellite, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

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
  pirate: {
    key: "pirate",
    name: "Treasure Map",
    description: "For true adventurers",
    icon: <Anchor className="h-4 w-4" />,
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-10 w-10 sm:w-auto gap-0 sm:gap-2 bg-background/90 backdrop-blur-sm border hover:bg-background/95 ${className}`}
        >
          {currentStyleData.icon}
          <span className="hidden sm:inline">{currentStyleData.name}</span>
          <Map className="h-3 w-3 opacity-50 hidden sm:inline" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-3" 
        align="end"
        side="bottom"
        sideOffset={8}
        alignOffset={0}
        avoidCollisions={true}
        sticky="always"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Map className="h-4 w-4 text-emerald-600" />
            <h4 className="font-semibold text-sm">Map Styles</h4>
          </div>
          
          <div className="grid gap-2">
            {Object.values(MAP_STYLES).map((style) => (
              <button
                key={style.key}
                onClick={() => {
                  onStyleChange(style.key);
                  setOpen(false);
                }}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left w-full
                  ${currentStyle === style.key 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm' 
                    : 'border hover:border-muted-foreground hover:bg-muted/50'
                  }
                `}
              >
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full
                  ${currentStyle === style.key 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300' 
                    : 'bg-muted text-muted-foreground'
                  }
                `}>
                  {style.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{style.name}</span>
                    {currentStyle === style.key && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{style.description}</p>
                </div>
              </button>
            ))}
          </div>
          
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Choose between clean, dark, or adventure-themed styles for your adventure.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}