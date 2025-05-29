/**
 * iOS Safari detection and compatibility utilities
 */

export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isIOSSafari = (): boolean => {
  const ua = navigator.userAgent;
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/.test(ua);
};

export const getIOSVersion = (): number | null => {
  const match = navigator.userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1], 10) : null;
};

export const isOldIOS = (): boolean => {
  const version = getIOSVersion();
  return version !== null && version < 14; // iOS 14+ has better web support
};

export const logIOSInfo = (): void => {
  console.log('=== iOS Detection ===');
  console.log('iOS:', isIOS());
  console.log('iOS Safari:', isIOSSafari());
  console.log('iOS Version:', getIOSVersion());
  console.log('Old iOS:', isOldIOS());
  console.log('User Agent:', navigator.userAgent);
  console.log('Viewport:', {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio
  });
};

export const getIOSCompatibleMapOptions = () => {
  if (!isIOS()) {
    return {
      scrollWheelZoom: true,
      tap: false,
      tapTolerance: 10,
      bounceAtZoomLimits: true,
      maxBoundsViscosity: 1.0
    };
  }

  return {
    scrollWheelZoom: false, // Disable on iOS to prevent conflicts
    tap: true, // Enable tap for iOS
    tapTolerance: 15, // Increase tap tolerance for iOS
    bounceAtZoomLimits: false, // Disable bounce on iOS
    maxBoundsViscosity: 0.0 // Reduce viscosity on iOS
  };
};

export const getIOSCompatibleQueryOptions = () => {
  if (!isIOS()) {
    return {
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
      timeout: 3000
    };
  }

  return {
    staleTime: 30000, // 30 seconds - shorter for iOS
    gcTime: 300000, // 5 minutes - shorter for iOS memory management
    timeout: 5000 // Longer timeout for iOS
  };
};