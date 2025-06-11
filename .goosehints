# Project Overview

This project is a Nostr client application built with React 18.x, TailwindCSS 3.x, Vite, shadcn/ui, and Nostrify.

## Technology Stack

- **React 18.x**: Stable version of React with hooks, concurrent rendering, and improved performance
- **TailwindCSS 3.x**: Utility-first CSS framework for styling
- **Vite**: Fast build tool and development server
- **shadcn/ui**: Unstyled, accessible UI components built with Radix UI and Tailwind
- **Nostrify**: Nostr protocol framework for Deno and web
- **React Router**: For client-side routing
- **TanStack Query**: For data fetching, caching, and state management
- **TypeScript**: For type-safe JavaScript development

## Project Structure

- `/src/components/`: UI components including NostrProvider for Nostr integration
- `/src/features/{feature}/hooks/`: Custom hooks including `useNostr` for Nostr operations, as categorized by feature (i.e., geocache, geocache found/comment logs, auth, etc.)
- `/src/pages/`: Page components used by React Router
- `/src/features/{feature}/lib/`: Utility functions and shared logic, as categorzied by feature
- `/public/`: Static assets

## Core data flow

All operations within this application go through common, shared data stores within the following paths:

 - `/src/shared/stores/` - The main store context path
 - `/src/shared/stores/useAuthorStore.ts` - Geocache creator and log author storage
 - `/src/shared/stores/useGeocacheStore.ts` - Core geocache information used for cards, details, listings, edits, etc
 - `/src/shared/stores/useLogStore.ts` - Core geocachge log information for both found (including verified found logs) and other log types (dnf, note, maintenance, archived)
 - `/src/shared/stores/useOfflineStore.ts` - All storage functions related to offline mode.

 **IMPORTANT** - All core actions that involve presenting, creating, editing, reading, or deleting data related to any of these items (i.e., CRUD) should go through these paths. NEVER create an altherate route that serves or manipulates core data.

## UI Components

The project uses shadcn/ui components located in `@/components/ui`. These are unstyled, accessible components built with Radix UI and styled with Tailwind CSS. Available components include:

- **Accordion**: Vertically collapsing content panels
- **Alert**: Displays important messages to users
- **AlertDialog**: Modal dialog for critical actions requiring confirmation
- **AspectRatio**: Maintains consistent width-to-height ratio
- **Avatar**: User profile pictures with fallback support
- **Badge**: Small status descriptors for UI elements
- **Breadcrumb**: Navigation aid showing current location in hierarchy
- **Button**: Customizable button with multiple variants and sizes
- **Calendar**: Date picker component 
- **Card**: Container with header, content, and footer sections
- **Carousel**: Slideshow for cycling through elements
- **Chart**: Data visualization component
- **Checkbox**: Selectable input element
- **Collapsible**: Toggle for showing/hiding content
- **Command**: Command palette for keyboard-first interfaces
- **ContextMenu**: Right-click menu component
- **Dialog**: Modal window overlay
- **Drawer**: Side-sliding panel
- **DropdownMenu**: Menu that appears from a trigger element
- **Form**: Form validation and submission handling
- **HoverCard**: Card that appears when hovering over an element
- **InputOTP**: One-time password input field
- **Input**: Text input field
- **Label**: Accessible form labels
- **Menubar**: Horizontal menu with dropdowns
- **NavigationMenu**: Accessible navigation component
- **Pagination**: Controls for navigating between pages
- **Popover**: Floating content triggered by a button
- **Progress**: Progress indicator
- **RadioGroup**: Group of radio inputs
- **Resizable**: Resizable panels and interfaces
- **ScrollArea**: Scrollable container with custom scrollbars
- **Select**: Dropdown selection component
- **Separator**: Visual divider between content
- **Sheet**: Side-anchored dialog component
- **Sidebar**: Navigation sidebar component
- **Skeleton**: Loading placeholder
- **Slider**: Input for selecting a value from a range
- **Sonner**: Toast notification manager
- **Switch**: Toggle switch control
- **Table**: Data table with headers and rows
- **Tabs**: Tabbed interface component
- **Textarea**: Multi-line text input
- **Toast**: Toast notification component
- **ToggleGroup**: Group of toggle buttons
- **Toggle**: Two-state button
- **Tooltip**: Informational text that appears on hover

