# Phase 4.1: Data Layer Audit

## Overview
This document maps all data-related hooks and their dependencies to identify overlapping functionality and plan consolidation strategy.

## Current Data Management Architecture

### Primary Data Management Hooks

#### 1. `useDataManager` (Main Coordinator)
**Location**: `src/hooks/useDataManager.ts`
**Purpose**: Unified data management with polling, prefetching, and caching
**Dependencies**:
- `useGeocaches` - Main geocaches query
- `usePrefetchManager` - Background prefetching
- `useCacheInvalidation` - Deletion monitoring
- `useOnlineStatus` - Network state
- `useCurrentUser` - User context
- `useGeocacheNavigation` - Cache pre-population
- `cacheManager` - LRU cache coordination
- `useNostr` - Direct Nostr queries

**Key Features**:
- Background sync for geocaches and logs
- Smart polling based on visibility/focus
- Manual refresh capabilities
- Cache validation and cleanup
- Performance optimization

#### 2. `usePrefetchManager` (Background Operations)
**Location**: `src/hooks/usePrefetchManager.ts`
**Purpose**: Centralized prefetching and background updates
**Dependencies**:
- `useNostr` - Nostr queries
- `useCurrentUser` - User context
- `useOnlineStatus` - Network state
- `useQueryClient` - React Query coordination

**Key Features**:
- Prefetch logs for specific geocaches
- Prefetch author metadata
- Background updates for geocaches and logs
- Smart prefetching based on current data
- Performance monitoring

#### 3. `useCacheInvalidation` (Cleanup)
**Location**: `src/hooks/useCacheInvalidation.ts`
**Purpose**: Handle cache invalidation for deleted geocaches
**Dependencies**:
- `useNostr` - Deletion event queries
- `useOfflineMode` - Network state
- `offlineStorage` - Offline cache cleanup
- `useQueryClient` - React Query invalidation

**Key Features**:
- Monitor NIP-09 deletion events
- Validate cached geocaches against network
- Remove deleted items from offline storage
- Periodic cache validation

### Feature-Specific Data Hooks

#### Geocache Feature Hooks
**Location**: `src/features/geocache/hooks/`

1. **`useGeocaches`** - Main geocaches list with LRU cache integration
2. **`useGeocache`** - Individual geocache by ID
3. **`useGeocacheByNaddr`** - Geocache by Nostr address
4. **`useGeocacheLogs`** - Logs for specific geocache
5. **`useCreateGeocache`** - Create new geocache
6. **`useEditGeocache`** - Edit existing geocache
7. **`useDeleteGeocache`** - Delete geocache
8. **`useBatchDeleteGeocaches`** - Bulk delete operations
9. **`useGeocacheStats`** - Statistics for geocache
10. **`useGeocacheNavigation`** - Navigation helpers
11. **`useUserGeocaches`** - User's own geocaches
12. **`useOfflineGeocaches`** - Offline cached geocaches
13. **`useOptimisticGeocaches`** - Optimistic updates

#### Auth Feature Hooks
**Location**: `src/features/auth/hooks/`

1. **`useCurrentUser`** - Current logged-in user
2. **`useAuthor`** - Author metadata by pubkey
3. **`useLoginActions`** - Login/logout actions

#### Profile Feature Hooks
**Location**: `src/features/profile/hooks/`

1. **`useNip05Verification`** - NIP-05 verification
2. **`useUserFoundCaches`** - Caches found by user

#### Offline Feature Hooks
**Location**: `src/features/offline/hooks/`

1. **`useOfflineStorage`** - Offline storage operations
2. **`useConnectivity`** - Network connectivity state
3. **`useOfflineStorageInfo`** - Storage statistics

#### Map Feature Hooks
**Location**: `src/features/map/hooks/`

1. **`useGeolocation`** - GPS location services

### Legacy Hooks (Still in src/hooks/)

#### Data Management (Overlapping with new system)
1. **`useCacheManager`** - Direct cache manager interface
2. **`usePerformanceOptimization`** - Performance monitoring
3. **`useReliableProximitySearch`** - Location-based search
4. **`useNostrSavedCaches`** - Saved caches functionality
5. **`useSavedCaches`** - Local saved caches

#### Publishing Hooks
1. **`useNostrPublish`** - Generic Nostr event publishing
2. **`useCreateLog`** - Create geocache log
3. **`useCreateVerifiedLog`** - Create verified log
4. **`useDeleteLog`** - Delete log

#### Utility Hooks
1. **`useDeletionFilter`** - Filter deleted events
2. **`useDeleteWithConfirmation`** - Confirmation dialogs
3. **`useRegenerateVerificationKey`** - Key regeneration
4. **`useRelayConfig`** - Relay configuration
5. **`useRelayStatus`** - Relay status monitoring

#### App-Level Hooks
1. **`useAppContext`** - App-wide context
2. **`usePWAInstall`** - PWA installation
3. **`usePWAUpdate`** - PWA updates
4. **`useStorageConfig`** - Storage configuration
5. **`useLoggedInAccounts`** - Account management

## Overlapping Functionality Analysis

### 1. Geocache Data Management
**Overlapping Hooks**:
- `useDataManager` + `useGeocaches` + `usePrefetchManager`
- `useOfflineGeocaches` + `useGeocaches`
- `useOptimisticGeocaches` + `useGeocaches`
- `useCacheManager` + `cacheManager` (direct usage)

