import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Info, Smartphone, Settings, RefreshCw, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  isFirefoxAndroid, 
  isFirefoxMobile, 
  checkLocationPermissions, 
  getLocationTroubleshootingSteps 
} from "@/lib/firefoxAndroidGeolocation";

interface LocationTroubleshooterProps {
  onRetry?: () => void;
  className?: string;
}

export function LocationTroubleshooter({ onRetry, className }: LocationTroubleshooterProps) {
  const [permissionStatus, setPermissionStatus] = useState<{
    supported: boolean;
    permission: PermissionState | 'unknown';
    secureContext: boolean;
    recommendations: string[];
  } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkPermissions = async () => {
    setIsChecking(true);
    try {
      const status = await checkLocationPermissions();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const getBrowserInfo = () => {
    if (isFirefoxAndroid()) {
      return {
        name: "Firefox for Android",
        icon: "🦊📱",
        needsSpecialHandling: true,
        description: "Firefox on Android has specific location requirements"
      };
    } else if (isFirefoxMobile()) {
      return {
        name: "Firefox Mobile",
        icon: "🦊📱",
        needsSpecialHandling: true,
        description: "Firefox mobile may need additional setup"
      };
    } else {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('chrome')) {
        return {
          name: "Chrome",
          icon: "🌐",
          needsSpecialHandling: false,
          description: "Chrome generally has good location support"
        };
      } else if (userAgent.includes('safari')) {
        return {
          name: "Safari",
          icon: "🧭",
          needsSpecialHandling: false,
          description: "Safari has built-in location support"
        };
      } else {
        return {
          name: "Unknown Browser",
          icon: "🌐",
          needsSpecialHandling: false,
          description: "Your browser should support location services"
        };
      }
    }
  };

  const browserInfo = getBrowserInfo();
  const troubleshootingSteps = getLocationTroubleshootingSteps();

  const getPermissionBadge = () => {
    if (!permissionStatus) return null;
    
    switch (permissionStatus.permission) {
      case 'granted':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Denied</Badge>;
      case 'prompt':
        return <Badge variant="secondary" className="gap-1"><Info className="h-3 w-3" />Prompt</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Location Troubleshooter
          </CardTitle>
          <CardDescription>
            Diagnose and fix location access issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Browser Detection */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{browserInfo.icon}</span>
              <div>
                <div className="font-medium text-sm">{browserInfo.name}</div>
                <div className="text-xs text-gray-600">{browserInfo.description}</div>
              </div>
            </div>
            {browserInfo.needsSpecialHandling && (
              <Badge variant="secondary">Needs Setup</Badge>
            )}
          </div>

          {/* Permission Status */}
          {permissionStatus && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Browser Support</span>
                  {permissionStatus.supported ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Supported
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Not Supported
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Permission</span>
                  {getPermissionBadge()}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Secure Context</span>
                  {permissionStatus.secureContext ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      HTTPS
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Not Secure
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Fixes */}
          {permissionStatus?.recommendations && permissionStatus.recommendations.length > 0 && (
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertTitle>Setup Required</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  {permissionStatus.recommendations.slice(0, 2).map((rec, idx) => (
                    <div key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                  {permissionStatus.recommendations.length > 2 && (
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-sm text-blue-600 hover:underline mt-1"
                    >
                      {showAdvanced ? 'Show less' : `Show ${permissionStatus.recommendations.length - 2} more steps`}
                    </button>
                  )}
                </div>
                
                {showAdvanced && permissionStatus.recommendations.length > 2 && (
                  <div className="mt-2 space-y-1">
                    {permissionStatus.recommendations.slice(2).map((rec, idx) => (
                      <div key={idx + 2} className="text-sm flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Firefox Android Specific Help */}
          {isFirefoxAndroid() && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Firefox for Android Tips</AlertTitle>
              <AlertDescription>
                <div className="space-y-2 text-sm">
                  <p>Firefox on Android requires both browser and system permissions:</p>
                  <div className="space-y-1">
                    <div>1. <strong>Firefox:</strong> Menu → Settings → Site permissions → Location</div>
                    <div>2. <strong>Android:</strong> Settings → Apps → Firefox → Permissions → Location</div>
                    <div>3. <strong>System:</strong> Settings → Location → On</div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Consider using Chrome for better location performance on Android.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={checkPermissions}
              disabled={isChecking}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking...' : 'Recheck Status'}
            </Button>
            
            {onRetry && (
              <Button
                onClick={onRetry}
                className="flex-1"
              >
                Try Location Again
              </Button>
            )}
          </div>

          {/* Advanced Troubleshooting */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                Advanced Troubleshooting
                <Info className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-3">
              <div className="text-sm space-y-2">
                <div>
                  <strong>If location still doesn't work:</strong>
                </div>
                <ul className="space-y-1 text-gray-600">
                  <li>• Restart your browser</li>
                  <li>• Clear browser cache and cookies</li>
                  <li>• Try a different browser (Chrome recommended for Android)</li>
                  <li>• Check if location works on other websites</li>
                  <li>• Restart your device</li>
                </ul>
                
                {isFirefoxAndroid() && (
                  <div className="mt-3 p-2 bg-blue-50 rounded">
                    <div className="text-sm font-medium text-blue-800">Firefox Android Alternative</div>
                    <div className="text-xs text-blue-700 mt-1">
                      For best results on Android, consider using Chrome or another browser 
                      that has more reliable location support.
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* External Help Link */}
          <div className="pt-2 border-t">
            <a
              href="https://support.mozilla.org/en-US/kb/does-firefox-share-my-location-websites"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              Firefox Location Help
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}