These components follow a consistent pattern using React's `forwardRef` and use the `cn()` utility for class name merging. Many are built on Radix UI primitives for accessibility and customized with Tailwind CSS.

## Nostr Protocol Integration

This project uses a simplified and unified approach to Nostr integration using only the `@nostrify/react` library.

### The `useNostr` Hook

The `useNostr` hook returns an object containing a `nostr` property, with `.query()` and `.event()` methods for querying and publishing Nostr events respectively. This is the ONLY way to interact with Nostr in this project.

```typescript
import { useNostr } from '@nostrify/react';

function useCustomHook() {
  const { nostr } = useNostr();

  // ...
}
```

### Query Nostr Data with `useNostr` and TanStack Query

When querying Nostr, the best practice is to create custom hooks that combine `useNostr` and `useQuery` to get the required data.

```typescript
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { TIMEOUTS } from '@/lib/constants';

function usePosts() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['posts'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([{ kinds: [1], limit: 20 }], { signal });
      return events; // these events could be transformed into another format
    },
  });
}
```

**Important**: Always use `TIMEOUTS.QUERY` from constants for consistent timeout handling across all browsers.

The data may be transformed into a more appropriate format if needed, and multiple calls to `nostr.query()` may be made in a single queryFn.

### Single Relay Configuration

This project uses a single relay for simplicity:
- **Primary relay**: `wss://ditto.pub/relay`
- Configuration is handled automatically by the `NostrProvider`
- No manual relay management needed in individual hooks

### The `useAuthor` Hook

To display profile data for a user by their Nostr pubkey (such as an event author), use the `useAuthor` hook.

```tsx
import { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';

function Post({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const metadata: NostrMetadata | undefined = author.data?.metadata;

  const displayName = metadata?.name || event.pubkey.slice(0, 8);
  const profileImage = metadata?.picture;

  // ...render elements with this data
}
```

#### `NostrMetadata` type

```ts
/** Kind 0 metadata. */
interface NostrMetadata {
  /** A short description of the user. */
  about?: string;
  /** A URL to a wide (~1024x768) picture to be optionally displayed in the background of a profile screen. */
  banner?: string;
  /** A boolean to clarify that the content is entirely or partially the result of automation, such as with chatbots or newsfeeds. */
  bot?: boolean;
  /** An alternative, bigger name with richer characters than `name`. `name` should always be set regardless of the presence of `display_name` in the metadata. */
  display_name?: string;
  /** A bech32 lightning address according to NIP-57 and LNURL specifications. */
  lud06?: string;
  /** An email-like lightning address according to NIP-57 and LNURL specifications. */
  lud16?: string;
  /** A short name to be displayed for the user. */
  name?: string;
  /** An email-like Nostr address according to NIP-05. */
  nip05?: string;
  /** A URL to the user's avatar. */
  picture?: string;
  /** A web URL related in any way to the event author. */
  website?: string;
}
```

### The `useNostrPublish` Hook

To publish events, use the `useNostrPublish` hook in this project.

```tsx
import { useState } from 'react';

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from '@/hooks/useNostrPublish';

export function MyComponent() {
  const [ data, setData] = useState<Record<string, string>>({});

  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();

  const handleSubmit = () => {
    createEvent({ kind: 1, content: data.content });
  };

  if (!user) {
    return <span>You must be logged in to use this form.</span>;
  }

  return (
    <form onSubmit={handleSubmit} disabled={!user}>
      {/* ...some input fields */}
    </form>
  );
}
```

