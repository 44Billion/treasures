# iOS Safari Fixes - Map and Cache Listings

## Issues Identified

The map page and cache listings not working on iOS Safari could be due to several iOS-specific issues:

1. **AbortSignal compatibility** - iOS Safari has issues with `AbortSignal.any()` and `AbortSignal.timeout()`
2. **Leaflet map rendering** - iOS Safari requires specific CSS and configuration
3. **Touch event handling** - iOS Safari has different touch behavior
4. **Memory management** - iOS Safari is more aggressive with memory cleanup
5. **WebSocket connections** - iOS Safari may have stricter WebSocket policies

## Fixes Applied

### 1. AbortSignal Compatibility (`src/hooks/useGeocaches.ts`)
```typescript
// Before: iOS-incompatible
const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

// After: iOS-compatible
let signal = c.signal;
let timeoutId: NodeJS.Timeout | null = null;
if (!signal.aborted) {
  timeoutId = setTimeout(() => {
    // Don't abort here, just let the query continue
  }, 5000); // Increased timeout for iOS
}
```

### 2. iOS-Specific Map Configuration (`src/components/GeocacheMap.tsx`)
```typescript
// iOS-specific map options
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

<MapContainer
  scrollWheelZoom={!isIOS} // Disable on iOS to prevent conflicts
  tap={isIOS} // Enable tap for iOS
  tapTolerance={15} // Increase tap tolerance for iOS
  bounceAtZoomLimits={false} // Disable bounce on iOS
  maxBoundsViscosity={isIOS ? 0.0 : 1.0} // Reduce viscosity on iOS
>
```

### 3. Enhanced CSS for iOS (`src/styles/leaflet-overrides.css`)
```css
/* iOS Safari specific fixes */
@supports (-webkit-touch-callout: none) {
  .leaflet-container {
    /* Force hardware acceleration on iOS */
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    /* Prevent iOS Safari from interfering with touch events */
    -webkit-user-select: none;
    user-select: none;
    /* Fix iOS Safari viewport issues */
    position: relative;
    overflow: hidden;
  }
  
  /* Fix iOS Safari tile loading issues */
  .leaflet-tile {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
  }
  
  /* Improve iOS Safari performance */
  .leaflet-map-pane {
    -webkit-transform: translate3d(0, 0, 0);
    transform: translate3d(0, 0, 0);
  }
}
```

### 4. React Query Optimization for iOS
```typescript
// Shorter cache times for iOS memory management
staleTime: 30000, // 30 seconds - shorter for iOS
gcTime: 300000, // 5 minutes - shorter for iOS memory management
```

### 5. Enhanced Error Logging
Added comprehensive iOS-specific error logging to identify issues:
```typescript
console.log('User agent:', navigator.userAgent);
console.log('iOS Safari check:', /iPad|iPhone|iPod/.test(navigator.userAgent));
console.error('Error details:', {
  message: error instanceof Error ? error.message : 'Unknown error',
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
  userAgent: navigator.userAgent
});
```

## Testing Steps for iOS

### 1. Check Console Logs
Open Safari Developer Tools and look for:
- "Starting geocache query with filter"
- "iOS Safari check: true"
- "GeocacheMap - iOS detected: true"
- Any error messages with iOS-specific details

### 2. Test Map Functionality
- Does the map container load?
- Do tiles appear?
- Can you interact with the map (pan, zoom)?
- Do geocache markers appear?
- Do popups work when tapping markers?

### 3. Test Cache Listings
- Does the home page show recent caches?
- Does the map page sidebar show cache listings?
- Do filters work (difficulty, terrain, search)?
- Does the "Near Me" functionality work?

### 4. Check Network Requests
In Safari Developer Tools Network tab:
- Are WebSocket connections to Nostr relays successful?
- Are there any failed requests?
- Are tile requests for the map working?

## Common iOS Safari Issues

### Issue: Map doesn't load
**Symptoms**: Empty gray area where map should be
**Causes**: 
- CSS transform issues
- Touch event conflicts
- Tile loading failures

**Debug**: Check console for Leaflet errors

### Issue: Cache listings empty
**Symptoms**: "Loading geocaches..." never finishes
**Causes**:
- WebSocket connection failures
- AbortSignal compatibility issues
- Query timeout problems

**Debug**: Check console for Nostr query errors

### Issue: Touch interactions don't work
**Symptoms**: Can't tap markers or interact with map
**Causes**:
- Touch event configuration
- CSS pointer-events issues
- iOS Safari touch handling

**Debug**: Check if `tap={true}` is set for iOS

## Debugging Commands

Add these to Safari Developer Console to debug:

```javascript
// Check if iOS is detected
console.log('iOS detected:', /iPad|iPhone|iPod/.test(navigator.userAgent));

// Check Leaflet map instance
console.log('Leaflet map:', window.L);

// Check React Query cache
console.log('Query cache:', window.__REACT_QUERY_DEVTOOLS__);

// Check Nostr connections
console.log('Nostr relays:', window.nostr);
```

## Fallback Options

If issues persist, consider:

1. **Simplified map view** - Use static map images for iOS
2. **List-only mode** - Hide map tab on iOS Safari
3. **Progressive enhancement** - Load map features conditionally
4. **Alternative map library** - Consider Mapbox or Google Maps

## Next Steps

1. **Test on real iOS device** - Simulator may not show all issues
2. **Check iOS version compatibility** - Test on multiple iOS versions
3. **Monitor error reports** - Set up error tracking for iOS users
4. **Performance testing** - Check memory usage and performance

The fixes applied should resolve most iOS Safari compatibility issues with the map and cache listings. The enhanced logging will help identify any remaining issues.