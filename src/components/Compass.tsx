import { useState, useEffect, useRef } from "react";
import { Navigation } from "lucide-react";

interface CompassProps {
  targetLat: number;
  targetLng: number;
  className?: string;
}

export function Compass({ targetLat, targetLng, className }: CompassProps) {
  const [heading, setHeading] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [lastOrientationEvent, setLastOrientationEvent] = useState<any>(null);
  const [lastMotionEvent, setLastMotionEvent] = useState<any>(null);
  const [sensorStatus, setSensorStatus] = useState<string>('checking');
  const manualModeRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  // Calculate bearing from user location to target
  const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  };

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 9)]); // Keep last 10 logs
  };

  const bearing = userLocation ? calculateBearing(userLocation.lat, userLocation.lng, targetLat, targetLng) : null;
  const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, targetLat, targetLng) : null;
  const compassRotation = heading !== null && bearing !== null ? bearing - heading : 0;

  useEffect(() => {
    let orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
    let geolocationWatchId: number | null = null;

    const requestPermissions = async () => {
      try {
        addDebugLog('=== Starting Permission Request ===');
        addDebugLog(`User Agent: ${navigator.userAgent}`);
        addDebugLog(`HTTPS: ${location.protocol === 'https:'}`);
        addDebugLog(`DeviceOrientationEvent: ${!!window.DeviceOrientationEvent}`);
        
        // Check if DeviceOrientationEvent is supported
        if (!window.DeviceOrientationEvent) {
          setPermission('unsupported');
          setError('Device orientation not supported');
          addDebugLog('ERROR: DeviceOrientationEvent not supported');
          return;
        }

        // Check if we're on HTTPS (required for device orientation on most browsers)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
          addDebugLog('WARNING: Not on HTTPS - device orientation may not work');
          setError('HTTPS required for compass on this device. Please use a secure connection.');
        }

        // For iOS 13+ devices, we need to request permission
        const hasRequestPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function';
        addDebugLog(`iOS requestPermission available: ${hasRequestPermission}`);
        
        if (hasRequestPermission) {
          addDebugLog('Requesting iOS orientation permission...');
          const orientationPermission = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
          addDebugLog(`iOS permission result: ${orientationPermission}`);
          if (orientationPermission !== 'granted') {
            setPermission('denied');
            setError('Device orientation permission denied');
            return;
          }
        }

        // For Android, try to directly access orientation without permission checks
        // since Android Chrome doesn't have requestPermission for orientation
        if (navigator.userAgent.includes('Android')) {
          addDebugLog('Android detected - attempting direct sensor access');
          
          // Try to immediately start listening for orientation events
          // Android Chrome should just work if sensors are available
          const androidTestHandler = (event: DeviceOrientationEvent) => {
            if (event.alpha !== null) {
              addDebugLog('Android orientation working - sensors are available');
              setPermission('granted');
            }
          };
          
          window.addEventListener('deviceorientation', androidTestHandler, { once: true });
          window.addEventListener('deviceorientationabsolute', androidTestHandler, { once: true });
          
          // Clean up the test handler after a short time
          setTimeout(() => {
            window.removeEventListener('deviceorientation', androidTestHandler);
            window.removeEventListener('deviceorientationabsolute', androidTestHandler);
          }, 2000);
        }

        // For other browsers, check if permissions API is available
        if ('permissions' in navigator && !navigator.userAgent.includes('Android')) {
          try {
            addDebugLog('Checking permissions API...');
            const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            addDebugLog(`Geolocation permission: ${result.state}`);
          } catch (e) {
            addDebugLog(`Permissions API error: ${e}`);
          }
        }

        // Get user location
        if (!navigator.geolocation) {
          setError('Geolocation not supported');
          return;
        }

        // First try to get current position quickly
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setPermission('granted');
            
            // Then start watching for updates with more frequent updates
            geolocationWatchId = navigator.geolocation.watchPosition(
              (position) => {
                setUserLocation({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                });
                addDebugLog(`Location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
              },
              (error) => {
                console.warn('Watch position error:', error);
                // Don't set error state here, we already have a position
              },
              { 
                enableHighAccuracy: true, 
                timeout: 10000, 
                maximumAge: 5000 // Update more frequently - 5 seconds max age
              }
            );
          },
          (error) => {
            console.error('Geolocation error:', error);
            setError(`Location access required. Error: ${error.message}`);
            setPermission('denied');
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );

        // Watch for orientation changes with comprehensive debugging
        orientationHandler = (event: DeviceOrientationEvent) => {
          const eventData = {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
            absolute: event.absolute,
            webkitCompassHeading: (event as any).webkitCompassHeading
          };
          
          setLastOrientationEvent(eventData);
          addDebugLog(`Orientation: α=${event.alpha?.toFixed(1)} β=${event.beta?.toFixed(1)} γ=${event.gamma?.toFixed(1)} abs=${event.absolute}`);

          if (event.alpha !== null) {
            let alpha = event.alpha;
            const webkitEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
            
            // For iOS, prefer webkitCompassHeading if available
            if (webkitEvent.webkitCompassHeading !== undefined) {
              alpha = webkitEvent.webkitCompassHeading;
              addDebugLog(`Using iOS webkitCompassHeading: ${alpha.toFixed(1)}°`);
            } else {
              addDebugLog(`Using standard alpha: ${alpha.toFixed(1)}°`);
            }
            
            // Ensure alpha is in 0-360 range
            alpha = ((alpha % 360) + 360) % 360;
            
            // Only update if not in manual mode
            if (!manualModeRef.current) {
              setHeading(alpha);
              addDebugLog(`Heading updated to: ${alpha.toFixed(1)}°`);
            } else {
              addDebugLog('Manual mode active, ignoring update');
            }
          } else {
            addDebugLog('Alpha is null - no orientation data');
          }
        };

        addDebugLog('Adding orientation event listeners...');
        
        // Try multiple event types for maximum compatibility
        window.addEventListener('deviceorientation', orientationHandler, true);
        window.addEventListener('deviceorientationabsolute', orientationHandler, true);
        
        // Also try without capture flag
        window.addEventListener('deviceorientation', orientationHandler, false);
        
        // For Android, also try the absolute event specifically and add motion events
        if (navigator.userAgent.includes('Android')) {
          addDebugLog('Android detected - adding additional listeners');
          window.addEventListener('deviceorientationabsolute', orientationHandler, false);
          
          // Also try to listen for device motion to "wake up" sensors
          const motionHandler = (event: DeviceMotionEvent) => {
            const motionData = {
              acceleration: event.acceleration,
              accelerationIncludingGravity: event.accelerationIncludingGravity,
              rotationRate: event.rotationRate,
              interval: event.interval
            };
            setLastMotionEvent(motionData);
            addDebugLog(`Motion detected: acc=${event.acceleration?.x?.toFixed(2)}, ${event.acceleration?.y?.toFixed(2)}, ${event.acceleration?.z?.toFixed(2)}`);
            setSensorStatus('motion-working');
          };
          
          window.addEventListener('devicemotion', motionHandler, false);
          
          // Clean up motion handler after a few seconds
          setTimeout(() => {
            window.removeEventListener('devicemotion', motionHandler);
            if (sensorStatus === 'checking') {
              setSensorStatus('no-motion');
              addDebugLog('No motion events detected - Chrome flags likely disabled');
              addDebugLog('Enable chrome://flags/#enable-generic-sensor and restart Chrome');
            }
          }, 5000);
        }
        
        // Test if events are supported
        setTimeout(() => {
          addDebugLog('=== Support Test ===');
          addDebugLog(`DeviceOrientationEvent: ${!!window.DeviceOrientationEvent}`);
          addDebugLog(`requestPermission: ${!!(window.DeviceOrientationEvent as any)?.requestPermission}`);
          addDebugLog(`Screen orientation: ${screen.orientation?.angle || 'unknown'}`);
          
          // Try to trigger a manual test
          if (window.DeviceOrientationEvent) {
            try {
              const testEvent = new DeviceOrientationEvent('deviceorientation', {
                alpha: 45,
                beta: 0,
                gamma: 0,
                absolute: true
              });
              addDebugLog('Test event creation: SUCCESS');
            } catch (e) {
              addDebugLog(`Test event creation: FAILED - ${e}`);
            }
          }
          
          // Check if we're getting any orientation data
          if (lastOrientationEvent === null) {
            addDebugLog('WARNING: No orientation events received after 1 second');
            addDebugLog('This may indicate permission issues or unsupported device');
            
            // For Android, provide specific troubleshooting
            if (navigator.userAgent.includes('Android')) {
              addDebugLog('Android troubleshooting:');
              addDebugLog('- Check chrome://flags/#enable-generic-sensor-extra-classes');
              addDebugLog('- Check chrome://flags/#enable-generic-sensor');
              addDebugLog('- Ensure HTTPS connection');
              addDebugLog('- Try moving the device to trigger sensors');
            }
          }
        }, 1000);
        
        // Set a fallback timeout for orientation
        setTimeout(() => {
          setHeading(prevHeading => {
            if (prevHeading === null) {
              addDebugLog('No orientation data after 5s, checking for manual intervention needed');
              
              // On Android, provide specific guidance
              if (navigator.userAgent.includes('Android')) {
                addDebugLog('Android device - no orientation data received');
                addDebugLog('Common causes: Chrome flags disabled, no motion sensors, HTTPS required');
                setError('Android compass not working. Required steps:\n1. Enable chrome://flags/#enable-generic-sensor\n2. Enable chrome://flags/#enable-generic-sensor-extra-classes\n3. Restart Chrome\n4. Ensure HTTPS connection\n5. Try moving device while testing');
              } else {
                addDebugLog('Using fallback heading (North)');
                return 0; // Set to north as fallback
              }
            }
            return prevHeading;
          });
        }, 5000);

      } catch (error) {
        console.error('Error requesting permissions:', error);
        setPermission('denied');
        setError('Failed to access device sensors');
      }
    };

    requestPermissions();

    return () => {
      if (orientationHandler) {
        window.removeEventListener('deviceorientation', orientationHandler, true);
        window.removeEventListener('deviceorientationabsolute', orientationHandler, true);
        window.removeEventListener('deviceorientation', orientationHandler, false);
      }
      if (geolocationWatchId) {
        navigator.geolocation.clearWatch(geolocationWatchId);
      }
    };
  }, []);

  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    } else if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)}km`;
    } else {
      return `${Math.round(distanceKm)}km`;
    }
  };

  const requestPermission = async () => {
    try {
      addDebugLog('Manual permission request triggered');
      
      if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
        const permission = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        addDebugLog(`Permission result: ${permission}`);
        if (permission === 'granted') {
          window.location.reload(); // Reload to reinitialize
        } else {
          setError('Permission denied');
        }
      } else {
        // For Android and other devices, try to re-initialize sensors
        addDebugLog('No requestPermission available, trying to re-initialize...');
        
        // Clear current state
        setHeading(null);
        setError(null);
        
        // Try to trigger a device motion event to "wake up" sensors on Android
        if (navigator.userAgent.includes('Android')) {
          addDebugLog('Attempting to activate Android sensors...');
          
          // Request device motion permission if available
          if ('DeviceMotionEvent' in window && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            try {
              const motionPermission = await (DeviceMotionEvent as any).requestPermission();
              addDebugLog(`Motion permission: ${motionPermission}`);
            } catch (e) {
              addDebugLog(`Motion permission error: ${e}`);
            }
          }
          
          // Force a page reload to reinitialize everything
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          // For other devices, just reload
          window.location.reload();
        }
      }
    } catch (error) {
      addDebugLog(`Permission request error: ${error}`);
      setError('Failed to request permission');
    }
  };

  const enableSensors = async () => {
    addDebugLog('Enable sensors button clicked');
    
    // For Android, we need to directly try to access the sensors
    // without relying on permission APIs that don't exist
    try {
      // Clear any existing error state
      setError(null);
      setPermission('prompt');
      
      // Force re-initialization of orientation listeners
      addDebugLog('Attempting to re-initialize orientation listeners...');
      
      // Create a new orientation handler
      const testOrientationHandler = (event: DeviceOrientationEvent) => {
        addDebugLog(`Test orientation event: α=${event.alpha} β=${event.beta} γ=${event.gamma}`);
        
        if (event.alpha !== null) {
          addDebugLog('SUCCESS: Orientation data received!');
          setHeading(event.alpha);
          setPermission('granted');
          
          // Remove the test handler
          window.removeEventListener('deviceorientation', testOrientationHandler);
          
          // Trigger a full re-initialization
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      };
      
      // Add the test listener
      window.addEventListener('deviceorientation', testOrientationHandler);
      
      // Also try the absolute version
      window.addEventListener('deviceorientationabsolute', testOrientationHandler);
      
      // Set a timeout to check if we got data
      setTimeout(() => {
        window.removeEventListener('deviceorientation', testOrientationHandler);
        window.removeEventListener('deviceorientationabsolute', testOrientationHandler);
        
        if (heading === null) {
          addDebugLog('No orientation data after manual attempt');
          setError('Device orientation not available. This may be due to:\n• Browser security settings\n• Device not having a compass sensor\n• Need to enable motion sensors in browser settings');
        }
      }, 3000);
      
    } catch (error) {
      addDebugLog(`Enable sensors error: ${error}`);
      setError('Failed to access device sensors');
    }
  };

  if (permission === 'unsupported') {
    return (
      <div className={`text-center p-4 ${className}`}>
        <div className="text-gray-500 text-sm">
          Compass not supported on this device
        </div>
      </div>
    );
  }

  if (permission === 'denied' || error) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <div className="text-gray-500 text-sm mb-2">
          {error || 'Compass requires location and orientation access'}
        </div>
        <div className="space-y-2">
          {typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function' ? (
            <button
              onClick={requestPermission}
              className="block mx-auto text-blue-600 text-sm underline"
            >
              Enable Compass
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={enableSensors}
                className="block mx-auto text-blue-600 text-sm underline"
              >
                Test Sensors
              </button>
              {navigator.userAgent.includes('Android') && (
                <div className="text-xs text-gray-600 mt-2 space-y-1">
                  <div className="font-medium">Android Chrome Setup Required:</div>
                  <div>1. Go to chrome://flags/#enable-generic-sensor</div>
                  <div>2. Set to "Enabled"</div>
                  <div>3. Go to chrome://flags/#enable-generic-sensor-extra-classes</div>
                  <div>4. Set to "Enabled"</div>
                  <div>5. Restart Chrome completely</div>
                  <div>6. Ensure HTTPS connection</div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => {
              // Use a default location for testing (San Francisco)
              setUserLocation({ lat: 37.7749, lng: -122.4194 });
              setHeading(0);
              setPermission('granted');
              setError(null);
            }}
            className="block mx-auto text-blue-600 text-sm underline"
          >
            Use Test Location
          </button>
        </div>
      </div>
    );
  }

  if (!userLocation || heading === null) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-2"></div>
          <div className="text-gray-500 text-sm">
            {!userLocation ? 'Getting your location...' : 'Waiting for compass...'}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {!userLocation ? 'Please allow location access' : 'Detecting device orientation'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`text-center p-4 ${className}`}>
      <div className="relative w-20 h-20 mx-auto mb-3">
        {/* Compass background */}
        <div className="absolute inset-0 border-2 border-gray-300 rounded-full bg-white">
          {/* Cardinal directions */}
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-xs font-bold text-red-600">N</div>
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">S</div>
          <div className="absolute right-1 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">E</div>
          <div className="absolute left-1 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">W</div>
        </div>
        
        {/* Compass needle pointing to cache */}
        <div 
          className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out"
          style={{ transform: `rotate(${compassRotation}deg)` }}
        >
          <Navigation 
            className="w-8 h-8 text-green-600 drop-shadow-sm" 
            style={{ transform: 'rotate(-45deg)' }} // Adjust for icon orientation
          />
        </div>
        
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-gray-800 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
      </div>
      
      <div className="text-sm">
        <div className="font-medium text-gray-800">
          {distance && formatDistance(distance)}
        </div>
        <div className="text-gray-500 text-xs">
          {bearing && `${Math.round(bearing)}°`}
        </div>
        <div className="text-gray-400 text-xs mt-1">
          Heading: {heading !== null ? `${Math.round(heading)}°` : 'N/A'}
        </div>
        <div className="text-gray-400 text-xs">
          Rotation: {Math.round(compassRotation)}°
        </div>
        
        {/* Manual controls */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              const newHeading = (heading || 0) + 45;
              setHeading(newHeading % 360);
              setManualMode(true);
              manualModeRef.current = true;
              addDebugLog(`Manual rotation to: ${(newHeading % 360).toFixed(1)}°`);
            }}
            className="text-xs text-blue-600 underline"
          >
            Rotate +45°
          </button>
          <button
            onClick={() => {
              const newManualMode = !manualMode;
              setManualMode(newManualMode);
              manualModeRef.current = newManualMode;
              addDebugLog(`Manual mode: ${newManualMode ? 'ON' : 'OFF'}`);
            }}
            className="text-xs text-blue-600 underline"
          >
            {manualMode ? 'Auto' : 'Manual'}
          </button>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-blue-600 underline"
          >
            {showDebug ? 'Hide' : 'Debug'}
          </button>
        </div>
        
        {/* Debug Section */}
        {showDebug && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
            <div className="font-medium mb-2">Debug Info:</div>
            
            {/* Current Status */}
            <div className="mb-2 space-y-1">
              <div>Permission: {permission}</div>
              <div>User Location: {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'None'}</div>
              <div>Heading: {heading !== null ? `${heading.toFixed(1)}°` : 'None'}</div>
              <div>Bearing to Cache: {bearing !== null ? `${bearing.toFixed(1)}°` : 'None'}</div>
              <div>Compass Rotation: {compassRotation.toFixed(1)}°</div>
              <div>Manual Mode: {manualMode ? 'ON' : 'OFF'}</div>
              <div>Sensor Status: {sensorStatus}</div>
            </div>
            
            {/* Last Orientation Event */}
            {lastOrientationEvent && (
              <div className="mb-2">
                <div className="font-medium">Last Orientation Event:</div>
                <div>Alpha: {lastOrientationEvent.alpha?.toFixed(1) || 'null'}</div>
                <div>Beta: {lastOrientationEvent.beta?.toFixed(1) || 'null'}</div>
                <div>Gamma: {lastOrientationEvent.gamma?.toFixed(1) || 'null'}</div>
                <div>WebKit: {lastOrientationEvent.webkitCompassHeading?.toFixed(1) || 'none'}</div>
              </div>
            )}
            
            {/* Last Motion Event */}
            {lastMotionEvent && (
              <div className="mb-2">
                <div className="font-medium">Last Motion Event:</div>
                <div>Acc X: {lastMotionEvent.acceleration?.x?.toFixed(2) || 'null'}</div>
                <div>Acc Y: {lastMotionEvent.acceleration?.y?.toFixed(2) || 'null'}</div>
                <div>Acc Z: {lastMotionEvent.acceleration?.z?.toFixed(2) || 'null'}</div>
                <div>Interval: {lastMotionEvent.interval || 'null'}ms</div>
              </div>
            )}
            
            {/* Recent Logs */}
            <div>
              <div className="font-medium mb-1">Recent Logs:</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {debugLogs.map((log, idx) => (
                  <div key={idx} className="text-xs text-gray-600">{log}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}