The `useCurrentUser` hook should be used to ensure that the user is logged in before they are able to publish Nostr events.

### Nostr Login

To enable login with Nostr, simply use the `LoginArea` component already included in this project.

```tsx
import { LoginArea } from "@/components/auth/LoginArea";

function MyComponent() {
  return (
    <div>
      {/* other components ... */}

      <LoginArea />
    </div>
  );
}
```

The `LoginArea` component displays a "Log in" button when the user is logged out, and changes to an account switcher once the user is logged in. It handles all the login-related UI and interactions internally, including displaying login dialogs and switching between accounts. It should not be wrapped in any conditional logic.

### `npub`, `naddr`, and other Nostr addresses

Nostr defines a set identifiers in NIP-19. Their prefixes:

- `npub`: public keys
- `nsec`: private keys
- `note`: note ids
- `nprofile`: a nostr profile
- `nevent`: a nostr event
- `naddr`: a nostr replaceable event coordinate
- `nrelay`: a nostr relay (deprecated)

NIP-19 identifiers include a prefix, the number "1", then a base32-encoded data string.

#### Use in Filters

The base Nostr protocol uses hex string identifiers when filtering by event IDs and pubkeys. Nostr filters only accept hex strings.

```ts
// ❌ Wrong: naddr is not decoded
const events = await nostr.query(
  [{ ids: [naddr] }],
  { signal }
);
```

Corrected example:

```ts
// Import nip19 from nostr-tools
import { nip19 } from 'nostr-tools';

// Decode a NIP-19 identifier
const decoded = nip19.decode(value);

// Optional: guard certain types (depending on the use-case)
if (decoded.type !== 'naddr') {
  throw new Error('Unsupported Nostr identifier');
}

// Get the addr object
const naddr = decoded.data;

// ✅ Correct: naddr is expanded into the correct filter
const events = await nostr.query(
  [{
    kinds: [naddr.kind],
    authors: [naddr.pubkey],
    '#d': [naddr.identifier],
  }],
  { signal }
);
```

### Nostr Edit Profile

To include an Edit Profile form, place the `EditProfileForm` component in the project:

```tsx
import { EditProfileForm } from "@/components/EditProfileForm";

function EditProfilePage() {
  return (
    <div>
      {/* you may want to wrap this in a layout or include other components depending on the project ... */}

      <EditProfileForm />
    </div>
  );
}
```

The `EditProfileForm` component displays just the form. It requires no props, and will "just work" automatically.

### Uploading Files on Nostr

Use the `useUploadFile` hook to upload files.

```tsx
import { useUploadFile } from "@/hooks/useUploadFile";

function MyComponent() {
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();

  const handleUpload = async (file: File) => {
    try {
      // Provides an array of NIP-94 compatible tags
      // The first tag in the array contains the URL
      const [[_, url]] = await uploadFile(file);
      // ...use the url
    } catch (error) {
      // ...handle errors
    }
  };

  // ...rest of component
}
```

To attach files to kind 1 events, each file's URL should be appended to the event's `content`, and an `imeta` tag should be added for each file. For kind 0 events, the URL by itself can be used in relevant fields of the JSON content.

### Nostr Encryption and Decryption

The logged-in user has a `signer` object (matching the NIP-07 signer interface) that can be used for encryption and decryption.

```ts
// Get the current user
const { user } = useCurrentUser();

// Optional guard to check that nip44 is available
if (!user.signer.nip44) {
  throw new Error("Please upgrade your signer extension to a version that supports NIP-44 encryption");
}

// Encrypt message to self
const encrypted = await user.signer.nip44.encrypt(user.pubkey, "hello world");
// Decrypt message to self
const decrypted = await user.signer.nip44.decrypt(user.pubkey, encrypted) // "hello world"
```

### Rendering Kind 1 Text

If you need to render kind 1 text, use the `NoteContent` component:

