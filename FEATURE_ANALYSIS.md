# Feature Boundary Analysis

## Identified Features

### 1. Authentication Feature
**Purpose**: User login, account management, and authentication state

**Components**:
- `src/components/auth/` (entire directory)
  - `AccountSwitcher.tsx`
  - `LoginArea.tsx`
  - `LoginDialog.tsx`
  - `SignupDialog.tsx`
  - `WelcomeModal.tsx`
- `src/components/LoginRequiredCard.tsx`
- `src/components/EditProfileForm.tsx`
- `src/components/ProfileDialog.tsx`
- `src/components/ProfileHeader.tsx`

**Hooks**:
- `useCurrentUser.ts`
- `useLoginActions.ts`
- `useLoggedInAccounts.ts`
- `useAuthor.ts`
- `useNip05Verification.ts`
- `useRegenerateVerificationKey.ts`

**Utils/Lib**:
- `src/lib/verification.ts`
- `src/lib/security.ts`

**Pages**:
- `src/pages/Profile.tsx`

### 2. Geocache Feature
**Purpose**: Core geocaching functionality - creating, viewing, managing geocaches

**Components**:
- `src/components/GeocacheDialog.tsx`
- `src/components/GeocacheList.tsx`
- `src/components/CacheMenu.tsx`
- `src/components/FilterButton.tsx`
- `src/components/ShareDialog.tsx`
- `src/components/ui/geocache-card.tsx`
- `src/components/ui/geocache-form.tsx`
- `src/components/ui/difficulty-terrain-rating.tsx`
- `src/components/ui/hint-display.tsx`
- `src/components/ui/comparison-filter.tsx`

**Hooks**:
- `useGeocache.ts`
- `useGeocaches.ts`
- `useGeocacheByNaddr.ts`
- `useGeocacheStats.ts`
- `useGeocacheNavigation.ts`
- `useCreateGeocache.ts`
- `useEditGeocache.ts`
- `useDeleteGeocache.ts`
- `useBatchDeleteGeocaches.ts`
- `useUserGeocaches.ts`
- `useUserFoundCaches.ts`
- `useSavedCaches.ts`
- `useNostrSavedCaches.ts`
- `useOptimisticGeocaches.ts`
- `useReliableProximitySearch.ts`

**Utils/Lib**:
- `src/lib/geocache-utils.ts`
- `src/lib/geocache-constants.ts`
- `src/lib/nip-gc.ts`
- `src/lib/cacheUtils.ts`
- `src/lib/cacheConstants.ts`
- `src/lib/cacheIcons.tsx`
- `src/lib/cacheManager.ts`
- `src/lib/cacheCleanup.ts`
- `src/lib/naddr-utils.ts`
- `src/lib/validation.ts`

**Pages**:
- `src/pages/CreateCache.tsx`
- `src/pages/CacheDetail.tsx`
- `src/pages/MyCaches.tsx`
- `src/pages/Claim.tsx`

### 3. Logging Feature
**Purpose**: Creating and managing geocache logs/finds

**Components**:
- `src/components/LogList.tsx`
- `src/components/LogsSection.tsx`
- `src/components/VerifiedLogForm.tsx`
- `src/components/VerificationQRDialog.tsx`
- `src/components/RegenerateQRDialog.tsx`

**Hooks**:
- `useGeocacheLogs.ts`
- `useCreateLog.ts`
- `useCreateVerifiedLog.ts`
- `useDeleteLog.ts`

**Utils/Lib**:
- `src/lib/osmVerification.ts`

### 4. Map Feature
**Purpose**: Map display, location services, and geographic functionality

**Components**:
- `src/components/GeocacheMap.tsx`
- `src/components/OfflineMap.tsx`
- `src/components/LocationPicker.tsx`
- `src/components/LocationSearch.tsx`
- `src/components/LocationWarnings.tsx`
- `src/components/MapStyleSelector.tsx`

**Hooks**:
- `useGeolocation.ts`

**Utils/Lib**:
- `src/lib/geo.ts`
- `src/lib/coordinates.ts`
- `src/lib/coordinateUtils.ts`
- `src/lib/mapIcons.ts`
- `src/lib/ipGeolocation.ts`

**Pages**:
- `src/pages/Map.tsx`

### 5. Offline Feature
**Purpose**: Offline functionality, storage, and sync

**Components**:
- `src/components/OfflineIndicator.tsx`
- `src/components/OfflineSettings.tsx`

