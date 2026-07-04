import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ListFilter, X, Eye, Search, Lightbulb, Brain, Cpu, Footprints, Mountain, Pickaxe, Compass, HelpCircle, Sparkles, Archive, Wrench, CheckCircle2, PiggyBank } from "lucide-react";
import { sneaker, treesForest, chest } from '@lucide/lab';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
export type ComparisonOperator = "all" | "eq" | "gt" | "gte" | "lt" | "lte";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Create React components from Lucide Lab icons
const makeLabIcon = (nodes: typeof chest) => {
  const LabIcon = ({ className, ...props }: { className?: string }) => (
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
      {nodes.map(([element, attrs], index) => {
        const Element = element as React.ElementType;
        const { key, ...restAttrs } = attrs as any;
        return <Element key={key || index} {...restAttrs} />;
      })}
    </svg>
  );
  return LabIcon;
};

const ChestIcon = makeLabIcon(chest);
const SneakerIcon = makeLabIcon(sneaker);
const TreesForestIcon = makeLabIcon(treesForest);

/**
 * Small tappable toggle chip. The whole filter popover is built from these
 * instead of dropdowns so every option is visible at a glance — one tap to
 * set, one tap to unset. Pass `tooltip` to wrap the chip in a hover/focus
 * tooltip (used for D/T level names and type descriptions).
 */
