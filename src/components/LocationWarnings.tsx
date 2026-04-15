import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LocationVerification, getVerificationSummary } from "@/utils/osmVerification";

interface LocationWarningsProps {
  verification: LocationVerification;
  className?: string;
  /** Hide the status summary line (useful when the parent already provides context) */
  hideCreatorWarnings?: boolean;
}

export function LocationWarnings({ verification, className, hideCreatorWarnings = false }: LocationWarningsProps) {
  const { t } = useTranslation();
  const summary = getVerificationSummary(verification);
  const hasWarnings = summary.status === 'warning' || summary.status === 'restricted';

  // Build flat list of all warnings (cleaned up)
  const allWarnings = verification.warnings.map(w => w.replace(/⚠️\s*/, ''));

  // Build feature badges
  const features: { label: string; type: 'positive' | 'neutral' | 'hindrance' }[] = [];

  if (verification.accessibility.wheelchair) {
    features.push({ label: t('locationInfo.features.wheelchairAccessible'), type: 'positive' });
  }
  if (verification.accessibility.parking) {
    features.push({ label: t('locationInfo.features.parkingAvailable'), type: 'positive' });
  }
  if (verification.accessibility.publicTransport) {
    features.push({ label: t('locationInfo.features.publicTransport'), type: 'positive' });
  }
  if (verification.terrain.lit) {
    features.push({ label: t('locationInfo.features.wellLit'), type: 'positive' });
  }
  if (verification.terrain.surface) {
    features.push({ label: t('locationInfo.features.surface', { surface: verification.terrain.surface }), type: 'neutral' });
  }
  if (verification.accessibility.fee) {
    features.push({ label: t('locationInfo.features.entryFeeRequired'), type: 'hindrance' });
  }
  if (verification.accessibility.wheelchair === false) {
    features.push({ label: t('locationInfo.features.notWheelchairAccessible'), type: 'hindrance' });
  }
  if (verification.terrain.lit === false) {
    features.push({ label: t('locationInfo.features.notLitAtNight'), type: 'hindrance' });
  }
  if (verification.safety?.cellCoverage === false) {
    features.push({ label: t('locationInfo.features.poorCellCoverage'), type: 'hindrance' });
  }
  if (verification.accessibility.openingHours && verification.accessibility.openingHours !== '24/7') {
    features.push({ label: t('locationInfo.features.hours', { hours: verification.accessibility.openingHours }), type: 'hindrance' });
  }
  if (verification.terrain.hazards && verification.terrain.hazards.length > 0) {
    verification.terrain.hazards.forEach(hazard => {
      features.push({ label: t('locationInfo.features.safetyHazard', { hazard }), type: 'hindrance' });
    });
  }

  const hasContent = allWarnings.length > 0 || features.length > 0;
  if (!hasContent) return null;

  return (
    <div className={className}>
      <div className="space-y-2">
        {/* Status line */}
        {!hideCreatorWarnings && (
          <div className="flex items-center gap-2">
            {hasWarnings ? (
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            )}
            <span className={`text-sm font-medium ${hasWarnings ? 'text-yellow-800 dark:text-yellow-300' : 'text-green-800 dark:text-green-300'}`}>
              {summary.status === 'restricted' ? t('locationInfo.locationWarning') : summary.status === 'warning' ? t('locationInfo.locationNotice') : t('locationInfo.locationClear')}
            </span>
          </div>
        )}

        {/* Warning list — flat bullets */}
        {allWarnings.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-1">
            {allWarnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Feature badges — inline */}
        {features.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {features.map((feature, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className={`text-xs h-5 ${
                  feature.type === 'positive' ? 'bg-primary-50 dark:bg-primary-50 text-primary dark:text-primary border-primary-200 dark:border-primary-100' :
                  feature.type === 'hindrance' ? 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' :
                  'bg-muted text-foreground border'
                }`}
              >
                {feature.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
