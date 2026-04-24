import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RelayStatusIndicator } from './RelayStatusIndicator';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRelayHealth } from '@/hooks/useRelayStatus';
import { AlertTriangle, CheckCircle, HelpCircle, RefreshCw, Wifi } from 'lucide-react';

interface PublishTroubleshooterProps {
  error?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function PublishTroubleshooter({ error, onRetry, isRetrying = false }: PublishTroubleshooterProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  useRelayHealth();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getErrorType = (errorMessage?: string) => {
    if (!errorMessage) return 'unknown';
    
    if (errorMessage.includes('All relay connections failed') || 
        errorMessage.includes('no promise in promise.any resolved')) {
      return 'relay_connection';
    }
    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('User rejected') || errorMessage.includes('cancelled')) return 'user_cancelled';
    if (errorMessage.includes('not logged in')) return 'not_logged_in';
    if (errorMessage.includes('No signer')) return 'no_signer';
    if (errorMessage.includes('network') || errorMessage.includes('WebSocket')) return 'network';
    
    return 'unknown';
  };

  const errorType = getErrorType(error);

  const getTroubleshootingSteps = () => {
    switch (errorType) {
      case 'relay_connection':
        return [
          t('troubleshooter.step.checkInternet'),
          t('troubleshooter.step.refreshPage'),
          t('troubleshooter.step.relaysUnavailable'),
          t('troubleshooter.step.checkOtherApps'),
        ];
      
      case 'timeout':
        return [
          t('troubleshooter.step.slowConnection'),
          t('troubleshooter.step.mayHavePublished'),
          t('troubleshooter.step.checkNetwork'),
          t('troubleshooter.step.refreshPersists'),
        ];
      
      case 'user_cancelled':
        return [
          t('troubleshooter.step.cancelled'),
          t('troubleshooter.step.clickRetry'),
          t('troubleshooter.step.approveSign'),
        ];
      
      case 'not_logged_in':
        return [
          t('troubleshooter.step.needLogin'),
          t('troubleshooter.step.clickLogin'),
          t('troubleshooter.step.installExtension'),
        ];
      
      case 'no_signer':
        return [
          t('troubleshooter.step.installNostrExt'),
          t('troubleshooter.step.enableExtension'),
          t('troubleshooter.step.refreshAfterInstall'),
          t('troubleshooter.step.checkPermission'),
        ];
      
      case 'network':
        return [
          t('troubleshooter.step.checkInternet'),
          t('troubleshooter.step.switchNetworks'),
          t('troubleshooter.step.disableVPN'),
          t('troubleshooter.step.tryLater'),
        ];
      
      default:
        return [
          t('troubleshooter.step.refreshPage'),
          t('troubleshooter.step.checkInternet'),
          t('troubleshooter.step.checkExtension'),
          t('troubleshooter.step.tryLater'),
        ];
    }
  };

  const getErrorIcon = () => {
    switch (errorType) {
      case 'user_cancelled':
        return <HelpCircle className="h-4 w-4" />;
      case 'not_logged_in':
      case 'no_signer':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Wifi className="h-4 w-4" />;
    }
  };

  const getErrorSeverity = () => {
    switch (errorType) {
      case 'user_cancelled':
        return 'default';
      case 'not_logged_in':
      case 'no_signer':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getErrorIcon()}
          {t('troubleshooter.title')}
        </CardTitle>
        <CardDescription>
          {t('troubleshooter.description')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant={getErrorSeverity() === 'destructive' ? 'destructive' : 'default'}>
            <AlertDescription className="font-mono text-xs">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <h4 className="font-medium">{t('troubleshooter.quickChecks')}</h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('troubleshooter.loggedIn')}</span>
              <Badge variant={user ? 'default' : 'destructive'} className="gap-1">
                {user ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {user ? t('common.yes') : t('common.no')}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('troubleshooter.signerAvailable')}</span>
              <Badge variant={user?.signer ? 'default' : 'destructive'} className="gap-1">
                {user?.signer ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {user?.signer ? t('common.yes') : t('common.no')}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('troubleshooter.relayConnection')}</span>
              <RelayStatusIndicator compact />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">{t('troubleshooter.steps')}</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            {getTroubleshootingSteps().map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} disabled={isRetrying} className="gap-2">
              {isRetrying ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('troubleshooter.tryAgain')}
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? t('troubleshooter.hideAdvanced') : t('troubleshooter.showAdvanced')} {t('troubleshooter.advancedInfo')}
          </Button>
        </div>

        {showAdvanced && (
          <div className="space-y-3 pt-3 border-t">
            <RelayStatusIndicator showDetails />
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>User Agent:</strong> {navigator.userAgent}</p>
              <p><strong>{t('troubleshooter.online')}:</strong> {navigator.onLine ? t('common.yes') : t('common.no')}</p>
              <p><strong>{t('troubleshooter.connection')}:</strong> {(navigator as any).connection?.effectiveType || t('troubleshooter.unknown')}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}