```tsx
import { NoteContent } from "@/components/NoteContent";

export function Post(/* ...props */) {
  // ...

  return (
    <CardContent className="pb-2">
      <div className="whitespace-pre-wrap break-words">
        <NoteContent event={post} className="text-sm" />
      </div>
    </CardContent>
  );
}
```

## Data Management and Performance Optimization

### Enhanced Data Management System

This project includes an advanced data management system with smart prefetching, background polling, and cache invalidation to optimize performance.

#### Core Data Management Hooks

**`useDataManager`** - Main hook for coordinated data management:
```tsx
import { useDataManager } from '@/hooks/useDataManager';

function MyComponent() {
  const dataManager = useDataManager({
    enablePolling: true,
    enablePrefetching: true,
    priorityGeocaches: ['geocache-id-1', 'geocache-id-2'], // Optional priority list
  });

  const { geocaches, isLoading, refreshAll, getStatus } = dataManager;
  
  return (
    <div>
      <button onClick={refreshAll}>Refresh All Data</button>
      {/* Use geocaches data */}
    </div>
  );
}
```

**`usePrefetchManager`** - Advanced prefetching capabilities:
```tsx
import { usePrefetchManager } from '@/hooks/usePrefetchManager';

function MyComponent() {
  const prefetchManager = usePrefetchManager({
    enableBackgroundPolling: true,
    enablePrefetching: true,
    priorityGeocaches: ['important-cache-1'],
  });

  // Trigger manual prefetch
  const handlePrefetch = () => {
    prefetchManager.triggerPrefetch(['specific-geocache-id']);
  };

  return <button onClick={handlePrefetch}>Prefetch Data</button>;
}
```

**`useGeocachePrefetch`** - Simple prefetching for components:
```tsx
import { useGeocachePrefetch } from '@/hooks/usePrefetchManager';

function GeocacheCard({ geocache }) {
  const { prefetchGeocache } = useGeocachePrefetch();

  useEffect(() => {
    // Prefetch logs when geocache becomes visible
    prefetchGeocache(geocache);
  }, [geocache, prefetchGeocache]);

  return <div>{/* geocache content */}</div>;
}
```

#### Polling and Background Updates

The system automatically:
- Polls for new geocaches every 60 seconds
- Polls for new logs every 30 seconds  
- Validates cached data every 5 minutes
- Checks for deletion events every 2 minutes
- Prefetches logs for the top 5 geocaches
- Prefetches author metadata for active geocaches

#### Performance Optimizations

**Smart Query Configuration:**
- Automatic background polling with configurable intervals
- Increased query limits for better caching (`QUERY_LIMITS.GEOCACHES`, `QUERY_LIMITS.LOGS`)
- Longer cache retention times (15 minutes for logs, 10 minutes for geocaches)
- Background prefetching that doesn't block the UI

**Cache Management:**
- Automatic cache invalidation for deleted events
- Smart prefetching based on user activity
- Priority-based prefetching for important geocaches
- Efficient background synchronization

#### Constants for Consistent Timing

Always use constants from `@/lib/constants`:

```ts
import { TIMEOUTS, POLLING_INTERVALS, QUERY_LIMITS } from '@/lib/constants';

// Polling intervals
POLLING_INTERVALS.GEOCACHES         // 60000ms - 1 minute
POLLING_INTERVALS.LOGS              // 30000ms - 30 seconds  
POLLING_INTERVALS.DELETION_EVENTS   // 120000ms - 2 minutes
POLLING_INTERVALS.BACKGROUND_SYNC   // 300000ms - 5 minutes
POLLING_INTERVALS.FAST_UPDATES      // 15000ms - 15 seconds
POLLING_INTERVALS.SLOW_UPDATES      // 600000ms - 10 minutes

// Query limits for better caching
QUERY_LIMITS.GEOCACHES              // 100 geocaches
QUERY_LIMITS.LOGS                   // 200 logs

// Timeouts
TIMEOUTS.QUERY                      // 8000ms - standard query timeout
TIMEOUTS.FAST_QUERY                 // 3000ms - quick operations
```

