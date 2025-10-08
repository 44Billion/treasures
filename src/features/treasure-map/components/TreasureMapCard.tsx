import React from 'react';
import { MapPin, Clock, Zap, Map, TreePine, Building2, Route, Landmark } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TreasureMap } from '../types/treasure-map';

// Map category icons using Lucide icons
const CATEGORY_ICONS = {
  city: { icon: Building2, label: 'City Adventure' },
  park: { icon: TreePine, label: 'Park Expedition' },
  region: { icon: Map, label: 'Regional Quest' },
  trail: { icon: Route, label: 'Trail Journey' },
  landmark: { icon: Landmark, label: 'Landmark Hunt' },
} as const;

interface TreasureMapCardProps {
  treasureMap: TreasureMap;
  onClick?: () => void;
  className?: string;
}

export function TreasureMapCard({ treasureMap, onClick, className }: TreasureMapCardProps) {
  const categoryInfo = CATEGORY_ICONS[treasureMap.category];
  const CategoryIcon = categoryInfo.icon;

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    if (difficulty.toLowerCase().includes('easy')) return 'bg-green-100 text-green-800 border-green-200';
    if (difficulty.toLowerCase().includes('moderate')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (difficulty.toLowerCase().includes('challenging')) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-2 hover:border-primary/20",
        "bg-white dark:bg-slate-800",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
              {treasureMap.name}
            </CardTitle>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <CategoryIcon className="h-3 w-3" />
                {categoryInfo.label}
              </Badge>
              {treasureMap.difficulty && (
                <Badge
                  variant="outline"
                  className={cn("text-xs border", getDifficultyColor(treasureMap.difficulty))}
                >
                  {treasureMap.difficulty}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {treasureMap.description && (
          <CardDescription className="text-sm line-clamp-2">
            {treasureMap.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              {treasureMap.estimatedTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{treasureMap.estimatedTime}</span>
                </div>
              )}
            </div>
          </div>

          {/* Area info */}
          <div className="text-xs text-muted-foreground">
            {treasureMap.area.radius ? (
              <span>{treasureMap.area.radius}km radius</span>
            ) : (
              <span>Custom area</span>
            )}
          </div>

          {/* Action button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            <Zap className="h-3 w-3 mr-2" />
            Start Adventure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}