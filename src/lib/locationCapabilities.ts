/**
 * Universal location capability detection without browser-specific hacks
 * Tests actual capabilities rather than making assumptions based on user agent
 */

interface LocationCapabilities {
  hasGeolocation: boolean;
  hasPermissionsAPI: boolean;
  isSecureContext: boolean;
  supportsHighAccuracy: boolean;
  estimatedCapability: 'excellent' | 'good' | 'limited' | 'none';
}

/**
 * Tests the device's actual location capabilities
 */
export async function testLocationCapabilities(): Promise<LocationCapabilities> {
  const capabilities: LocationCapabilities = {
    hasGeolocation: 'geolocation' in navigator,
    hasPermissionsAPI: 'permissions' in navigator,
    isSecureContext: window.isSecureContext,
    supportsHighAccuracy: false,
    estimatedCapability: 'none',
  };

  if (!capabilities.hasGeolocation) {
    return capabilities;
  }

  // Test if high accuracy is actually supported by attempting a quick request
  try {
    const testPromise = new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => resolve(false), 2000); // Quick test

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          // If we get a position with reasonable accuracy, high accuracy likely works
          resolve(position.coords.accuracy <= 100);
        },
        () => {
          clearTimeout(timeoutId);
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 2000,
          maximumAge: 300000,
        }
      );
    });

    capabilities.supportsHighAccuracy = await testPromise;
  } catch (error) {
    capabilities.supportsHighAccuracy = false;
  }

  // Estimate overall capability
  if (!capabilities.hasGeolocation || !capabilities.isSecureContext) {
    capabilities.estimatedCapability = 'none';
  } else if (capabilities.supportsHighAccuracy && capabilities.hasPermissionsAPI) {
    capabilities.estimatedCapability = 'excellent';
  } else if (capabilities.supportsHighAccuracy || capabilities.hasPermissionsAPI) {
    capabilities.estimatedCapability = 'good';
  } else {
    capabilities.estimatedCapability = 'limited';
  }

  return capabilities;
}

/**
 * Gets optimal location request settings based on tested capabilities
 */
export function getOptimalLocationSettings(
  capabilities: LocationCapabilities,
  prioritizePrecision: boolean = false
): {
  strategies: Array<{
    name: string;
    timeout: number;
    options: PositionOptions;
    priority: number;
  }>;
} {
  const strategies = [];

  if (capabilities.estimatedCapability === 'none') {
    return { strategies: [] };
  }

  // Base strategy: Network location (works on most devices)
  strategies.push({
    name: 'network',
    timeout: capabilities.estimatedCapability === 'excellent' ? 4000 : 6000,
    options: {
      enableHighAccuracy: false,
      timeout: capabilities.estimatedCapability === 'excellent' ? 4000 : 6000,
      maximumAge: 300000,
    },
    priority: prioritizePrecision ? 2 : 1,
  });

  // High accuracy strategy (if supported and requested)
  if (capabilities.supportsHighAccuracy && prioritizePrecision) {
    strategies.push({
      name: 'precise',
      timeout: capabilities.estimatedCapability === 'excellent' ? 8000 : 12000,
      options: {
        enableHighAccuracy: true,
        timeout: capabilities.estimatedCapability === 'excellent' ? 8000 : 12000,
        maximumAge: 60000,
      },
      priority: 1,
    });
  }

  // Cached strategy (fastest fallback)
  strategies.push({
    name: 'cached',
    timeout: 3000,
    options: {
      enableHighAccuracy: false,
      timeout: 3000,
      maximumAge: 600000,
    },
    priority: 3,
  });

  // Sort by priority
  strategies.sort((a, b) => a.priority - b.priority);

  return { strategies };
}

/**
 * Quick capability check without full testing (for immediate decisions)
 */
export function getBasicLocationCapabilities(): Pick<LocationCapabilities, 'hasGeolocation' | 'isSecureContext'> {
  return {
    hasGeolocation: 'geolocation' in navigator,
    isSecureContext: window.isSecureContext,
  };
}

/**
 * Determines if location services are likely to work
 */
export function isLocationLikelyToWork(): boolean {
  const basic = getBasicLocationCapabilities();
  return basic.hasGeolocation && basic.isSecureContext;
}

/**
 * Gets user-friendly capability description
 */
export function getCapabilityDescription(capabilities: LocationCapabilities): string {
  switch (capabilities.estimatedCapability) {
    case 'excellent':
      return 'Your device has excellent location support with high accuracy available';
    case 'good':
      return 'Your device has good location support';
    case 'limited':
      return 'Your device has basic location support';
    case 'none':
      if (!capabilities.hasGeolocation) {
        return 'Your device does not support location services';
      } else if (!capabilities.isSecureContext) {
        return 'Location requires a secure connection (HTTPS)';
      } else {
        return 'Location services are not available';
      }
    default:
      return 'Location capability unknown';
  }
}