import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationVerification, getVerificationSummary } from "@/lib/osmVerification";
import { useState } from "react";

interface LocationWarningsProps {
  verification: LocationVerification;
  className?: string;
}

export function LocationWarnings({ verification, className }: LocationWarningsProps) {
  const [showDetails, setShowDetails] = useState(false);
  const summary = getVerificationSummary(verification);
  
  // Categorize warnings for better display
  const categorizedWarnings = {
    critical: [] as string[],
    other: [] as string[]
  };

  verification.warnings.forEach(warning => {
    const lower = warning.toLowerCase();
    if (lower.includes('inside') && (lower.includes('private') || lower.includes('building') || lower.includes('school') || lower.includes('military'))) {
      categorizedWarnings.critical.push(warning);
    } else {
      categorizedWarnings.other.push(warning);
    }
  });

  // Create location features (informational, not warnings)
  const locationFeatures = [];
  const hindrances = [];
  
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
  if (verification.accessibility.fee) {
    locationFeatures.push({ label: "Entry fee required", type: "neutral" });
  }
  if (verification.terrain.surface) {
    locationFeatures.push({ label: `${verification.terrain.surface} surface`, type: "neutral" });
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

  const StatusIcon = summary.status === 'safe' ? CheckCircle : 
                    summary.status === 'warning' ? AlertTriangle : XCircle;
  
  const statusColor = summary.status === 'safe' ? 'text-green-600' : 
                     summary.status === 'warning' ? 'text-yellow-600' : 'text-red-600';

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
      {/* Key Location Features */}
      <div className="p-3 rounded-md border border-gray-200 bg-gray-50">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-gray-600" />
          <div>
            <div className="font-medium text-sm text-gray-800">Location Features</div>
            {visibleFeatures.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {visibleFeatures.map((feature, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline"
                    className={`text-xs h-5 ${
                      feature.type === 'positive' ? 'bg-green-50 text-green-700 border-green-200' :
                      feature.type === 'hindrance' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      'bg-gray-50 text-gray-700 border-gray-200' // neutral
                    }`}
                  >
                    {feature.label}
                  </Badge>
                ))}
                {overflowFeatures.length > 0 && (
                  <Badge variant="outline" className="text-xs h-5 bg-gray-50 text-gray-600 border-gray-200">
                    +{overflowFeatures.length} more below
                  </Badge>
                )}
              </div>
            )}
            {visibleFeatures.length === 0 && (
              <div className="text-sm text-gray-600 mt-1">No specific features detected</div>
            )}
          </div>
        </div>
      </div>

      {/* Status Alert (only if there are actual warnings) */}
      {(summary.status === 'warning' || summary.status === 'restricted') && (
        <div className={`p-3 rounded-md border border-gray-200 ${
          summary.status === 'warning' ? 'bg-yellow-50' : 'bg-red-50'
        }`}>
          <div className="flex items-start gap-2">
            <StatusIcon className={`h-4 w-4 mt-0.5 ${statusColor}`} />
            <div className="font-medium text-sm text-gray-800">{summary.message}</div>
          </div>
        </div>
      )}

      {/* Critical Issues */}
      {categorizedWarnings.critical.length > 0 && (
        <div className="p-3 rounded-md border border-gray-200 bg-red-50">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 mt-0.5 text-red-600" />
            <div>
              <div className="font-medium text-sm text-gray-800 mb-1">Critical Issues</div>
              <div className="space-y-1">
                {categorizedWarnings.critical.map((warning, idx) => (
                  <div key={idx} className="text-xs text-gray-700">
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
            className="w-full p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            onClick={() => setShowDetails(!showDetails)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700">
                <Info className="h-4 w-4" />
                <span className="font-medium text-sm">
                  All location details ({categorizedWarnings.other.length})
                </span>
              </div>
              {showDetails ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </button>
          {showDetails && (
            <div className="p-3 bg-white border-t">
              <div className="space-y-1">
                {categorizedWarnings.other.map((warning, idx) => (
                  <div key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>{warning.replace(/⚠️\s*/, '').replace(/Area has restricted hours: /, 'Hours: ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}