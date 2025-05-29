import { useState, useEffect, useRef } from "react";
import { Navigation } from "lucide-react";

interface GPSCompassProps {
  targetLat: number;
  targetLng: number;
  className?: string;
}

export function GPSCompass({ targetLat, targetLng, className }: GPSCompassProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationHistory, setLocationHistory] = useState<Array<{ lat: number; lng: number; timestamp: number }>>([]);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 9)]);
  };

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

  // Calculate GPS heading from movement using multiple points for better accuracy
  const calculateUserHeading = (locations: Array<{ lat: number; lng: number; timestamp: number }>): number | null => {
    if (locations.length < 2) return null;
    
    // Use the last few points to calculate a more stable heading
    const recentLocations = locations.slice(-5); // Last 5 points
    if (recentLocations.length < 2) return null;
    
    // Calculate weighted average heading from recent movements
    let totalWeight = 0;
    let weightedHeadingX = 0;
    let weightedHeadingY = 0;
    
    for (let i = 1; i < recentLocations.length; i++) {
      const from = recentLocations[i - 1];
      const to = recentLocations[i];
      
      const distance = calculateDistance(from.lat, from.lng, to.lat, to.lng);
      const timeDiff = (to.timestamp - from.timestamp) / 1000; // seconds
      
      // Weight by distance and recency (more recent = higher weight)
      const weight = distance * (i / recentLocations.length);
      
      if (weight > 0.001) { // Only use movements > 1 meter
        const bearing = calculateBearing(from.lat, from.lng, to.lat, to.lng);
        const bearingRad = bearing * Math.PI / 180;
        
        weightedHeadingX += Math.sin(bearingRad) * weight;
        weightedHeadingY += Math.cos(bearingRad) * weight;
        totalWeight += weight;
      }
    }
    
    if (totalWeight === 0) return null;
    
    const avgHeading = Math.atan2(weightedHeadingX, weightedHeadingY) * 180 / Math.PI;
    return (avgHeading + 360) % 360;
  };

  // Smooth heading changes to reduce jitter
  const smoothHeading = (newHeading: number, currentHeading: number | null): number => {
    if (currentHeading === null) return newHeading;
    
    // Handle the 360/0 degree boundary
    let diff = newHeading - currentHeading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    // Apply smoothing (adjust factor for more/less smoothing)
    const smoothingFactor = 0.3;
    const smoothedHeading = currentHeading + (diff * smoothingFactor);
    
    return (smoothedHeading + 360) % 360;
  };

  useEffect(() => {
    addDebugLog('GPS Compass initializing...');
    
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    // Start watching position with high accuracy
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        const timestamp = Date.now();
        const accuracy = position.coords.accuracy;
        const speed = position.coords.speed;

        setAccuracy(accuracy);
        setSpeed(speed);
        setUserLocation(newLocation);

        addDebugLog(`GPS: ${newLocation.lat.toFixed(6)}, ${newLocation.lng.toFixed(6)} (±${accuracy?.toFixed(1)}m)`);
        
        // Add to location history
        setLocationHistory(prev => {
          const newHistory = [...prev, { ...newLocation, timestamp }];
          
          // Keep only recent locations (last 30 seconds)
          const cutoffTime = timestamp - 30000;
          const filteredHistory = newHistory.filter(loc => loc.timestamp > cutoffTime);
          
          // Calculate user heading from movement
          const newHeading = calculateUserHeading(filteredHistory);
          if (newHeading !== null) {
            const smoothedHeading = smoothHeading(newHeading, userHeading);
            setUserHeading(smoothedHeading);
            addDebugLog(`User heading: ${smoothedHeading.toFixed(1)}° (from ${filteredHistory.length} points)`);
          }
          
          return filteredHistory;
        });
      },
      (error) => {
        addDebugLog(`GPS error: ${error.message}`);
        setError(`GPS error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 500 // Get fresh readings more frequently
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []); // Remove dependencies to prevent re-initialization

  const bearing = userLocation ? calculateBearing(userLocation.lat, userLocation.lng, targetLat, targetLng) : null;
  const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, targetLat, targetLng) : null;
  
  // Calculate compass rotation: bearing to target minus user's heading
  // This shows the direction to the target relative to where the user is facing
  const compassRotation = (bearing !== null && userHeading !== null) 
    ? (bearing - userHeading + 360) % 360 
    : (bearing !== null ? bearing : 0);

  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    } else if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)}km`;
    } else {
      return `${Math.round(distanceKm)}km`;
    }
  };

  if (error) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <div className="text-gray-500 text-sm mb-2">
          GPS Compass Error: {error}
        </div>
        <button
          onClick={() => {
            setError(null);
            setUserLocation(null);
            setLocationHistory([]);
            setUserHeading(null);
            setAccuracy(null);
            setSpeed(null);
          }}
          className="text-blue-600 text-sm underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!userLocation) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-2"></div>
          <div className="text-gray-500 text-sm">
            Getting GPS location...
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {userHeading !== null 
              ? "GPS compass calibrated - move to update direction" 
              : "Move around to calibrate GPS compass"
            }
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
        
        {/* Compass needle pointing to cache relative to user's orientation */}
        <div 
          className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out"
          style={{ transform: `rotate(${compassRotation}deg)` }}
        >
          <Navigation 
            className={`w-8 h-8 drop-shadow-sm ${
              userHeading !== null ? 'text-green-600' : 'text-blue-600'
            }`}
            style={{ transform: 'rotate(-45deg)' }}
          />
        </div>
        
        {/* User heading indicator (small arrow showing which way user is facing) */}
        {userHeading !== null && (
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{ transform: `rotate(${userHeading}deg)` }}
          >
            <div className="absolute top-2 w-1 h-3 bg-red-500 rounded-full opacity-60"></div>
          </div>
        )}
        
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-gray-800 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
      </div>
      
      <div className="text-sm">
        <div className="font-medium text-gray-800">
          {distance && formatDistance(distance)}
        </div>
        <div className="text-xs mt-1">
          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
            userHeading !== null ? 'bg-green-500' : 'bg-yellow-500'
          }`}></span>
          {userHeading !== null ? 'Calibrated' : 'Calibrating...'}
        </div>
        <div className="text-gray-500 text-xs">
          {bearing && `${Math.round(bearing)}° from North`}
        </div>
        <div className="text-gray-400 text-xs mt-1">
          Your heading: {userHeading !== null ? `${Math.round(userHeading)}°` : 'Move to calibrate'}
        </div>
        <div className="text-gray-400 text-xs">
          Accuracy: ±{accuracy?.toFixed(1) || '?'}m
        </div>
        <div className="text-gray-400 text-xs">
          {speed !== null && speed > 0 ? `Speed: ${(speed * 3.6).toFixed(1)} km/h` : 'GPS Compass'}
        </div>
        
        <div className="flex gap-2 mt-2 justify-center">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-blue-600 underline"
          >
            {showDebug ? 'Hide' : 'Debug'}
          </button>
          <button
            onClick={() => {
              alert('GPS Compass Help:\n\n1. Allow location access\n2. Move around 10-20 meters to calibrate\n3. Green arrow points to cache\n4. Red dot shows your heading\n5. Works best outdoors with movement');
            }}
            className="text-xs text-blue-600 underline"
          >
            Help
          </button>
        </div>
        
        {/* Debug Section */}
        {showDebug && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
            <div className="font-medium mb-2">GPS Debug Info:</div>
            
            <div className="mb-2 space-y-1">
              <div>Current Location: {userLocation ? `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}` : 'None'}</div>
              <div>Location History: {locationHistory.length} points</div>
              <div>User Heading: {userHeading !== null ? `${userHeading.toFixed(1)}°` : 'None'}</div>
              <div>Bearing to Target: {bearing !== null ? `${bearing.toFixed(1)}°` : 'None'}</div>
              <div>Compass Rotation: {compassRotation.toFixed(1)}°</div>
              <div>Distance: {distance !== null ? `${distance.toFixed(3)}km` : 'None'}</div>
              <div>GPS Accuracy: ±{accuracy?.toFixed(1) || '?'}m</div>
              <div>Speed: {speed !== null ? `${(speed * 3.6).toFixed(1)} km/h` : 'Unknown'}</div>
            </div>
            
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