**Issues**:
- Multiple sources of truth for geocache data
- Complex coordination between React Query and LRU cache
- Redundant prefetching logic
- Inconsistent cache invalidation

### 2. Log Data Management
**Overlapping Hooks**:
- `useGeocacheLogs` + `usePrefetchManager` (log prefetching)
- `useCreateLog` + `useCreateVerifiedLog` (similar functionality)
- `useDeleteLog` + `useDeleteWithConfirmation`

**Issues**:
- Duplicate log creation patterns
- Inconsistent log caching strategies
- Multiple deletion confirmation patterns

### 3. Author/Profile Data
**Overlapping Hooks**:
- `useAuthor` + `usePrefetchManager` (author prefetching)
- `useCurrentUser` + `useLoggedInAccounts`
- `useNip05Verification` (standalone vs integrated)

**Issues**:
- Separate author caching in multiple places
- User state management split across hooks

### 4. Network/Connectivity
**Overlapping Hooks**:
- `useConnectivity` + `useOnlineStatus` (from useDataManager)
- `useRelayStatus` + network state in data hooks
- `useOfflineMode` + connectivity checks

**Issues**:
- Multiple network state sources
- Inconsistent offline handling

### 5. Cache Management
**Overlapping Systems**:
- React Query cache + LRU cache (`cacheManager`)
- Offline storage + React Query cache
- Manual cache invalidation + automatic invalidation

**Issues**:
- Complex cache coordination
- Potential data inconsistencies
- Performance overhead from multiple cache layers

## Data Flow Complexity

### Current Data Flow
```
Component Request
    ↓
useDataManager (coordinator)
    ↓
useGeocaches (React Query)
    ↓
cacheManager (LRU cache check)
    ↓
Nostr Query (if cache miss)
    ↓
usePrefetchManager (background)
    ↓
useCacheInvalidation (cleanup)
```

### Issues with Current Flow
1. **Too Many Layers**: Data passes through multiple abstraction layers
2. **Unclear Ownership**: Multiple hooks can modify the same data
3. **Race Conditions**: Background updates can conflict with user actions
4. **Memory Overhead**: Multiple caches storing similar data
5. **Complex Debugging**: Hard to trace data flow issues

## Consolidation Strategy

### Proposed Unified Store Architecture

#### 1. Feature-Based Stores
- `useGeocacheStore` - All geocache-related data and operations
- `useLogStore` - All log-related data and operations  
- `useAuthorStore` - All author/profile data and operations
- `useOfflineStore` - All offline data and sync operations

#### 2. Store Responsibilities

**`useGeocacheStore`**:
- Geocache CRUD operations
- Geocache list management
- Location-based filtering
- User's geocaches
- Optimistic updates
- Background sync

**`useLogStore`**:
- Log CRUD operations
- Log prefetching
- Log validation
- Recent logs aggregation

**`useAuthorStore`**:
- Author metadata caching
- NIP-05 verification
- Profile updates
- Author prefetching

**`useOfflineStore`**:
- Offline data management
- Sync coordination
- Storage statistics
- Connectivity handling

#### 3. Unified Cache Layer
- Single cache interface for all stores
- Consistent invalidation strategy
- Unified background sync
- Performance monitoring

### Migration Benefits

1. **Simplified Data Flow**: Clear ownership and single source of truth
2. **Better Performance**: Reduced cache coordination overhead
3. **Easier Testing**: Isolated store logic
4. **Clearer APIs**: Feature-focused interfaces
5. **Reduced Complexity**: Fewer interdependent hooks

## Next Steps for Phase 4.2

### 1. Design Store Interfaces
- Define TypeScript interfaces for each store
- Plan state management patterns
- Design action/mutation APIs

### 2. Create Store Implementations
- Implement stores using React Query + Zustand/Context
- Migrate cache management logic
- Add background sync capabilities

### 3. Migration Strategy
- Create compatibility layer for existing hooks
- Gradual migration of components
- Remove old hooks after migration

### 4. Performance Optimization
- Implement proper memoization
- Add performance monitoring
- Optimize query patterns

## Risk Assessment

### High Risk Items
- **Data Migration**: Risk of data loss during store migration
- **Performance Regression**: New architecture might be slower initially
- **Breaking Changes**: Components might need significant updates

### Mitigation Strategies
- **Gradual Migration**: Keep old hooks working during transition
- **Comprehensive Testing**: Test all data operations thoroughly
- **Performance Monitoring**: Track metrics during migration
- **Rollback Plan**: Ability to revert to old system if needed

## Success Metrics

### Code Quality
- [ ] Reduced number of data-related hooks (target: 50% reduction)
- [ ] Simplified data flow (single source of truth per feature)
- [ ] Improved test coverage for data operations

### Performance
- [ ] Faster initial load times
- [ ] Reduced memory usage
- [ ] Better cache hit rates
- [ ] Fewer redundant network requests

### Developer Experience
- [ ] Clearer data APIs
- [ ] Easier debugging
- [ ] Faster development of new features
- [ ] Better error handling

---

**Status**: Phase 4.1 Complete - Audit Documented
**Next**: Phase 4.2 - Create Unified Data Stores
**Estimated Time**: 2-3 sessions for Phase 4.2