**Hooks**:
- `useOfflineStorage.ts`
- `useOfflineStorageInfo.ts`
- `useOfflineGeocaches.ts`
- `useConnectivity.ts`
- `useStorageConfig.ts`

**Utils/Lib**:
- `src/lib/offlineStorage.ts`
- `src/lib/offlineSync.ts`
- `src/lib/storageConfig.ts`
- `src/lib/connectivityChecker.ts`
- `src/lib/networkUtils.ts`

### 6. PWA Feature
**Purpose**: Progressive Web App functionality

**Components**:
- `src/components/PWASettings.tsx`
- `src/components/PWAUpdateNotification.tsx`

**Hooks**:
- `usePWAInstall.ts`
- `usePWAUpdate.ts`

**Pages**:
- `src/pages/Install.tsx`

### 7. Relay Feature
**Purpose**: Nostr relay management and configuration

**Components**:
- `src/components/RelayCombobox.tsx`
- `src/components/RelayErrorFallback.tsx`
- `src/components/RelaySelector.tsx`
- `src/components/RelayStatusIndicator.tsx`
- `src/components/PublishTroubleshooter.tsx`

**Hooks**:
- `useRelayConfig.ts`
- `useRelayStatus.ts`

**Utils/Lib**:
- `src/lib/relayConfig.ts`
- `src/lib/relays.ts`

## Shared/Common Components

### UI Components (to move to `src/shared/components/ui/`)
- All of `src/components/ui/` except geocache-specific ones

### Layout Components (to move to `src/shared/components/layout/`)
- `src/components/layout/`
- `src/components/DesktopHeader.tsx`
- `src/components/MobileNav.tsx`
- `src/components/ScrollToTop.tsx`

### Common Components (to move to `src/shared/components/`)
- `src/components/common/`
- `src/components/BlurredImage.tsx`
- `src/components/ImageGallery.tsx`
- `src/components/DeleteConfirmationDialog.tsx`
- `src/components/SaveButton.tsx`
- `src/components/ThemeProvider.tsx`
- `src/components/ThemeToggle.tsx`

### App-Level Components (to move to `src/app/providers/`)
- `src/components/AppProvider.tsx`
- `src/components/NostrProvider.tsx`

## Shared Hooks (to move to `src/shared/hooks/`)
- `useAppContext.ts`
- `useAsyncAction.ts`
- `useAsyncOperation.ts`
- `useForm.ts`
- `useIsMobile.tsx`
- `useLocalStorage.ts`
- `useTheme.ts`
- `useToast.ts`
- `useUploadFile.ts`
- `useDeleteWithConfirmation.ts`

## Data Management Hooks (need consolidation)
- `useDataManager.ts`
- `usePrefetchManager.ts`
- `useCacheInvalidation.ts`
- `useCacheManager.ts`
- `usePerformanceOptimization.ts`
- `useDeletionFilter.ts`

## Shared Utils (to move to `src/shared/utils/`)
- `src/lib/utils.ts`
- `src/lib/constants.ts`
- `src/lib/date.ts`
- `src/lib/errorUtils.ts`
- `src/lib/performance.ts`
- `src/lib/lruCache.ts`
- `src/lib/deletionFilter.ts`

## Nostr-Specific (to move to `src/shared/nostr/`)
- `useNostr.ts`
- `useNostrPublish.ts`

## Static Pages (to move to `src/app/pages/`)
- `src/pages/Home.tsx`
- `src/pages/About.tsx`
- `src/pages/Settings.tsx`
- `src/pages/NotFound.tsx`

## Feature Dependencies

### High Coupling:
- **Geocache ↔ Logging**: Logs belong to geocaches
- **Geocache ↔ Map**: Geocaches are displayed on maps
- **Auth ↔ All Features**: Most features require authentication

### Medium Coupling:
- **Offline ↔ Geocache**: Offline storage of geocaches
- **Offline ↔ Map**: Offline map tiles
- **Relay ↔ All Features**: All features use Nostr relays

### Low Coupling:
- **PWA ↔ Other Features**: Mostly independent
- **Logging ↔ Map**: Minimal interaction

## Migration Priority

1. **Authentication** (foundational, affects everything)
2. **Map** (core functionality, moderate complexity)
3. **Geocache** (most complex, depends on auth and map)
4. **Logging** (depends on geocache)
5. **Offline** (can be done in parallel with others)
6. **PWA** (independent, low priority)
7. **Relay** (affects all features, but can be done last)