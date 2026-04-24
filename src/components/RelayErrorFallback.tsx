import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw, Settings, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface RelayErrorFallbackProps {
  /** The error that occurred */
  error?: Error | null;
  /** Whether this is an empty state (no results) rather than an error */
  isEmpty?: boolean;
  /** Function to retry the operation */
  onRetry?: () => void;
  /** Whether a retry is currently in progress */
  isRetrying?: boolean;
  /** Custom title for the error state */
  title?: string;
  /** Custom description for the error state */
  description?: string;
  /** Additional CSS classes */
  className?: string;
  /** Compact layout for smaller spaces */
  compact?: boolean;
}

export function RelayErrorFallback({
  error,
  isEmpty = false,
  onRetry,
  isRetrying = false,
  title,
  description,
  className,
  compact = false,
}: RelayErrorFallbackProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isError = !isEmpty && !!error;
  
  const defaultTitle = isError 
    ? t('relayError.connectionFailed')
    : t('relayError.noTreasures');
    
  const defaultDescription = isError
    ? t('relayError.connectionDescription')
    : t('relayError.noTreasuresDescription');

  const finalTitle = title || defaultTitle;
  const finalDescription = description || defaultDescription;

  if (compact) {
    return (
      <div className={cn("text-center py-6 px-4", className)}>
        <div className="flex items-center justify-center mb-3">
          {isError ? (
            <AlertTriangle className="h-8 w-8 text-orange-500" />
          ) : (
            <Wifi className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        
        <h4 className="font-semibold text-foreground mb-2">{finalTitle}</h4>
        <p className="text-sm text-muted-foreground mb-4">{finalDescription}</p>
        
        {error && (
          <p className="text-xs text-red-600 mb-4 font-mono bg-red-50 dark:bg-red-950/20 p-2 rounded">
            {error.message}
          </p>
        )}
        
        <div className="flex gap-2 justify-center">
          {onRetry && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <><RefreshCw className="h-3 w-3 mr-2 animate-spin" />{t('common.retrying')}</>
              ) : (
                <><RefreshCw className="h-3 w-3 mr-2" />{t('common.retry')}</>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-3 w-3 mr-2" />
            {t('relayError.relaySettings')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            {isError ? (
              <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20">
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            ) : (
              <div className="p-3 rounded-full bg-muted">
                <Wifi className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <CardTitle className="text-lg">{finalTitle}</CardTitle>
          <CardDescription className="text-sm">
            {finalDescription}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                {error.message}
              </p>
            </div>
          )}
          
          <div className="flex gap-2">
            {onRetry && (
              <Button 
                variant="outline" 
                onClick={onRetry}
                disabled={isRetrying}
                className="flex-1"
              >
                {isRetrying ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('common.retrying')}</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />{t('common.retry')}</>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate('/settings')}
              className="flex-1"
            >
              <Settings className="h-4 w-4 mr-2" />
              {t('relayError.relaySettings')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
