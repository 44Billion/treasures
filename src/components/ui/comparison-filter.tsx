
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ComparisonOperator = "all" | "eq" | "gt" | "gte" | "lt" | "lte";

export interface ComparisonFilterProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  operator: ComparisonOperator;
  onOperatorChange: (operator: ComparisonOperator) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  compact?: boolean;
}

const operatorSymbols: Record<ComparisonOperator, string> = {
  all: "All",
  eq: "=",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

export function ComparisonFilter({
  label,
  value,
  onValueChange,
  operator,
  onOperatorChange,
  options,
  className,
  compact = false,
}: ComparisonFilterProps) {
  const { t } = useTranslation();
  const hasSpecificValue = value && value !== "" && value !== "all";
  const selectedOption = options.find(opt => opt.value === value);
  
  // When a specific value is selected, default to "eq" operator
  const handleValueChange = (newValue: string) => {
    onValueChange(newValue);
    if (newValue === "all") {
      onOperatorChange("all");
    } else if (newValue && operator === "all") {
      onOperatorChange("eq");
    }
  };
  
  return (
    <div className={cn("space-y-1", className)}>
      {!compact && (
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      
      <div className="flex">
        {/* Square operator button - only show when specific value is selected */}
        {hasSpecificValue && (
          <Select value={operator} onValueChange={onOperatorChange}>
            <SelectTrigger className="w-10 h-9 rounded-r-none border-r-0 px-0 justify-center [&>svg]:hidden focus:ring-0 focus:ring-offset-0">
              <span className="text-sm font-medium">
                {operatorSymbols[operator]}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eq">=</SelectItem>
              <SelectItem value="gte">≥</SelectItem>
              <SelectItem value="lte">≤</SelectItem>
            </SelectContent>
          </Select>
        )}
        
        {/* Value selector */}
        <Select value={value || "all"} onValueChange={handleValueChange}>
          <SelectTrigger className={cn(
            "h-9 flex-1 [&>svg]:hidden focus:ring-0 focus:ring-offset-0",
            hasSpecificValue ? "rounded-l-none" : "rounded"
          )}>
            <SelectValue>
              {value === "all" || !value ? (
                compact ? label : t('filters.all')
              ) : selectedOption ? (
                selectedOption.label
              ) : `Select ${label.toLowerCase()}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('filters.all')}
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}