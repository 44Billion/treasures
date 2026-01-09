import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ListFilter, X, Eye, Search, Lightbulb, Brain, Cpu, Footprints, Mountain, Pickaxe, Compass, HelpCircle } from "lucide-react";
import { sneaker, treesForest, chest } from '@lucide/lab';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CacheIcon } from "@/features/geocache/utils/cacheIcons";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/lib/utils";

// Create React components from Lucide Lab icons
const SneakerIcon = ({ className, ...props }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {sneaker.map(([element, attrs], index) => {
      const Element = element as keyof JSX.IntrinsicElements;
      const { key, ...restAttrs } = attrs as any;
      return <Element key={key || index} {...restAttrs} />;
    })}
  </svg>
);

const TreesForestIcon = ({ className, ...props }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {treesForest.map(([element, attrs], index) => {
      const Element = element as keyof JSX.IntrinsicElements;
      const { key, ...restAttrs } = attrs as any;
      return <Element key={key || index} {...restAttrs} />;
    })}
  </svg>
);

const ChestIcon = ({ className, ...props }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {chest.map(([element, attrs], index) => {
      const Element = element as keyof JSX.IntrinsicElements;
      const { key, ...restAttrs } = attrs as any;
      return <Element key={key || index} {...restAttrs} />;
    })}
  </svg>
);

interface FilterButtonProps {
  // Difficulty filters
  difficulty?: number;
  difficultyOperator: ComparisonOperator;
  onDifficultyChange: (value: number | undefined) => void;
  onDifficultyOperatorChange: (operator: ComparisonOperator) => void;

  // Terrain filters
  terrain?: number;
  terrainOperator: ComparisonOperator;
  onTerrainChange: (value: number | undefined) => void;
  onTerrainOperatorChange: (operator: ComparisonOperator) => void;

  // Cache type filter
  cacheType?: string;
  onCacheTypeChange: (value: string | undefined) => void;

  className?: string;
  compact?: boolean;
}

