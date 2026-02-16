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

