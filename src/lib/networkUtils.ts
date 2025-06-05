import { TIMEOUTS } from './constants';

/**
 * Detect if the user is on a slow connection and adjust timeouts accordingly
 */
export function getAdaptiveTimeout(baseTimeout: number): number {
  // Check if we have connection info
  const connection = (navigator as any).connection;
  
  if (connection) {
    const { effectiveType, downlink } = connection;
    
    // Slow connection indicators
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return baseTimeout * 3; // 3x longer for very slow connections
    }
    
    if (effectiveType === '3g' || downlink < 1) {
      return baseTimeout * 2; // 2x longer for slow connections
    }
  }
  
  // Check if user is on mobile (often slower)
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    return baseTimeout * 1.5; // 1.5x longer for mobile
  }
  
  return baseTimeout;
}

/**
 * Get timeout values adjusted for current network conditions
 */
export function getAdaptiveTimeouts() {
  return {
    QUERY: getAdaptiveTimeout(TIMEOUTS.QUERY),
    FAST_QUERY: getAdaptiveTimeout(TIMEOUTS.FAST_QUERY),
    CONNECTIVITY_CHECK: getAdaptiveTimeout(TIMEOUTS.CONNECTIVITY_CHECK),
  };
}

/**
 * Check if the current connection is likely to be slow
 */
export function isSlowConnection(): boolean {
  const connection = (navigator as any).connection;
  
  if (connection) {
    const { effectiveType, downlink } = connection;
    return effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g' || downlink < 1;
  }
  
  // Assume mobile might be slow
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Get a timeout with exponential backoff for retries
 */
export function getRetryTimeout(baseTimeout: number, attempt: number, maxAttempts: number): number {
  const adaptiveBase = getAdaptiveTimeout(baseTimeout);
  const backoffMultiplier = 1 + (attempt - 1) * 0.5; // 1x, 1.5x, 2x, etc.
  return Math.min(adaptiveBase * backoffMultiplier, adaptiveBase * 3); // Cap at 3x
}