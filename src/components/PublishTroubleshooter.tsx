import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RelayStatusIndicator } from './RelayStatusIndicator';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useRelayHealth } from '@/shared/hooks/useRelayStatus';
import { AlertTriangle, CheckCircle, HelpCircle, RefreshCw, Wifi } from 'lucide-react';

interface PublishTroubleshooterProps {
  error?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function PublishTroubleshooter({ error, onRetry, isRetrying = false }: PublishTroubleshooterProps) {
  const { user } = useCurrentUser();
  const { health } = useRelayHealth();
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
          'Check your internet connection',
          'Try refreshing the page',
          'Wait a moment and try again - relays may be temporarily unavailable',
          'Check if other Nostr apps are working',
        ];
      
      case 'timeout':
        return [
          'Your internet connection may be slow',
          'Try again - the event may have been published successfully',
          'Check your network connection',
          'Try refreshing the page if the issue persists',
        ];
      
      case 'user_cancelled':
        return [
          'You cancelled the signing process',
          'Click the publish button again to retry',
          'Make sure to approve the signing request in your Nostr extension',
        ];
      
      case 'not_logged_in':
        return [
          'You need to log in with a Nostr account',
          'Click the login button to connect your account',
          'Make sure you have a Nostr extension installed',
        ];
      
      case 'no_signer':
        return [
          'Install a Nostr browser extension (like Alby, nos2x, or Flamingo)',
          'Make sure the extension is enabled',
          'Refresh the page after installing the extension',
          'Check that the extension has permission to access this site',
        ];
      
      case 'network':
        return [
          'Check your internet connection',
          'Try switching networks (WiFi to mobile data or vice versa)',
          'Disable VPN if you\'re using one',
          'Try again in a few minutes',
        ];
      
      default:
        return [
          'Try refreshing the page',
          'Check your internet connection',
          'Make sure your Nostr extension is working',
          'Try again in a few minutes',
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
          Publishing Issue Detected
        </CardTitle>
        <CardDescription>
          Let's help you get back to publishing your content.
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
          <h4 className="font-medium">Quick Checks:</h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Logged in</span>
              <Badge variant={user ? 'default' : 'destructive'} className="gap-1">
                {user ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {user ? 'Yes' : 'No'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Signer available</span>
              <Badge variant={user?.signer ? 'default' : 'destructive'} className="gap-1">
                {user?.signer ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {user?.signer ? 'Yes' : 'No'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Relay connection</span>
              <RelayStatusIndicator compact />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Troubleshooting Steps:</h4>
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
              Try Again
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Info
          </Button>
        </div>

        {showAdvanced && (
          <div className="space-y-3 pt-3 border-t">
            <RelayStatusIndicator showDetails />
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>User Agent:</strong> {navigator.userAgent}</p>
              <p><strong>Online:</strong> {navigator.onLine ? 'Yes' : 'No'}</p>
              <p><strong>Connection:</strong> {(navigator as any).connection?.effectiveType || 'Unknown'}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}