#### Cache Invalidation

The system automatically handles:
- **Deletion Events**: Monitors NIP-09 deletion events and removes cached data
- **Data Validation**: Periodically validates cached geocaches against the relay
- **Cleanup**: Removes invalid or deleted entries from local storage
- **Sync Conflicts**: Resolves conflicts between cached and relay data

#### Best Practices for Data Management

1. **Use the unified hooks**: Prefer `useDataManager` over individual query hooks for optimal performance
2. **Set priority geocaches**: Specify `priorityGeocaches` for data that needs immediate availability
3. **Enable background polling**: Keep `enablePolling: true` for real-time updates
4. **Leverage prefetching**: Use `enablePrefetching: true` to preload related data
5. **Handle offline states**: The system automatically pauses polling when offline

#### Integration Example

```tsx
import { useDataManager } from '@/hooks/useDataManager';

function CacheListPage() {
  // Get the current route to determine priority caches
  const { geocacheId } = useParams();
  const priorityCaches = geocacheId ? [geocacheId] : [];

  const dataManager = useDataManager({
    enablePolling: true,
    enablePrefetching: true, 
    priorityGeocaches: priorityCaches,
  });

  const { geocaches, isLoading, refreshAll } = dataManager;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <button onClick={refreshAll}>Refresh</button>
      {geocaches.map(cache => (
        <GeocacheCard key={cache.id} geocache={cache} />
      ))}
    </div>
  );
}
```

#### Testing Data Management Features

All data management hooks should be thoroughly tested. Tests are located in `src/tests/` and use Vitest with React Testing Library.

**Test Coverage Requirements:**
- Unit tests for each hook (`useDataManager`, `usePrefetchManager`, `useCacheInvalidation`)
- Integration tests for hook coordination
- Performance tests for large datasets and background operations
- Error handling and edge case scenarios
- Offline behavior and network failure recovery

**Example test structure:**
```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDataManager } from '@/hooks/useDataManager';

describe('useDataManager', () => {
  it('should handle priority geocaches correctly', async () => {
    const { result } = renderHook(() => 
      useDataManager({ priorityGeocaches: ['cache-1'] })
    );
    
    await waitFor(() => {
      const status = result.current.getStatus();
      expect(status.prefetchStatus.totalGeocaches).toBeGreaterThan(0);
    });
  });
});
```

**Run tests with:**
```bash
npm run test  # Full test suite including data management tests
```

**When to add new tests:**
- Adding any new hook or component
- Modifying existing data management logic
- Adding new error handling paths
- Performance optimizations or caching changes
- Bug fixes (test the bug scenario first)

**Test organization in `src/tests/`:**
- `*.test.tsx` - Component and hook tests
- `*.integration.test.tsx` - Multi-hook integration tests  
- `*.performance.test.tsx` - Performance and load tests
- `testUtils.ts` - Shared test utilities and mocks
- `setup.ts` - Test environment configuration

## Development Practices

### Code Quality and Testing

- **Test-Driven Development**: All new features must include comprehensive tests
- **Test Coverage**: Maintain high test coverage for critical functionality like data management
- **No Debug/Demo Pages**: Avoid creating temporary debug or demo pages. Use tests to validate functionality instead - DO NOT CREATE DEBUG PAGES.
- **Performance Testing**: Include performance tests for data-heavy operations
- **Integration Testing**: Test how components work together, not just in isolation

### Testing Guidelines

**Before implementing a new feature:**
1. Write tests first (TDD approach)
2. Test error cases and edge conditions  
3. Test offline/online state changes
4. Test performance with large datasets
5. Test integration with existing systems

### Debugging Best Practices

**Recommended debugging approaches:**
1. **Use React DevTools** for component state inspection
2. **Use TanStack Query DevTools** for cache and query inspection  
3. **Browser Network Tab** for Nostr relay communication
4. **Console logging** in development mode (remove before production)
5. **Unit tests** to isolate and test specific functionality
6. **Integration tests** to debug complex interactions

