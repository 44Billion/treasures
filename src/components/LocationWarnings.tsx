import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LocationVerification, getVerificationSummary } from "@/lib/osmVerification";
import { useState } from "react";

interface LocationWarningsProps {
  verification: LocationVerification;
  className?: string;
  hideCreatorWarnings?: boolean;
}

export function LocationWarnings({ verification, className, hideCreatorWarnings = false }: LocationWarningsProps) {
  const [showDetails, setShowDetails] = useState(false);
  const summary = getVerificationSummary(verification);
  
  // Categorize warnings for better display
  const categorizedWarnings = {
    critical: [] as string[],
    other: [] as string[]
  };

  verification.warnings.forEach(warning => {
    const lower = warning.toLowerCase();
    if (lower.includes('underwater')) {
      categorizedWarnings.critical.push(warning);
    } else if (lower.includes('inside') && (lower.includes('private') || lower.includes('building') || lower.includes('school') || lower.includes('military'))) {
      categorizedWarnings.critical.push(warning);
    } else {
      categorizedWarnings.other.push(warning);
    }
  });

  // Create location features (informational, not warnings)
  const locationFeatures: { label: string; type: string; }[] = [];
  const hindrances: { label: string; type: string; }[] = [];
  
  // Positive features
  if (verification.accessibility.wheelchair) {
    locationFeatures.push({ label: "Wheelchair accessible", type: "positive" });
  }
  if (verification.accessibility.parking) {
    locationFeatures.push({ label: "Parking available", type: "positive" });
  }
  if (verification.accessibility.publicTransport) {
    locationFeatures.push({ label: "Public transport", type: "positive" });
  }
  if (verification.terrain.lit) {
    locationFeatures.push({ label: "Well lit", type: "positive" });
  }
  
  // Neutral info
  if (verification.terrain.surface) {
    locationFeatures.push({ label: `${verification.terrain.surface} surface`, type: "neutral" });
  }
  
  // Heads up items (yellow - important to know but not impediments)
  if (verification.accessibility.fee) {
    hindrances.push({ label: "Entry fee required", type: "headsup" });
  }
  
  // Hindrances (yellow - things that might affect everyone negatively)
  if (verification.accessibility.wheelchair === false) {
    hindrances.push({ label: "Not wheelchair accessible", type: "hindrance" });
  }
  if (verification.terrain.lit === false) {
    hindrances.push({ label: "Not lit at night", type: "hindrance" });
  }
  if (verification.safety?.cellCoverage === false) {
    hindrances.push({ label: "Poor cell coverage", type: "hindrance" });
  }
  
  // Combine for display (show positives and neutrals first, then hindrances)
  const displayFeatures = [...locationFeatures, ...hindrances];
  
  // Add hazards to other warnings instead of features
  if (verification.terrain.hazards && verification.terrain.hazards.length > 0) {
    verification.terrain.hazards.forEach(hazard => {
      categorizedWarnings.other.push(`Safety hazard: ${hazard}`);
    });
  }

  // Add restricted hours as heads up item
  if (verification.accessibility.openingHours && verification.accessibility.openingHours !== '24/7') {
    hindrances.push({ label: `Hours: ${verification.accessibility.openingHours}`, type: "headsup" });
  }

  const StatusIcon = summary.status === 'safe' ? CheckCircle : 
                    summary.status === 'warning' ? AlertTriangle : XCircle;
  
  const statusColor = summary.status === 'safe' ? 'text-primary' : 
                     summary.status === 'warning' ? 'text-amber-600' : 'text-destructive';

  // Handle overflow features
  const maxDisplayFeatures = 3;
  const visibleFeatures = displayFeatures.slice(0, maxDisplayFeatures);
  const overflowFeatures = displayFeatures.slice(maxDisplayFeatures);
  
  // Add overflow features to other considerations
  if (overflowFeatures.length > 0) {
    overflowFeatures.forEach(feature => {
      categorizedWarnings.other.push(`Location feature: ${feature.label}`);
    });
  }

  const hasOtherWarnings = categorizedWarnings.other.length > 0;

  return (
    <div className={className}>
      <div className="space-y-2">
        {/* Key Location Features */}
        <div className="p-3 rounded-md border bg-muted/50">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-sm text-foreground">Location Features</div>
              {visibleFeatures.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-2">
                  {visibleFeatures.map((feature, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline"
                      className={`text-xs h-5 ${
                        feature.type === 'positive' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                        feature.type === 'headsup' ? 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' :
                        feature.type === 'hindrance' ? 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' :
                        'bg-muted text-foreground border' // neutral
                      }`}
                    >
                      {feature.label}
                    </Badge>
                  ))}
                  {overflowFeatures.length > 0 && (
                    <Badge variant="outline" className="text-xs h-5 bg-muted text-muted-foreground border">
                      +{overflowFeatures.length} more below
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">No specific features detected</div>
              )}
            </div>
          </div>
        </div>

        {/* Status Alert (only if there are actual warnings and not hiding creator warnings) */}
        {!hideCreatorWarnings && (summary.status === 'warning' || summary.status === 'restricted') && (
          <div className={`p-3 rounded-md border-2 ${
            summary.status === 'warning' 
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800' 
              : 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800'
          }`}>
            <div className="flex items-start gap-3">
              <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${statusColor}`} />
              <div className="flex-1">
                <div className="font-medium text-sm text-foreground mb-1">
                  {summary.status === 'restricted' ? 'Location Warning' : 'Location Notice'}
                </div>
                <div className="text-sm text-foreground">{summary.message}</div>
                {summary.status === 'restricted' && (
                  <div className="text-xs text-muted-foreground mt-2 italic">
                    You confirm that you have permission to place a cache at this location and that it complies with all local laws and regulations.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Critical Issues */}
        {categorizedWarnings.critical.length > 0 && (
          <div className="p-3 rounded-md border bg-red-50 dark:bg-red-950/20">
            <div className="flex items-start gap-3">
              <XCircle className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-sm text-foreground mb-1">Critical Issues</div>
                <div className="space-y-1">
                  {categorizedWarnings.critical.map((warning, idx) => (
                    <div key={idx} className="text-xs text-foreground">
                      {warning.replace(/⚠️\s*/, '')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Other Warnings */}
        {hasOtherWarnings && (
          <div className="border rounded-md overflow-hidden">
            <button
              className="w-full p-3 bg-muted/50 hover:bg-muted transition-colors text-left"
              onClick={() => setShowDetails(!showDetails)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-foreground">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-sm">
                    All location details ({categorizedWarnings.other.length})
                  </span>
                </div>
                {showDetails ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {showDetails && (
              <div className="p-3 bg-background border-t">
                <div className="space-y-1">
                  {categorizedWarnings.other.map((warning, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <span>{warning.replace(/⚠️\s*/, '').replace(/Area has restricted hours: /, 'Hours: ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}