# Offline Features Implementation

This document outlines the comprehensive offline functionality that has been added to the Treasures PWA application.

## Overview

The application now supports true offline interaction, allowing users to:
- Browse cached geocaches and maps when offline
- Create geocaches and logs while offline (synced when online)
- View cached user profiles and data
- Manage offline settings and storage
- Automatically sync pending actions when connection is restored

## Core Components

### 1. Offline Storage System (`src/lib/offlineStorage.ts`)

A comprehensive IndexedDB-based storage system that manages:

- **Events**: Nostr events cached for offline access
- **Geocaches**: Geocache data with coordinates, difficulty, terrain info
- **Logs**: Geocache logs and user interactions
- **Profiles**: User profile metadata
- **Pending Events**: Events waiting to be published when online
- **Settings**: App preferences and configuration
- **Offline Actions**: Queued actions for background sync

**Key Features:**
- Automatic data expiration and cleanup (30 days default)
- Graceful fallback when IndexedDB is unavailable
- Efficient querying with geographic bounds support
- Type-safe interfaces for all stored data

### 2. Offline Sync Manager (`src/lib/offlineSync.ts`)

Handles background synchronization and conflict resolution:

- **Network Detection**: Monitors online/offline status
- **Automatic Sync**: Syncs pending actions when connection restored
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Batch Processing**: Processes multiple actions efficiently
- **Error Handling**: Graceful error handling with user feedback

**Sync Actions Supported:**
- `publish_event`: Publish Nostr events
- `update_profile`: Update user profiles
- `create_log`: Create geocache logs
- `bookmark_cache`: Bookmark/unbookmark geocaches

### 3. Enhanced PWA Configuration (`vite.config.ts`)

Updated Vite PWA plugin configuration with:

- **Service Worker**: Automatic updates and caching
- **Runtime Caching**: OSM tiles and images cached for offline use
- **Manifest**: Enhanced PWA manifest with offline capabilities
- **Asset Caching**: Comprehensive asset caching strategy

## React Hooks

### 1. Offline Storage Hooks (`src/hooks/useOfflineStorage.ts`)

- `useOfflineSync()`: Manage sync status and trigger manual sync
- `useOfflineGeocaches()`: Access cached geocaches
- `useOfflineProfiles()`: Manage cached user profiles
- `useOfflineEvents()`: Handle cached Nostr events
- `useOfflineSettings()`: Manage app settings
- `useOfflineMode()`: Check online/offline status
- `useOfflineFirst()`: Offline-first data fetching pattern

### 2. Enhanced Nostr Hooks (`src/hooks/useOfflineNostr.ts`)

- `useOfflineNostr()`: Enhanced Nostr client with offline support
- `useOfflineProfile()`: Offline-aware profile queries
- `useOfflineCreateLog()`: Create logs with offline queueing

### 3. Geocache Hooks (`src/hooks/useOfflineGeocaches.ts`)

- `useOfflineGeocaches()`: Enhanced geocache queries with offline fallback
- `useOfflineCreateGeocache()`: Create geocaches with offline support
- `useOfflineProximityGeocaches()`: Location-based geocache queries
- `useOfflineBookmarkGeocache()`: Bookmark management with offline support

## UI Components

### 1. Offline Indicator (`src/components/OfflineIndicator.tsx`)

Displays current connection and sync status:

- **Connection Status**: Online/offline indicator
- **Sync Progress**: Shows pending actions and sync status
- **Error Display**: Shows sync errors and retry information
- **Manual Sync**: Button to trigger immediate sync
- **Compact Mode**: Minimal indicator for headers/toolbars

### 2. Service Worker Provider (`src/components/ServiceWorkerProvider.tsx`)

Manages PWA installation and updates:

- **Update Notifications**: Prompts for app updates
- **Install Prompts**: PWA installation prompts
- **Background Updates**: Automatic service worker updates
- **User Controls**: Manual update and install triggers

### 3. Offline Map (`src/components/OfflineMap.tsx`)

Enhanced map component with offline capabilities:

