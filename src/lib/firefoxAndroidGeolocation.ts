/**
 * Firefox on Android specific geolocation utilities
 * Handles the unique challenges and requirements of Firefox mobile browser
 */

interface FirefoxAndroidGeolocationOptions {
  timeout?: number;
  maximumAge?: number;
  enableHighAccuracy?: boolean;
}

interface GeolocationResult {
  success: boolean;
  position?: GeolocationPosition;
  error?: GeolocationPositionError;
  method: 'high-accuracy' | 'network' | 'cached' | 'failed';
}

/**
 * Detects if the user is on Firefox Android
 */
export function isFirefoxAndroid(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('firefox') && userAgent.includes('android');
}

/**
 * Detects if the user is on any mobile Firefox
 */
export function isFirefoxMobile(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('firefox') && (
    userAgent.includes('android') || 
    userAgent.includes('mobile') ||
    userAgent.includes('tablet')
  );
}

/**
 * Gets device and browser specific recommendations for location access
 */
export function getLocationTroubleshootingSteps(): string[] {
  const steps: string[] = [];
  
  if (isFirefoxAndroid()) {
    steps.push(
      "Open Firefox menu → Settings → Site permissions → Location → Allow",
      "Open Android Settings → Apps → Firefox → Permissions → Location → Allow",
      "Ensure Location Services are enabled in Android Settings",
      "Try refreshing the page after enabling permissions",
      "Consider using Chrome or another browser if issues persist"
    );
  } else if (isFirefoxMobile()) {
    steps.push(
      "Open Firefox menu → Settings → Privacy & Security → Permissions → Location",
      "Enable location services in your device settings",
      "Refresh the page after changing permissions"
    );
  } else {
    steps.push(
      "Click the location icon in your browser's address bar",
      "Select 'Allow' for location access",
      "Refresh the page if needed"
    );
  }
  
  return steps;
}

/**
 * Firefox Android optimized geolocation request
 * Uses specific strategies that work better on Firefox mobile
 */
export function getFirefoxAndroidLocation(
  options: FirefoxAndroidGeolocationOptions = {}
): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        success: false,
        error: {
          code: 2,
          message: "Geolocation not supported",
        } as GeolocationPositionError,
        method: 'failed'
      });
      return;
    }

    let resolved = false;
    const resolveOnce = (result: GeolocationResult) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // Strategy 1: Try high accuracy with Firefox-optimized settings
    const tryHighAccuracy = () => {
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log('High accuracy timeout, trying network location');
          tryNetworkLocation();
        }
      }, 12000); // Longer timeout for Firefox Android

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          resolveOnce({
            success: true,
            position,
            method: 'high-accuracy'
          });
        },
        (error) => {
          clearTimeout(timeoutId);
          console.log('High accuracy failed:', error.message);
          if (!resolved) {
            tryNetworkLocation();
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 12000, // Firefox Android needs more time
          maximumAge: 30000, // Shorter cache for high accuracy
        }
      );
    };

    // Strategy 2: Network-based location with Firefox-friendly settings
    const tryNetworkLocation = () => {
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log('Network location timeout, trying cached');
          tryCachedLocation();
        }
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          resolveOnce({
            success: true,
            position,
            method: 'network'
          });
        },
        (error) => {
          clearTimeout(timeoutId);
          console.log('Network location failed:', error.message);
          if (!resolved) {
            tryCachedLocation();
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes for network
        }
      );
    };

    // Strategy 3: Try any cached location
    const tryCachedLocation = () => {
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log('Cached location timeout, giving up');
          resolveOnce({
            success: false,
            error: {
              code: 3,
              message: "All location methods timed out",
            } as GeolocationPositionError,
            method: 'failed'
          });
        }
      }, 8000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          resolveOnce({
            success: true,
            position,
            method: 'cached'
          });
        },
        (error) => {
          clearTimeout(timeoutId);
          console.log('Cached location failed:', error.message);
          resolveOnce({
            success: false,
            error,
            method: 'failed'
          });
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 600000, // 10 minutes for cached
        }
      );
    };

    // Start the cascade
    if (options.enableHighAccuracy !== false) {
      tryHighAccuracy();
    } else {
      tryNetworkLocation();
    }
  });
}

/**
 * Checks if location permissions are likely to work
 */
export async function checkLocationPermissions(): Promise<{
  supported: boolean;
  permission: PermissionState | 'unknown';
  secureContext: boolean;
  recommendations: string[];
}> {
  const result = {
    supported: 'geolocation' in navigator,
    permission: 'unknown' as PermissionState | 'unknown',
    secureContext: window.isSecureContext,
    recommendations: [] as string[],
  };

  // Check permissions API if available
  if ('permissions' in navigator) {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      result.permission = permissionStatus.state;
    } catch (error) {
      console.log('Permissions API not available or failed:', error);
    }
  }

  // Add recommendations based on detected issues
  if (!result.supported) {
    result.recommendations.push("Your browser doesn't support geolocation");
  }

  if (!result.secureContext) {
    result.recommendations.push("Location requires HTTPS (secure connection)");
  }

  if (result.permission === 'denied') {
    result.recommendations.push(...getLocationTroubleshootingSteps());
  }

  if (isFirefoxAndroid() && result.permission === 'prompt') {
    result.recommendations.push(
      "Firefox on Android may require manual permission setup",
      "Location requests may take longer than other browsers"
    );
  }

  return result;
}

/**
 * Optimized geolocation for Firefox Android with user guidance
 */
export async function getLocationWithGuidance(): Promise<{
  success: boolean;
  position?: GeolocationPosition;
  error?: string;
  method?: string;
  guidance?: string[];
}> {
  // First check if we can even attempt location
  const permissionCheck = await checkLocationPermissions();
  
  if (!permissionCheck.supported) {
    return {
      success: false,
      error: "Geolocation not supported by your browser",
      guidance: permissionCheck.recommendations,
    };
  }

  if (!permissionCheck.secureContext) {
    return {
      success: false,
      error: "Location requires a secure connection (HTTPS)",
      guidance: permissionCheck.recommendations,
    };
  }

  if (permissionCheck.permission === 'denied') {
    return {
      success: false,
      error: "Location permission denied",
      guidance: permissionCheck.recommendations,
    };
  }

  // Attempt to get location
  const result = await getFirefoxAndroidLocation({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,
  });

  if (result.success && result.position) {
    return {
      success: true,
      position: result.position,
      method: result.method,
    };
  }

  // Handle specific error cases
  let errorMessage = "Unable to get your location";
  let guidance: string[] = [];

  if (result.error) {
    switch (result.error.code) {
      case 1: // PERMISSION_DENIED
        errorMessage = "Location permission denied";
        guidance = getLocationTroubleshootingSteps();
        break;
      case 2: // POSITION_UNAVAILABLE
        errorMessage = "Location unavailable";
        guidance = [
          "Make sure location services are enabled",
          "Try moving to an area with better GPS/WiFi signal",
          "Check that your device has location services turned on",
        ];
        if (isFirefoxAndroid()) {
          guidance.push("Firefox on Android may have additional location restrictions");
        }
        break;
      case 3: // TIMEOUT
        errorMessage = "Location request timed out";
        guidance = [
          "Location is taking longer than expected",
          "Try again in a moment",
          "Ensure you have a good internet connection",
        ];
        if (isFirefoxAndroid()) {
          guidance.push("Firefox on Android may need more time for location requests");
        }
        break;
    }
  }

  return {
    success: false,
    error: errorMessage,
    guidance,
  };
}