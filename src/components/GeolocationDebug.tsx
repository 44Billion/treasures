import { useState } from "react";
import { MapPin, AlertCircle, CheckCircle, Loader2, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useGeolocation } from "@/hooks/useGeolocation";

export function GeolocationDebug() {
  const [showDebug, setShowDebug] = useState(false);
  const { loading, error, coords, getLocation } = useGeolocation();
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);

  const checkPermission = async () => {
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionState(result.state);
        
        result.addEventListener('change', () => {
          setPermissionState(result.state);
        });
      } catch (err) {
        console.error('Permission API error:', err);
      }
    }
  };

  const handleTest = () => {
    setShowDebug(true);
    checkPermission();
    getLocation();
  };

  if (!showDebug) {
    return (
      <Button variant="outline" size="sm" onClick={handleTest}>
        <MapPin className="h-4 w-4 mr-2" />
        Test Geolocation
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Geolocation Debug
          <Button variant="ghost" size="sm" onClick={() => setShowDebug(false)}>
            Close
          </Button>
        </CardTitle>
        <CardDescription>
          Testing your browser's geolocation capabilities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Browser Support */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Browser Support</span>
          {'geolocation' in navigator ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Supported
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Not Supported
            </Badge>
          )}
        </div>

        {/* Permission State */}
        {permissionState && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Permission</span>
            <Badge 
              variant={
                permissionState === 'granted' ? 'default' : 
                permissionState === 'denied' ? 'destructive' : 
                'secondary'
              }
              className="gap-1"
            >
              {permissionState === 'granted' && <CheckCircle className="h-3 w-3" />}
              {permissionState === 'denied' && <AlertCircle className="h-3 w-3" />}
              {permissionState === 'prompt' && <Info className="h-3 w-3" />}
              {permissionState}
            </Badge>
          </div>
        )}

        {/* HTTPS Check */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Secure Context (HTTPS)</span>
          {window.isSecureContext ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Secure
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Not Secure
            </Badge>
          )}
        </div>

        {/* Status */}
        <div className="pt-2 border-t">
          {loading && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Getting location...</AlertTitle>
              <AlertDescription>
                This may take up to 30 seconds. Make sure you're not in airplane mode.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {coords && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Location found!</AlertTitle>
              <AlertDescription className="space-y-1">
                <div>Latitude: {coords.latitude.toFixed(6)}</div>
                <div>Longitude: {coords.longitude.toFixed(6)}</div>
                <div>Accuracy: ±{Math.round(coords.accuracy)}m</div>
                {coords.altitude !== null && (
                  <div>Altitude: {Math.round(coords.altitude)}m</div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Retry Button */}
        <Button 
          onClick={getLocation} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 mr-2" />
              Try Again
            </>
          )}
        </Button>

        {/* Help Text */}
        {!window.isSecureContext && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>HTTPS Required</AlertTitle>
            <AlertDescription>
              Geolocation requires a secure connection (HTTPS). If you're developing locally, 
              use localhost or 127.0.0.1 instead of your machine's IP address.
            </AlertDescription>
          </Alert>
        )}
        
        {error && error.includes("unavailable") && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Location Tips</AlertTitle>
            <AlertDescription>
              <p className="text-sm">For better accuracy:</p>
              <ul className="list-disc list-inside space-y-1 text-sm mt-1">
                <li>Enable Location Services in OS settings</li>
                <li>Turn on WiFi (helps with location)</li>
                <li>Try near a window for GPS signal</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {permissionState === 'denied' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Enable Location</AlertTitle>
            <AlertDescription className="text-sm">
              Click the lock icon in address bar → Location → Allow → Reload page
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}