import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ComparisonOperator = "all" | "eq" | "gt" | "gte" | "lt" | "lte";

export interface SlimComparisonFilterProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  operator: ComparisonOperator;
  onOperatorChange: (operator: ComparisonOperator) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  compact?: boolean;
}

const operatorDisplayMap: Record<ComparisonOperator, { symbol: string; color: string; text: string }> = {
  all: { symbol: "All", color: "blue", text: "All" },
  eq: { symbol: "=", color: "green", text: "exactly" },
  gte: { symbol: "≥", color: "orange", text: "at least" },
  lte: { symbol: "≤", color: "purple", text: "at most" },
  gt: { symbol: ">", color: "red", text: "over" },
  lt: { symbol: "<", color: "indigo", text: "under" },
};

export function SlimComparisonFilter({
  label,
  value,
  onValueChange,
  operator,
  onOperatorChange,
  options,
  className,
  compact = false,
}: SlimComparisonFilterProps) {
  const isAllSelected = operator === "all";
  const selectedOption = options.find(opt => opt.value === value);
  const operatorDisplay = operatorDisplayMap[operator];
  
  // Create a combined display string
  const getDisplayText = () => {
    if (isAllSelected) return `All ${label.toLowerCase()}s`;
    if (!selectedOption) return `Select ${label.toLowerCase()}`;
    
    const rating = compact ? selectedOption.label.split(' - ')[0] : selectedOption.label;
    return `${operatorDisplay.text} ${rating}`;
  };
  
  return (
    <div className={cn("space-y-1.5", className)}>
      {!compact && (
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </label>
      )}
      
      <Select 
        value={`${operator}:${value || "1"}`}
        onValueChange={(combined) => {
          const [newOperator, newValue] = combined.split(':') as [ComparisonOperator, string];
          onOperatorChange(newOperator);
          if (newOperator !== 'all') {
            onValueChange(newValue);
          }
        }}
      >
        <SelectTrigger className="h-9">
          <div className="flex items-center gap-2 w-full">
            <Badge 
              variant="secondary"
              className={cn(
                "text-xs font-medium shrink-0",
                operatorDisplay.color === "blue" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                operatorDisplay.color === "green" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                operatorDisplay.color === "orange" && "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
                operatorDisplay.color === "purple" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                operatorDisplay.color === "red" && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                operatorDisplay.color === "indigo" && "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
              )}
            >
              {operatorDisplay.symbol}
            </Badge>
            <span className="text-sm truncate">{getDisplayText()}</span>
          </div>
        </SelectTrigger>
        
        <SelectContent>
          {/* All option */}
          <SelectItem value="all:1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">
                All
              </Badge>
              <span>Show all {label.toLowerCase()}s</span>
            </div>
          </SelectItem>
          
          {/* Comparison options */}
          {options.map((option) => (
            <React.Fragment key={option.value}>
              <SelectItem value={`eq:${option.value}`}>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                    =
                  </Badge>
                  <span>Exactly {option.label.toLowerCase()}</span>
                </div>
              </SelectItem>
              <SelectItem value={`gte:${option.value}`}>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs">
                    ≥
                  </Badge>
                  <span>At least {option.label.toLowerCase()}</span>
                </div>
              </SelectItem>
              <SelectItem value={`lte:${option.value}`}>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-xs">
                    ≤
                  </Badge>
                  <span>At most {option.label.toLowerCase()}</span>
                </div>
              </SelectItem>
            </React.Fragment>
          ))}
        </SelectContent>
      </Select>
      
      {/* Subtle helper text */}
      {!compact && (
        <div className="text-xs text-muted-foreground">
          {isAllSelected ? 
            "No filtering applied" : 
            `Filtering by ${label.toLowerCase()}`
          }
        </div>
      )}
    </div>
  );
}