export function FilterButton({
  difficulty,
  difficultyOperator,
  onDifficultyChange,
  onDifficultyOperatorChange,
  terrain,
  terrainOperator,
  onTerrainChange,
  onTerrainOperatorChange,
  cacheType,
  onCacheTypeChange,
  className,
  compact = false,
}: FilterButtonProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Difficulty options with icons
  const difficultyOptions = useMemo(() => [
    { value: "1", label: `1 - ${t('geocache.difficulty.easy')}`, name: t('geocache.difficulty.easy'), icon: Eye, color: "text-green-600" },
    { value: "2", label: `2 - ${t('geocache.difficulty.moderate')}`, name: t('geocache.difficulty.moderate'), icon: Search, color: "text-green-600" },
    { value: "3", label: `3 - ${t('geocache.difficulty.hard')}`, name: t('geocache.difficulty.hard'), icon: Lightbulb, color: "text-green-600" },
    { value: "4", label: `4 - ${t('geocache.difficulty.veryHard')}`, name: t('geocache.difficulty.veryHard'), icon: Brain, color: "text-green-600" },
    { value: "5", label: `5 - ${t('geocache.difficulty.expert')}`, name: t('geocache.difficulty.expert'), icon: Cpu, color: "text-green-600" },
  ], [t, i18n.language]);

  // Terrain options with icons
  const terrainOptions = useMemo(() => [
    { value: "1", label: `1 - ${t('geocache.terrain.easy')}`, name: t('geocache.terrain.easy'), icon: SneakerIcon, color: "text-blue-600" },
    { value: "2", label: `2 - ${t('geocache.terrain.moderate')}`, name: t('geocache.terrain.moderate'), icon: Footprints, color: "text-blue-600" },
    { value: "3", label: `3 - ${t('geocache.terrain.hard')}`, name: t('geocache.terrain.hard'), icon: TreesForestIcon, color: "text-blue-600" },
    { value: "4", label: `4 - ${t('geocache.terrain.veryHard')}`, name: t('geocache.terrain.veryHard'), icon: Mountain, color: "text-blue-600" },
    { value: "5", label: `5 - ${t('geocache.terrain.expert')}`, name: t('geocache.terrain.expert'), icon: Pickaxe, color: "text-blue-600" },
  ], [t, i18n.language]);

  // Cache type options with icons
  const cacheTypeOptions = useMemo(() => [
    { value: "traditional", label: t('geocache.type.traditional'), icon: ChestIcon, color: "text-emerald-600" },
    { value: "multi", label: t('geocache.type.multi'), icon: Compass, color: "text-amber-600" },
    { value: "mystery", label: t('geocache.type.mystery'), icon: HelpCircle, color: "text-purple-600" },
  ], [t, i18n.language]);

  // Helper functions for consistent value handling
  const createValueChangeHandler = (
    setter: (value: number | undefined) => void,
    operatorSetter: (operator: ComparisonOperator) => void
  ) => (value: string) => {
    if (value === "all") {
      setter(undefined);
      operatorSetter("all");
    } else {
      setter(parseInt(value));
      // Keep current operator if it's not "all", otherwise set to "eq"
      operatorSetter((current) => current === "all" ? "eq" : current);
    }
  };

  const getValueForDisplay = (value: number | undefined) => value?.toString() || "all";

  const handleCacheTypeChange = (value: string) => {
    onCacheTypeChange(value === "all" ? undefined : value);
  };

  // Count active filters
  const activeFilterCount = [
    difficulty !== undefined,
    terrain !== undefined,
    cacheType !== undefined,
  ].filter(Boolean).length;

  // Clear all filters
  const clearAllFilters = () => {
    onDifficultyChange(undefined);
    onDifficultyOperatorChange("all");
    onTerrainChange(undefined);
    onTerrainOperatorChange("all");
    onCacheTypeChange(undefined);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn(
            "relative !border-border",
            activeFilterCount > 0 && "!border-primary",
            className
          )}
          style={{ borderColor: activeFilterCount > 0 ? undefined : 'hsl(var(--border))' }}
        >
          <ListFilter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{t('filters.title')}</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                {t('filters.clearAll')}
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {/* Difficulty Filter */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">
                {t('filters.difficulty')}
              </Label>
              <Select
                value={getValueForDisplay(difficulty)}
                onValueChange={createValueChangeHandler(onDifficultyChange, onDifficultyOperatorChange)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue>
                    {difficulty === undefined ? (
                      t('filters.all')
                    ) : (
                      (() => {
                        const option = difficultyOptions.find(opt => opt.value === difficulty.toString());
                        const IconComponent = option?.icon;
                        return (
                          <span className="flex items-center gap-2">
                            {IconComponent && <IconComponent className={cn("h-4 w-4", option.color)} />}
                            {option?.label || difficulty}
                          </span>
                        );
                      })()
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('filters.all')}
                  </SelectItem>
                  {difficultyOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <IconComponent className={cn("h-4 w-4", option.color)} />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Terrain Filter */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">
                {t('filters.terrain')}
              </Label>
              <Select
                value={getValueForDisplay(terrain)}
                onValueChange={createValueChangeHandler(onTerrainChange, onTerrainOperatorChange)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue>
                    {terrain === undefined ? (
                      t('filters.all')
                    ) : (
                      (() => {
                        const option = terrainOptions.find(opt => opt.value === terrain.toString());
                        const IconComponent = option?.icon;
                        return (
                          <span className="flex items-center gap-2">
                            {IconComponent && <IconComponent className={cn("h-4 w-4", option.color)} />}
                            {option?.label || terrain}
                          </span>
                        );
                      })()
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('filters.all')}
                  </SelectItem>
                  {terrainOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <IconComponent className={cn("h-4 w-4", option.color)} />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Cache Type Filter */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">
                {t('filters.cacheType')}
              </Label>
              <Select
                value={cacheType || "all"}
                onValueChange={handleCacheTypeChange}
              >
                <SelectTrigger className="h-9">
                  <SelectValue>
                    {cacheType === undefined || cacheType === "all" ? (
                      t('filters.allTypes')
                    ) : (
                      (() => {
                        const option = cacheTypeOptions.find(opt => opt.value === cacheType);
                        const IconComponent = option?.icon;
                        return (
                          <span className="flex items-center gap-2">
                            {IconComponent && <IconComponent className={cn("h-4 w-4", option.color)} />}
                            {option?.label || cacheType}
                          </span>
                        );
                      })()
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('filters.allTypes')}
                  </SelectItem>
                  {cacheTypeOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <IconComponent className={cn("h-4 w-4", option.color)} />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}