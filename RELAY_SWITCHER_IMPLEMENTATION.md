# Relay Switcher Implementation

This document describes the implementation of the relay switcher component adapted from the mkstack repository.

## Overview

The relay switcher allows users to select and switch between different Nostr relays for the Treasures application. This implementation follows the patterns established in the mkstack repository while preserving Treasures' existing theme handling.

## Components Added

### 1. App Context System
- **`src/contexts/AppContext.ts`** - Defines the application context interface
- **`src/components/AppProvider.tsx`** - Provides app configuration with localStorage persistence
- **`src/hooks/useAppContext.ts`** - Hook to access app context
- **`src/hooks/useLocalStorage.ts`** - Generic localStorage hook
- **`src/hooks/useRelayConfig.ts`** - Convenience hook for relay configuration

### 2. Relay Selector Component
- **`src/components/RelaySelector.tsx`** - Main relay selector component
- **`src/components/ui/command.tsx`** - Command palette component (added dependency)

### 3. Updated Components
- **`src/components/NostrProvider.tsx`** - Updated to use app context for relay configuration
- **`src/components/DesktopHeader.tsx`** - Added RelaySelector to header
- **`src/components/MobileNav.tsx`** - Added RelaySelector to mobile navigation
- **`src/pages/Settings.tsx`** - Updated to use new RelaySelector instead of old relay management
- **`src/App.tsx`** - Integrated AppProvider and removed old relay management

### 4. Configuration Updates
- **`src/lib/constants.ts`** - Added PRESET_RELAYS configuration
- **Package dependencies** - Added `cmdk` for command palette functionality

## Key Features

### Relay Selection
- Dropdown interface with preset relays (Ditto, Nostr.Band, Damus, Primal, nos.lol, Snort)
- Search functionality to filter relays
- Custom relay URL input with validation
- Automatic URL normalization (adds wss:// prefix if missing)

### Data Persistence
- Relay selection persists in localStorage under `treasures:app-config`
- Cross-tab synchronization for configuration changes
- Graceful fallback to default relay if localStorage is corrupted

### Integration Points
- **Header**: Desktop header shows relay selector in navigation
- **Mobile**: Mobile navigation sheet includes relay selector
- **Settings**: Settings page shows current relay and allows switching
- **NostrProvider**: Automatically uses selected relay for all Nostr operations

## Architecture Decisions

### Single Relay Approach
Following mkstack's pattern, the app uses a single primary relay for queries but publishes to multiple relays:
- **Queries**: Use only the selected relay
- **Publishing**: Use selected relay + up to 4 preset relays (capped at 5 total)

### Theme Handling Preserved
The existing theme system using `next-themes` is preserved and not integrated into the app context, maintaining separation of concerns.

### Backward Compatibility
- Old relay configuration functions remain available but are not used by the new system
- Existing hooks and components continue to work without modification
- Migration is transparent to users

## Usage Examples

### Basic Usage
```tsx
import { RelaySelector } from '@/components/RelaySelector';

function MyComponent() {
  return <RelaySelector className="w-[200px]" />;
}
```

### Accessing Current Relay
```tsx
import { useRelayConfig } from '@/hooks/useRelayConfig';

function MyComponent() {
  const { relayUrl, setRelayUrl } = useRelayConfig();
  
  return (
    <div>
      <p>Current relay: {relayUrl}</p>
      <button onClick={() => setRelayUrl('wss://new.relay.com')}>
        Switch Relay
      </button>
    </div>
  );
}
```

### Using App Context
```tsx
import { useAppContext } from '@/hooks/useAppContext';

function MyComponent() {
  const { config, updateConfig, presetRelays } = useAppContext();
  
  return (
    <div>
      <p>Relay: {config.relayUrl}</p>
      <p>Available presets: {presetRelays?.length}</p>
    </div>
  );
}
```

## Testing

Tests are included for:
- **RelaySelector component** - Rendering and basic functionality
- **useAppContext hook** - Configuration management and error handling
- **Integration** - Provider setup and context access

Run tests with:
```bash
npx vitest run src/tests/RelaySelector.test.tsx src/tests/useAppContext.test.tsx
```

## Configuration

### Default Relay
The default relay is set to `wss://ditto.pub/relay` (same as before).

### Preset Relays
Six preset relays are available:
1. Ditto (`wss://ditto.pub/relay`)
2. Nostr.Band (`wss://relay.nostr.band`)
3. Damus (`wss://relay.damus.io`)
4. Primal (`wss://relay.primal.net`)
5. nos.lol (`wss://nos.lol`)
6. Snort (`wss://relay.snort.social`)

### Storage Key
Configuration is stored in localStorage under `treasures:app-config`.

## Migration Notes

### From Old System
- Users' existing relay preferences are not automatically migrated
- The app will start with the default relay (Ditto)
- Users can manually select their preferred relay using the new selector

### Future Considerations
- The old relay configuration system (`src/lib/relayConfig.ts`) can be removed once all references are updated
- Additional relay validation could be added
- Relay health monitoring could be implemented
- User-defined relay lists could be supported

## Performance Impact

- Minimal bundle size increase (~15KB for cmdk dependency)
- localStorage operations are optimized with error handling
- Query cache is reset when relay changes to ensure data consistency
- No impact on existing Nostr operations or data fetching patterns