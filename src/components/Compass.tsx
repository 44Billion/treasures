import { useState, useEffect, useRef } from "react";
import { Navigation } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";

interface CompassProps {
  targetLat: number;
  targetLng: number;
  className?: string;
}

export function Compass({ targetLat, targetLng, className }: CompassProps) {
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [error, setError] = useState<string | null>(null);
  
  // Use the working geolocation hook
  const { coords: userCoords, getLocation } = useGeolocation();
  
  const userLocation = userCoords ? {
    lat: userCoords.latitude,
    lng: userCoords.longitude
  } : null;

  // Auto-get location when component mounts
  useEffect(() => {
    getLocation();
  }, [getLocation]);

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

  const bearing = userLocation ? calculateBearing(userLocation.lat, userLocation.lng, targetLat, targetLng) : null;
  const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, targetLat, targetLng) : null;
  const compassRotation = heading !== null && bearing !== null ? bearing - heading : 0;

  useEffect(() => {
    let orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;

    const setupOrientation = async () => {
      // Check if DeviceOrientationEvent is supported
      if (!window.DeviceOrientationEvent) {
        setPermission('unsupported');
        setError('Device orientation not supported');
        return;
      }

      // For iOS 13+ devices, we need to request permission
      const hasRequestPermission = typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function';
      
      if (hasRequestPermission) {
        try {
          const orientationPermission = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
          if (orientationPermission !== 'granted') {
            setPermission('denied');
            setError('Device orientation permission denied');
            return;
          }
        } catch (error) {
          setPermission('denied');
          setError('Failed to request orientation permission');
          return;
        }
      }

      // Set up orientation handler
      orientationHandler = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null) {
          let alpha = event.alpha;
          const webkitEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
          
          // For iOS, prefer webkitCompassHeading if available
          if (webkitEvent.webkitCompassHeading !== undefined) {
            alpha = webkitEvent.webkitCompassHeading;
          }
          
          // Ensure alpha is in 0-360 range
          alpha = ((alpha % 360) + 360) % 360;
          
          setHeading(alpha);
          setPermission('granted');
        }
      };

      // Add orientation listeners
      window.addEventListener('deviceorientation', orientationHandler);
      window.addEventListener('deviceorientationabsolute', orientationHandler);
      
      // Set fallback heading after timeout
      setTimeout(() => {
        if (heading === null) {
          setHeading(0); // Default to north
          setPermission('granted');
        }
      }, 3000);
    };

    setupOrientation();

    return () => {
      if (orientationHandler) {
        window.removeEventListener('deviceorientation', orientationHandler);
        window.removeEventListener('deviceorientationabsolute', orientationHandler);
      }
    };
  }, [heading]);

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
    if (typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (permission === 'granted') {
          window.location.reload();
        } else {
          setError('Permission denied');
        }
      } catch (error) {
        setError('Failed to request permission');
      }
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
          {error || 'Compass requires orientation access'}
        </div>
        {typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function' && (
          <button
            onClick={requestPermission}
            className="text-blue-600 text-sm underline"
          >
            Enable Compass
          </button>
        )}
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
      </div>
    </div>
  );
}