**Avoid these debugging anti-patterns:**
- ❌ Creating temporary debug/demo pages or routes
- ❌ Adding debug UI components that aren't removed
- ❌ Console logging in production builds
- ❌ Hardcoded test data in production components
- ❌ Bypass of error handling for debugging


**Example debugging setup:**
```tsx
// ✅ Good: Test complex scenarios
it('should handle rapid status changes', async () => {
  const { result } = renderHook(() => useDataManager());
  // Test the actual bug scenario
});

// ❌ Bad: Debug page
function DebugPage() {
  return <div>Debug info...</div>; // Don't create these
}
```

### Architecture and Patterns

- Uses React Query for data fetching and caching
- Follows shadcn/ui component patterns
- Implements Path Aliases with `@/` prefix for cleaner imports
- Uses Vite for fast development and production builds
- Component-based architecture with React hooks
- Single relay configuration for simplicity and reliability

## Build & Deployment

### Deployment to Production Server
This project is configured for fast deployment to a production server using Caddy file serving:

- **Quick deploy**: `npm run deploy` - Builds locally and syncs files to server (~15 seconds)
- **Debug mode**: `npm run deploy:debug` - Verbose logging for troubleshooting
- **Live URL**: https://treasures.to

#### Deployment Process
The deployment is optimized for speed and simplicity:
1. Builds locally with `npm run build` (catches errors early)
2. Syncs built files directly to server using rsync
3. Configures Caddy for static file serving with automatic SSL
4. Atomic file switching for zero-downtime updates
5. Automatic backup creation for easy rollback

#### Server Configuration
- Uses Caddy container for static file serving and automatic SSL
- Files served from `/opt/treasures/current/` on the server
- Automatic gzip compression and security headers
- Health endpoint at `/health` for monitoring

#### Favicon Setup
The project includes comprehensive favicon support:
- `favicon.ico` - Standard ICO format for older browsers
- `icon.svg` - Modern SVG favicon
- `favicon-16x16.png` and `favicon-32x32.png` - PNG fallbacks
- `apple-touch-icon.png` - iOS home screen icon
- `icon-192x192.png` and `icon-512x512.png` - PWA manifest icons

All favicon files are automatically copied from `/public` to `/dist` during build.

## Testing Your Changes

### Focused Testing Approach

**Only run tests related to your immediate scope of work.** This saves time and focuses validation on what you're actually changing.

#### For Component/Hook Changes
If you're modifying a specific component or hook, run only its tests:

```bash
# Test a specific file
npx vitest run src/tests/welcome-modal.test.tsx

# Test files matching a pattern
npx vitest run src/tests/*modal*

# Test a specific component
npx vitest run --grep "WelcomeModal"
```

#### For Build/Type Issues
If you need to check TypeScript or build issues:

```bash
# TypeScript checking only
npx tsc -p tsconfig.app.json --noEmit

# Build only
npm run build

# Linting only
npx eslint src/
```

#### When to Run Full Test Suite
Only run the full test suite (`npm run test`) when:
- Making changes that affect multiple systems
- Before final deployment
- When explicitly requested
- When you're unsure of the scope of impact

#### Quick Validation Commands
```bash
# Quick syntax/type check
npx tsc --noEmit

# Quick build test
npx vite build

# Test specific functionality
npx vitest run --grep "your-feature"
```

**Testing Philosophy:**
- Write tests before implementing features (TDD)
- Test error conditions and edge cases thoroughly  
- Avoid creating debug/demo pages - use tests to validate functionality
- Include performance tests for data-intensive operations
- Test offline scenarios and network failures
- Integration tests are as important as unit tests
- **Focus testing on your immediate scope of work**
- **NEVER DELETE TEST FILES** unless they are deprecated (broken AND unfixable)
- Test files are valuable documentation and regression prevention
- Keep test files even after feature completion for future maintenance

