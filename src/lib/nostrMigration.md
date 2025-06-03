# Nostr Client Migration Guide

This guide explains how to migrate from the old Safari-specific and action-specific Nostr implementations to the new unified system.

## Overview

The new unified Nostr client system provides:

- **No browser-specific workarounds** - Automatically optimizes for all browsers
- **Robust error handling** - Built-in retry logic and graceful degradation
- **Connection pooling** - Efficient WebSocket management
- **Consistent API** - Same interface for all operations
- **Better performance** - Optimized batching and caching

## Migration Steps

### 1. Replace Safari-specific code

**Old pattern:**
```typescript
import { isSafari, createSafariNostr } from '@/lib/safariNostr';

if (isSafari()) {
  const safariClient = createSafariNostr(relays);
  const events = await safariClient.query([filter], { timeout: 5000 });
  safariClient.close();
} else {
  const events = await nostr.query([filter]);
}
```

**New pattern:**
```typescript
import { useNostrQuery } from '@/hooks/useUnifiedNostr';

const { data: result } = useNostrQuery(
  ['my-data'],
  [filter],
  { timeout: 5000 }
);
const events = result?.events || [];
```

### 2. Replace custom publish hooks

**Old pattern:**
```typescript
import { useNostrPublishToRelays } from '@/hooks/useNostrPublishToRelays';

const { mutateAsync: publishEvent } = useNostrPublishToRelays();
const event = await publishEvent({
  event: { kind: 1, content: 'hello' },
  options: { relays: ['wss://relay.example.com'] }
});
```

**New pattern:**
```typescript
import { useNostrPublish } from '@/hooks/useUnifiedNostr';

const { mutateAsync: publishEvent } = useNostrPublish();
const result = await publishEvent({
  event: { kind: 1, content: 'hello' },
  options: { relays: ['wss://relay.example.com'] },
  invalidateQueries: [['my-data']] // Automatically invalidate related queries
});
```

### 3. Replace manual relay management

**Old pattern:**
```typescript
import { useNostrQueryRelays } from './useNostrQueryRelays';

const { queryWithRelays } = useNostrQueryRelays();
const events = await queryWithRelays(filters, { relays: customRelays });
```

**New pattern:**
```typescript
import { useNostrQuery } from '@/hooks/useUnifiedNostr';

const { data: result } = useNostrQuery(
  ['my-data'],
  filters,
  { relays: customRelays }
);
```

### 4. Replace batch operations

**Old pattern:**
```typescript
const allEvents = [];
for (const filterGroup of filterGroups) {
  const events = await nostr.query(filterGroup);
  allEvents.push(...events);
}
```

**New pattern:**
```typescript
import { useNostrBatchQuery } from '@/hooks/useUnifiedNostr';

const { data: events } = useNostrBatchQuery(
  ['batch-data'],
  filterGroups
);
```

## Hook Migration Examples

### Example 1: Simple Query Hook

**Before:**
```typescript
export function useGeocaches() {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['geocaches', isSafari()],
    queryFn: async (c) => {
      if (isSafari()) {
        const safariClient = createSafariNostr(relays);
        try {
          const events = await safariClient.query([filter], { timeout: 5000 });
          safariClient.close();
          return events;
        } catch (error) {
          safariClient.close();
          throw error;
        }
      } else {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
        return await nostr.query([filter], { signal });
      }
    }
  });
}
```

**After:**
```typescript
export function useGeocaches() {
  return useNostrQuery(
    ['geocaches'],
    [{ kinds: [30001], '#t': ['geocache'], limit: 100 }],
    { timeout: 8000 } // Automatically optimized for all browsers
  );
}
```

### Example 2: Publish Hook

**Before:**
```typescript
export function useCreateGeocache() {
  const { mutateAsync: publishEvent } = useNostrPublishToRelays();
  
  return useMutation({
    mutationFn: async (data) => {
      const event = await publishEvent({
        event: { kind: 30001, content: data.content, tags: data.tags },
        options: { relays: data.relays }
      });
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    }
  });
}
```

**After:**
```typescript
export function useCreateGeocache() {
  return useNostrPublish();
}

// Usage:
const { mutateAsync: createGeocache } = useCreateGeocache();
const result = await createGeocache({
  event: { kind: 30001, content: data.content, tags: data.tags },
  options: { relays: data.relays },
  invalidateQueries: [['geocaches']] // Automatic invalidation
});
```

## Benefits of Migration

1. **Simplified Code**: Remove browser detection and conditional logic
2. **Better Performance**: Automatic optimization for all browsers and networks
3. **Robust Error Handling**: Built-in retry logic and graceful degradation
4. **Consistent Behavior**: Same behavior across all browsers and devices
5. **Easier Testing**: No need to mock Safari-specific behavior
6. **Future-Proof**: Easy to add new features like real-time subscriptions

## Migration Checklist

- [ ] Replace `isSafari()` checks with unified hooks
- [ ] Remove `safariNostr.ts` imports
- [ ] Update query hooks to use `useNostrQuery`
- [ ] Update publish hooks to use `useNostrPublish`
- [ ] Replace manual relay management with unified options
- [ ] Update batch operations to use `useNostrBatchQuery`
- [ ] Test on all browsers to ensure consistent behavior
- [ ] Remove old Safari-specific files after migration

## Files to Remove After Migration

- `src/lib/safariNostr.ts`
- `src/lib/nostrQuery.ts`
- `src/hooks/useNostrPublishToRelays.ts`
- `src/hooks/useNostrQueryRelays.ts`

## Testing

After migration, test the following scenarios:

1. **Query operations** on Safari, Chrome, Firefox, and mobile browsers
2. **Publish operations** with various relay configurations
3. **Error handling** with network timeouts and relay failures
4. **Performance** with large result sets and batch operations
5. **Offline behavior** and reconnection handling