function FilterChip({
  selected,
  onClick,
  tooltip,
  className,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  tooltip?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const chip = (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 h-7 rounded-full border px-2.5 text-xs transition-colors",
        selected
          ? "border-primary bg-primary/10 text-primary font-medium"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );

  if (!tooltip) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Section header label with an optional help-icon tooltip explaining what
 * the section filters on.
 *
 * Tooltip behavior mirrors `LightningBadge` on the cache detail page:
 * hover-driven on desktop, and click/tap opens it too (the click handler
 * calls `preventDefault()`, which suppresses Radix's internal
 * close-on-click trigger behavior). Tapping anywhere else dismisses it.
 */
function SectionLabel({ label, tooltip }: { label: string; tooltip?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {tooltip && (
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${label} info`}
              className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(true);
              }}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" collisionPadding={16} className="max-w-60">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

interface FilterButtonProps {
  difficulty?: number;
  difficultyOperator: ComparisonOperator;
  onDifficultyChange: (value: number | undefined) => void;
  onDifficultyOperatorChange: (operator: ComparisonOperator) => void;

  terrain?: number;
  terrainOperator: ComparisonOperator;
  onTerrainChange: (value: number | undefined) => void;
  onTerrainOperatorChange: (operator: ComparisonOperator) => void;

  cacheType?: string;
  onCacheTypeChange: (value: string | undefined) => void;

  /** Status filter flags. When an omitted prop is undefined, treat as default (active=true, others=false). */
  showActive?: boolean;
  showArchived?: boolean;
  showMaintenance?: boolean;
  onShowActiveChange?: (value: boolean) => void;
  onShowArchivedChange?: (value: boolean) => void;
  onShowMaintenanceChange?: (value: boolean) => void;

  /** When true, only Lightning Piggy treasures are shown. Off by default. */
  showPiggyOnly?: boolean;
  onShowPiggyOnlyChange?: (value: boolean) => void;

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
  showActive = true,
  showArchived = false,
  showMaintenance = false,
  onShowActiveChange,
  onShowArchivedChange,
  onShowMaintenanceChange,
  showPiggyOnly = false,
  onShowPiggyOnlyChange,
  className,
  compact = false,
}: FilterButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  void compact;

  const operatorSymbols: Partial<Record<ComparisonOperator, string>> = {
    eq: "=",
    gte: "≥",
    lte: "≤",
  };
  const operatorChoices: ComparisonOperator[] = ["eq", "gte", "lte"];

  // Per-level D/T chip icons + names (names shown as tooltips)
  const difficultyLevels = useMemo(() => [
    { level: 1, name: t('geocache.difficulty.easy'), icon: Eye },
    { level: 2, name: t('geocache.difficulty.moderate'), icon: Search },
    { level: 3, name: t('geocache.difficulty.hard'), icon: Lightbulb },
    { level: 4, name: t('geocache.difficulty.veryHard'), icon: Brain },
    { level: 5, name: t('geocache.difficulty.expert'), icon: Cpu },
  ], [t]);

  const terrainLevels = useMemo(() => [
    { level: 1, name: t('geocache.terrain.easy'), icon: SneakerIcon },
    { level: 2, name: t('geocache.terrain.moderate'), icon: Footprints },
    { level: 3, name: t('geocache.terrain.hard'), icon: TreesForestIcon },
    { level: 4, name: t('geocache.terrain.veryHard'), icon: Mountain },
    { level: 5, name: t('geocache.terrain.expert'), icon: Pickaxe },
  ], [t]);

  // Cache type options with icons + tooltip descriptions
  const cacheTypeOptions = useMemo(() => [
    { value: "traditional", label: t('geocache.type.traditional'), icon: ChestIcon, tooltip: t('createCache.form.type.traditional.description') },
    { value: "multi", label: t('geocache.type.multi'), icon: Compass, tooltip: t('createCache.form.type.multi.description') },
    { value: "mystery", label: t('geocache.type.mystery'), icon: HelpCircle, tooltip: t('createCache.form.type.mystery.description') },
    { value: "adventure", label: "Adventure", icon: Sparkles, tooltip: t('filters.typeAdventureTooltip', 'Curated multi-treasure quests') },
  ], [t]);

  // Source options: "Treasures" is the default (all listings, no client
  // filtering); "Lightning Piggy" narrows to piggy-client treasures.
  const sourceOptions = useMemo(() => [
    { value: false, label: t('filters.sourceTreasures', 'Treasures'), icon: ChestIcon },
    { value: true, label: t('filters.sourcePiggy', 'Lightning Piggy'), icon: PiggyBank },
  ], [t]);

  // Status options as independent toggles
  const statusOptions = useMemo(() => [
    { checked: showActive, onChange: onShowActiveChange, label: t('filters.statusActive', 'Active'), icon: CheckCircle2 },
    { checked: showMaintenance, onChange: onShowMaintenanceChange, label: t('filters.statusMaintenance', 'Needs maintenance'), icon: Wrench },
    { checked: showArchived, onChange: onShowArchivedChange, label: t('filters.statusArchived', 'Archived'), icon: Archive },
  ], [showActive, showMaintenance, showArchived, onShowActiveChange, onShowMaintenanceChange, onShowArchivedChange, t]);

  // Count active filters (status section counts as active when it differs from defaults:
  // default is showActive=true, showArchived=false, showMaintenance=false).
  const statusFilterActive = !showActive || showArchived || showMaintenance;
  const activeFilterCount = [
    difficulty !== undefined,
    terrain !== undefined,
    cacheType !== undefined,
    statusFilterActive,
    showPiggyOnly,
  ].filter(Boolean).length;

  // Clear all filters
  const clearAllFilters = () => {
    onDifficultyChange(undefined);
    onDifficultyOperatorChange("all");
    onTerrainChange(undefined);
    onTerrainOperatorChange("all");
    onCacheTypeChange(undefined);
    onShowActiveChange?.(true);
    onShowArchivedChange?.(false);
    onShowMaintenanceChange?.(false);
    onShowPiggyOnlyChange?.(false);
  };

  /** Renders a 1-5 chip row with an operator toggle that appears once a level is picked. */
  const renderLevelSection = (
    label: string,
    headerTooltip: string,
    value: number | undefined,
    operator: ComparisonOperator,
    levels: { level: number; name: string; icon: React.ElementType }[],
    onValueChange: (value: number | undefined) => void,
    onOperatorChange: (operator: ComparisonOperator) => void,
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between h-5">
        <SectionLabel label={label} tooltip={headerTooltip} />
        {value !== undefined && (
          <div className="flex gap-1">
            {operatorChoices.map((op) => (
              <FilterChip
                key={op}
                selected={operator === op}
                onClick={() => onOperatorChange(op)}
                className="h-5 px-2 rounded-md"
              >
                {operatorSymbols[op]}
              </FilterChip>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1">
        {levels.map(({ level, name, icon: IconComponent }) => (
          <FilterChip
            key={level}
            selected={value === level}
            tooltip={name}
            onClick={() => {
              if (value === level) {
                onValueChange(undefined);
                onOperatorChange("all");
              } else {
                onValueChange(level);
                if (operator === "all") onOperatorChange("eq");
              }
            }}
            className="flex-1 gap-1 px-1 h-8 text-sm"
          >
            <IconComponent className="h-4 w-4" />
            {level}
          </FilterChip>
        ))}
      </div>
    </div>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
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
      {/* Prevent the popover from auto-focusing the first tooltip trigger on
          open — a focused trigger opens its tooltip instantly, which made the
          Difficulty info tooltip flash every time the menu opened. */}
      <PopoverContent
        className="w-80"
        align="end"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Match the app-level tooltip timing (see TooltipProvider in App.tsx);
            local provider only exists so the component works standalone. */}
        <TooltipProvider>
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
            {/* Difficulty (1-5 chips + operator toggle) */}
            {renderLevelSection(
              t('filters.difficulty'),
              t('filters.difficultyTooltip', 'How tricky the treasure is to find or solve, from 1 (easy) to 5 (expert)'),
              difficulty,
              difficultyOperator,
              difficultyLevels,
              onDifficultyChange,
              onDifficultyOperatorChange,
            )}

            {/* Terrain (1-5 chips + operator toggle) */}
            {renderLevelSection(
              t('filters.terrain'),
              t('filters.terrainTooltip', 'How demanding the journey to the location is, from 1 (flat stroll) to 5 (serious effort)'),
              terrain,
              terrainOperator,
              terrainLevels,
              onTerrainChange,
              onTerrainOperatorChange,
            )}

            {/* Cache type (single-select chips; tap again to unset) */}
            <div className="space-y-1.5">
              <SectionLabel
                label={t('filters.cacheType')}
                tooltip={t('filters.cacheTypeTooltip', 'The style of hunt: classic hide, multi-stage, puzzle, or adventure')}
              />
              <div className="flex flex-wrap gap-1">
                {cacheTypeOptions.map((option) => {
                  const IconComponent = option.icon;
                  const selected = cacheType === option.value;
                  return (
                    <FilterChip
                      key={option.value}
                      selected={selected}
                      tooltip={option.tooltip}
                      onClick={() => onCacheTypeChange(selected ? undefined : option.value)}
                    >
                      <IconComponent className="h-3.5 w-3.5" />
                      {option.label}
                    </FilterChip>
                  );
                })}
              </div>
            </div>

            {/* Source (default "Treasures" = all listings; "Lightning Piggy" narrows) */}
            {onShowPiggyOnlyChange && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  {t('filters.source', 'Source')}
                </Label>
                <div className="flex flex-wrap gap-1">
                  {sourceOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <FilterChip
                        key={String(option.value)}
                        selected={showPiggyOnly === option.value}
                        onClick={() => onShowPiggyOnlyChange(option.value)}
                      >
                        <IconComponent className={cn("h-3.5 w-3.5", option.value && "text-pink-500")} />
                        {option.label}
                      </FilterChip>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status toggles (archived / maintenance listings are hidden by default) */}
            {(onShowActiveChange || onShowArchivedChange || onShowMaintenanceChange) && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  {t('filters.status', 'Listing status')}
                </Label>
                <div className="flex flex-wrap gap-1">
                  {statusOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <FilterChip
                        key={option.label}
                        selected={option.checked}
                        onClick={() => option.onChange?.(!option.checked)}
                      >
                        <IconComponent className="h-3.5 w-3.5" />
                        {option.label}
                      </FilterChip>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}
