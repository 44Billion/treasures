/**
 * COMPATIBILITY LAYER: usePrefetchManager
 * This hook now uses the new unified store system while maintaining the same API
 * for backward compatibility during migration.
 */

// Re-export from the new store system
export { useGeocachePrefetch } from '@/shared/stores';

// All functionality has been moved to the new unified store system
// This file now serves as a compatibility layer

// Legacy export for backward compatibility
export function usePrefetchManager(options: any = {}) {
  const { useGeocachePrefetch } = require('@/shared/stores');
  return useGeocachePrefetch();
}