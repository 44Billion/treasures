import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComparisonFilter, type ComparisonOperator } from "@/components/ui/comparison-filter";
import { DIFFICULTY_TERRAIN_OPTIONS, CACHE_TYPE_OPTIONS } from "@/features/geocache/utils/geocache-constants";
import { Badge } from "@/components/ui/badge";
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
  const [isOpen, setIsOpen] = useState(false);

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
            "relative",
            activeFilterCount > 0 && "border-primary",
            className
          )}
        >
          <Filter className={cn("h-4 w-4", !compact && "mr-2")} />
          {!compact && "Filters"}
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
            <h4 className="font-medium">Filters</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {/* Difficulty Filter */}
            <ComparisonFilter
              label="Difficulty"
              value={getValueForDisplay(difficulty)}
              onValueChange={createValueChangeHandler(onDifficultyChange)}
              operator={difficultyOperator}
              onOperatorChange={onDifficultyOperatorChange}
              options={DIFFICULTY_TERRAIN_OPTIONS}
            />

            {/* Terrain Filter */}
            <ComparisonFilter
              label="Terrain"
              value={getValueForDisplay(terrain)}
              onValueChange={createValueChangeHandler(onTerrainChange)}
              operator={terrainOperator}
              onOperatorChange={onTerrainOperatorChange}
              options={DIFFICULTY_TERRAIN_OPTIONS}
            />

            {/* Cache Type Filter */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">
                Cache Type
              </Label>
              <Select 
                value={cacheType || "all"} 
                onValueChange={handleCacheTypeChange}
              >
                <SelectTrigger className="h-9">
                  <SelectValue>
                    {cacheType === undefined || cacheType === "all" ? (
                      "All Types"
                    ) : (
                      CACHE_TYPE_OPTIONS.find(opt => opt.value === cacheType)?.label || cacheType
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {CACHE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}