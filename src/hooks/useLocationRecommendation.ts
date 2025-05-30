import { useState, useEffect } from 'react';
import { 
  isFirefoxAndroid, 
  isFirefoxMobile, 
  checkLocationPermissions 
} from '@/lib/firefoxAndroidGeolocation';

interface LocationRecommendation {
  recommendEnhanced: boolean;
  reason: string;
  browserInfo: {
    isFirefoxAndroid: boolean;
    isFirefoxMobile: boolean;
    isSecureContext: boolean;
    hasGeolocation: boolean;
  };
  permissionStatus?: {
    supported: boolean;
    permission: PermissionState | 'unknown';
    secureContext: boolean;
  };
}

/**
 * Hook to determine if the enhanced location picker should be recommended
 * based on browser detection and capabilities
 */
export function useLocationRecommendation(): LocationRecommendation {
  const [recommendation, setRecommendation] = useState<LocationRecommendation>({
    recommendEnhanced: true, // Default to enhanced
    reason: 'Enhanced picker provides better reliability',
    browserInfo: {
      isFirefoxAndroid: isFirefoxAndroid(),
      isFirefoxMobile: isFirefoxMobile(),
      isSecureContext: window.isSecureContext,
      hasGeolocation: 'geolocation' in navigator,
    },
  });

  useEffect(() => {
    const checkRecommendation = async () => {
      const browserInfo = {
        isFirefoxAndroid: isFirefoxAndroid(),
        isFirefoxMobile: isFirefoxMobile(),
        isSecureContext: window.isSecureContext,
        hasGeolocation: 'geolocation' in navigator,
      };

      let recommendEnhanced = true;
      let reason = 'Enhanced picker provides better reliability';

      // Check specific conditions
      if (browserInfo.isFirefoxAndroid) {
        recommendEnhanced = true;
        reason = 'Firefox on Android requires enhanced location handling';
      } else if (browserInfo.isFirefoxMobile) {
        recommendEnhanced = true;
        reason = 'Firefox mobile benefits from enhanced location features';
      } else if (!browserInfo.isSecureContext) {
        recommendEnhanced = true;
        reason = 'Enhanced picker provides better error handling for non-HTTPS sites';
      } else if (!browserInfo.hasGeolocation) {
        recommendEnhanced = true;
        reason = 'Enhanced picker provides fallback options when geolocation is unavailable';
      } else {
        // For other browsers, enhanced is still recommended but not critical
        recommendEnhanced = true;
        reason = 'Enhanced picker provides progressive fallback and better accuracy indicators';
      }

      // Check permissions if available
      let permissionStatus;
      try {
        permissionStatus = await checkLocationPermissions();
      } catch (error) {
        console.log('Could not check location permissions:', error);
      }

      setRecommendation({
        recommendEnhanced,
        reason,
        browserInfo,
        permissionStatus,
      });
    };

    checkRecommendation();
  }, []);

  return recommendation;
}

/**
 * Simple hook that just returns whether to use enhanced picker
 */
export function useShouldUseEnhancedLocation(): boolean {
  const { recommendEnhanced } = useLocationRecommendation();
  return recommendEnhanced;
}

/**
 * Hook that returns the appropriate location picker component
 */
export function useLocationPickerComponent(): 'enhanced' | 'original' {
  const { recommendEnhanced } = useLocationRecommendation();
  return recommendEnhanced ? 'enhanced' : 'original';
}