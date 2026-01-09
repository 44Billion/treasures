import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComparisonFilter, type ComparisonOperator } from "@/components/ui/comparison-filter";
import { Badge } from "@/components/ui/badge";
import { CacheIcon } from "@/features/geocache/utils/cacheIcons";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/lib/utils";

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

  // Create translated difficulty/terrain options that update when language changes
  const difficultyTerrainOptions = useMemo(() => [
    { value: "1", label: `1 - ${t('geocache.difficulty.easy')}` },
    { value: "2", label: `2 - ${t('geocache.difficulty.moderate')}` },
    { value: "3", label: `3 - ${t('geocache.difficulty.hard')}` },
    { value: "4", label: `4 - ${t('geocache.difficulty.veryHard')}` },
    { value: "5", label: `5 - ${t('geocache.difficulty.expert')}` },
  ], [t, i18n.language]);

  // Create translated cache type options that update when language changes
  const cacheTypeOptions = useMemo(() => [
    { value: "traditional", label: t('geocache.type.traditional') },
    { value: "multi", label: t('geocache.type.multi') },
    { value: "mystery", label: t('geocache.type.mystery') },
  ], [t, i18n.language]);

  // Helper functions for consistent value handling
  const createValueChangeHandler = (setter: (value: number | undefined) => void) =>
    (value: string) => setter(value === "all" ? undefined : parseInt(value));

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
      <PopoverContent className="w-80" align="start">
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
            <ComparisonFilter
              label={t('filters.difficulty')}
              value={getValueForDisplay(difficulty)}
              onValueChange={createValueChangeHandler(onDifficultyChange)}
              operator={difficultyOperator}
              onOperatorChange={onDifficultyOperatorChange}
              options={difficultyTerrainOptions}
            />

            {/* Terrain Filter */}
            <ComparisonFilter
              label={t('filters.terrain')}
              value={getValueForDisplay(terrain)}
              onValueChange={createValueChangeHandler(onTerrainChange)}
              operator={terrainOperator}
              onOperatorChange={onTerrainOperatorChange}
              options={difficultyTerrainOptions}
            />

            {/* Cache Type Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                {t('filters.cacheType')}
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {/* All Types Button */}
                <button
                  type="button"
                  onClick={() => handleCacheTypeChange("all")}
                  className={cn(
                    "p-2 rounded-lg border text-center transition-all",
                    !cacheType || cacheType === "all"
                      ? "border-primary bg-primary/10 dark:bg-primary/20"
                      : "border-border bg-background hover:border-muted-foreground"
                  )}
                >
                  <div className="h-5 w-5 mx-auto mb-1 flex items-center justify-center">
                    <ListFilter className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-xs text-foreground block truncate">
                    {t('filters.all')}
                  </span>
                </button>

                {/* Cache Type Buttons with Icons */}
                {cacheTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleCacheTypeChange(option.value)}
                    className={cn(
                      "p-2 rounded-lg border text-center transition-all",
                      cacheType === option.value
                        ? "border-primary bg-primary/10 dark:bg-primary/20"
                        : "border-border bg-background hover:border-muted-foreground"
                    )}
                  >
                    <div className="h-5 w-5 mx-auto mb-1">
                      <CacheIcon type={option.value} size="md" theme={theme} />
                    </div>
                    <span className="font-medium text-xs text-foreground block truncate">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}