- **Tile Caching**: Download and cache map tiles for offline use
- **Offline Indicators**: Visual indicators when using cached data
- **Cache Management**: Tools to download areas for offline use
- **Fallback Handling**: Graceful degradation when tiles unavailable

### 4. Offline Settings (`src/components/OfflineSettings.tsx`)

Comprehensive settings panel for offline functionality:

- **Storage Usage**: Display storage quota and usage statistics
- **Sync Status**: Current sync status and pending actions
- **Cache Management**: Clear cached data and manage storage
- **Preferences**: Configure offline behavior and auto-sync
- **Error Display**: Show and manage sync errors

## Integration Points

### 1. App Component (`src/App.tsx`)

- Initializes offline storage on app start
- Sets up periodic cleanup of old data
- Integrates ServiceWorkerProvider for PWA functionality

### 2. Headers (`src/components/DesktopHeader.tsx`, `src/components/MobileNav.tsx`)

- Added OfflineIndicator to show connection status
- Compact indicators that don't interfere with existing UI

### 3. Settings Page (`src/pages/Settings.tsx`)

- Integrated OfflineSettings component
- Provides comprehensive offline management interface

## Safari Compatibility

Enhanced Safari support for better Nostr protocol handling:

- **Shorter Timeouts**: 4-6 seconds instead of 10+ seconds
- **Retry Logic**: Multiple attempts across different relays
- **Direct WebSocket Management**: Bypasses complex pooling
- **Graceful Degradation**: Returns partial results instead of failures

## Testing

Comprehensive test setup with mocks for:

- **IndexedDB**: Full IndexedDB API mocking for tests
- **Service Workers**: Cache API and storage mocking
- **Network Status**: Navigator online/offline simulation
- **Storage Quota**: Storage estimation API mocking

## Usage Examples

### Basic Offline-First Data Fetching

```typescript
import { useOfflineFirst } from '@/hooks/useOfflineStorage';

function MyComponent() {
  const { data, isLoading } = useOfflineFirst(
    ['my-data'],
    () => fetchOnlineData(),
    () => getCachedData(),
    { fallbackToOffline: true }
  );
  
  return <div>{data}</div>;
}
```

### Manual Sync Trigger

```typescript
import { useOfflineSync } from '@/hooks/useOfflineStorage';

function SyncButton() {
  const { forceSync, status } = useOfflineSync();
  
  return (
    <button 
      onClick={forceSync}
      disabled={status.isSyncing || !status.isOnline}
    >
      {status.isSyncing ? 'Syncing...' : 'Sync Now'}
    </button>
  );
}
```

### Offline Action Queueing

```typescript
import { useOfflineSync } from '@/hooks/useOfflineStorage';

function CreateGeocacheForm() {
  const { queueAction } = useOfflineSync();
  
  const handleSubmit = async (data) => {
    await queueAction('publish_event', { event: data });
    // Action will be synced when online
  };
}
```

## Performance Considerations

- **Lazy Loading**: Offline components only load when needed
- **Efficient Caching**: Geographic bounds-based caching for maps
- **Background Sync**: Non-blocking sync operations
- **Storage Limits**: Automatic cleanup and storage management
- **Batch Operations**: Efficient bulk data operations

## Security

- **Data Validation**: All cached data is validated before use
- **Secure Storage**: Uses browser's secure IndexedDB storage
- **Privacy**: No sensitive data cached without user consent
- **Cleanup**: Automatic removal of old/expired data

## Future Enhancements

Potential improvements for future versions:

1. **Conflict Resolution**: Advanced conflict resolution for simultaneous edits
2. **Selective Sync**: User-controlled sync of specific data types
3. **Compression**: Data compression for larger cached datasets
4. **Background Fetch**: Use Background Fetch API for large downloads
5. **Push Sync**: Background sync triggered by push notifications

## Troubleshooting

Common issues and solutions:

1. **Storage Full**: App automatically cleans old data and shows storage usage
2. **Sync Failures**: Retry logic with exponential backoff and error reporting
3. **IndexedDB Unavailable**: Graceful fallback to memory-only operation
4. **Network Issues**: Offline-first approach ensures app remains functional

This implementation provides a robust foundation for offline functionality while maintaining excellent user experience both online and offline.