## Common TypeScript Issues

### Fixing `@typescript-eslint/no-explicit-any` Errors
Replace `any` types with proper TypeScript types:

```ts
// ❌ Wrong
function handleData(data: any) {
  return data.someProperty;
}

// ✅ Correct
function handleData(data: Record<string, unknown>) {
  const obj = data as { someProperty?: string };
  return obj.someProperty;
}

// For API responses
function handleApiResponse(response: unknown) {
  const data = response as Record<string, unknown>;
  return {
    name: data.name as string,
    value: data.value as number,
  };
}

// For error handling
catch (error: unknown) {
  const errorObj = error as { message?: string };
  console.error(errorObj.message || 'Unknown error');
}
```

## UI Component Best Practices

### LoginArea Component
- Automatically handles login state
- Use `compact` prop for smaller spaces: `<LoginArea compact />`
- **Don't use `w-full`** in headers - let it size naturally
- For centered placement: wrap in `<div className="flex justify-center">`

### Responsive Design
- Use TailwindCSS responsive prefixes: `md:block`, `lg:grid-cols-3`
- Hidden on mobile, shown on desktop: `hidden md:block`
- Mobile-first approach: base styles for mobile, prefix for larger screens

### shadcn/ui Components
- All components use `forwardRef` pattern
- Use `cn()` utility for conditional classes
- Built on Radix UI primitives for accessibility
- Customizable through Tailwind CSS classes

## Nostr Development Tips

### Event Publishing
- Always handle signing errors gracefully
- Provide user feedback during event creation
- Use AbortSignal with timeouts for network requests
- Use `TIMEOUTS.QUERY` constant for consistent timeouts

### Query Optimization
- Use TanStack Query for caching and state management
- Always use `AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)])` pattern
- Set appropriate `staleTime` and `cacheTime` for different data types
- Use `TIMEOUTS.QUERY` to prevent hanging requests

### Error Handling
```ts
import { TIMEOUTS } from '@/lib/constants';

// Robust error handling for Nostr operations
try {
  const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
  const events = await nostr.query([filter], { signal });
  
  // Verify publication if needed
  const verification = await nostr.query([{ ids: [event.id] }], { 
    signal: AbortSignal.timeout(TIMEOUTS.FAST_QUERY) 
  });
  if (verification.length === 0) {
    throw new Error('Event not found on relays');
  }
} catch (error: unknown) {
  const errorObj = error as { message?: string };
  if (errorObj.message?.includes('timeout')) {
    // Handle timeout
  } else if (errorObj.message?.includes('User rejected')) {
    // Handle user cancellation
  } else {
    // Handle other errors
  }
}
```

### Constants Usage
Always import and use constants from `@/lib/constants`:

```ts
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';

// Use TIMEOUTS.QUERY for all nostr queries
// Use TIMEOUTS.FAST_QUERY for quick operations
// Use QUERY_LIMITS.GEOCACHES, QUERY_LIMITS.LOGS etc for limits
```

### Forbidden Patterns
**Do NOT use these patterns:**

❌ Safari-specific code:
```ts
// These are REMOVED - do not use
import { isSafari } from '@/lib/safariNostr';
import { UnifiedNostrClient } from '@/lib/nostrClient';
import { useUnifiedNostr } from '@/hooks/useUnifiedNostr';
```

❌ Manual relay management:
```ts
// Don't manually specify relays
const relays = ['wss://relay1.com', 'wss://relay2.com'];
```

❌ Custom timeout logic:
```ts
// Use constants instead
const timeout = isSafari() ? 5000 : 8000; // ❌ Wrong
const timeout = TIMEOUTS.QUERY; // ✅ Correct
```

✅ **Always use this pattern:**
```ts
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { TIMEOUTS } from '@/lib/constants';

function useMyData() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['my-data'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([{ kinds: [1], limit: 20 }], { signal });
      return events;
    },
  });
}
```