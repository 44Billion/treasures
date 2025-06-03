# Unified Nostr Client System

This document describes the new unified Nostr client system that replaces Safari-specific workarounds and provides a robust, consistent interface for all Nostr operations.

## Overview

The unified system consists of:

1. **`UnifiedNostrClient`** - Core client class with robust relay management
2. **`useUnifiedNostr` hooks** - React hooks for queries and publishing
3. **Automatic browser optimization** - No manual Safari detection needed
4. **Connection pooling** - Efficient WebSocket management
5. **Comprehensive error handling** - Graceful degradation and retry logic

## Key Features

### ✅ Browser Agnostic
- Automatically detects browser capabilities
- Optimizes timeouts and batch sizes per browser
- No more Safari-specific code paths

### ✅ Robust Error Handling
- Built-in retry logic with exponential backoff
- Graceful degradation when relays fail
- Detailed error reporting and recovery

### ✅ Performance Optimized
- Connection pooling and reuse
- Intelligent batching for multiple queries
- Automatic deduplication of events

### ✅ Developer Friendly
- Simple, consistent API
- TypeScript support with full type safety
- Comprehensive testing and documentation

## Quick Start

### Basic Query

```typescript
import { useNostrQuery } from '@/hooks/useUnifiedNostr';

function MyComponent() {
  const { data: result, isLoading, error } = useNostrQuery(
    ['my-events'],
    [{ kinds: [1], limit: 20 }],
    { timeout: 8000 }
  );

  const events = result?.events || [];
  
  return (
    <div>
      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      {events.map(event => <div key={event.id}>{event.content}</div>)}
    </div>
  );
}
```

### Publishing Events

```typescript
import { useNostrPublish } from '@/hooks/useUnifiedNostr';

function PublishComponent() {
  const { mutateAsync: publish, isPending } = useNostrPublish();

  const handlePublish = async () => {
    try {
      const result = await publish({
        event: {
          kind: 1,
          content: 'Hello Nostr!',
          tags: [['t', 'greeting']],
        },
        options: {
          relays: ['wss://relay.damus.io'],
          requireMinSuccess: 1,
        },
        invalidateQueries: [['my-events']], // Auto-refresh related data
      });
      
      console.log('Published:', result.event.id);
    } catch (error) {
      console.error('Publish failed:', error);
    }
  };

  return (
    <button onClick={handlePublish} disabled={isPending}>
      {isPending ? 'Publishing...' : 'Publish'}
    </button>
  );
}
```

### Batch Queries

```typescript
import { useNostrBatchQuery } from '@/hooks/useUnifiedNostr';

function BatchComponent() {
  const filterGroups = [
    [{ kinds: [1], authors: ['pubkey1'], limit: 10 }],
    [{ kinds: [1], authors: ['pubkey2'], limit: 10 }],
    [{ kinds: [1], authors: ['pubkey3'], limit: 10 }],
  ];

  const { data: events, isLoading } = useNostrBatchQuery(
    ['batch-events'],
    filterGroups,
    { timeout: 10000 }
  );

  return (
    <div>
      {isLoading ? 'Loading...' : `Found ${events?.length || 0} events`}
    </div>
  );
}
```

## Advanced Usage

### Custom Relay Configuration

```typescript
import { useNostrClient } from '@/hooks/useUnifiedNostr';

function RelayManager() {
  const client = useNostrClient();

  const addRelay = (url: string) => {
    const current = client.getRelays();
    client.setRelays([...current, url]);
  };

  const removeRelay = (url: string) => {
    const current = client.getRelays();
    client.setRelays(current.filter(r => r !== url));
  };

  return (
    <div>
      <h3>Current Relays:</h3>
      {client.getRelays().map(relay => (
        <div key={relay}>
          {relay}
          <button onClick={() => removeRelay(relay)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
```

### Direct Client Usage

```typescript
import { getNostrClient } from '@/lib/nostrClient';

async function directQuery() {
  const client = getNostrClient();
  
  const result = await client.query(
    [{ kinds: [1], limit: 10 }],
    {
      timeout: 5000,
      retryCount: 2,
      requireMinResults: 5,
      deduplicateBy: 'id',
    }
  );

  console.log(`Found ${result.events.length} events`);
  console.log(`Sources:`, result.sources);
  console.log(`Errors:`, result.errors);
  console.log(`Duration: ${result.duration}ms`);
}
```

### Publishing with Verification

```typescript
import { getNostrClient } from '@/lib/nostrClient';

async function publishWithVerification(signedEvent) {
  const client = getNostrClient();
  
  const result = await client.publish(signedEvent, {
    timeout: 8000,
    retryCount: 2,
    requireMinSuccess: 2, // Must succeed on at least 2 relays
    verifyPublication: true, // Query back to verify
    relays: [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
    ],
  });

  console.log(`Published to ${result.successfulRelays.length} relays`);
  if (result.failedRelays.size > 0) {
    console.warn('Failed relays:', result.failedRelays);
  }
}
```

## Configuration Options

### Query Options

```typescript
interface NostrQueryOptions {
  timeout?: number;           // Query timeout in ms (default: 8000, Safari: 5000)
  retryCount?: number;        // Number of retries (default: 2, Safari: 1)
  signal?: AbortSignal;       // Abort signal for cancellation
  relays?: string[];          // Custom relay list
  requireMinResults?: number; // Minimum required results
  deduplicateBy?: 'id' | 'content' | 'none'; // Deduplication strategy
}
```

### Publish Options

```typescript
interface NostrPublishOptions {
  timeout?: number;           // Publish timeout in ms
  retryCount?: number;        // Number of retries
  signal?: AbortSignal;       // Abort signal for cancellation
  relays?: string[];          // Custom relay list
  requireMinSuccess?: number; // Minimum successful publishes required
  verifyPublication?: boolean; // Query back to verify (default: true, Safari: false)
}
```

## Migration from Old System

### Before (Safari-specific)

```typescript
// ❌ Old pattern with Safari workarounds
import { isSafari, createSafariNostr } from '@/lib/safariNostr';

function useOldQuery() {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['data', isSafari()],
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

### After (Unified)

```typescript
// ✅ New unified pattern
import { useNostrQuery } from '@/hooks/useUnifiedNostr';

function useNewQuery() {
  return useNostrQuery(
    ['data'],
    [filter],
    { timeout: 8000 } // Automatically optimized for all browsers
  );
}
```

## Error Handling

The unified system provides comprehensive error handling:

```typescript
const { data, error, isError } = useNostrQuery(['events'], [filter]);

if (isError) {
  // Error types:
  // - Network timeouts
  // - Relay connection failures
  // - Insufficient results
  // - Abort signals
  console.error('Query failed:', error.message);
}
```

## Performance Monitoring

```typescript
const { data: result } = useNostrQuery(['events'], [filter]);

if (result) {
  console.log(`Query completed in ${result.duration}ms`);
  console.log(`Events from sources:`, result.sources);
  console.log(`Relay errors:`, result.errors);
}
```

## Testing

The system includes comprehensive tests:

```bash
npm run test
```

Tests cover:
- Query operations across browsers
- Publish operations with various configurations
- Error handling and retry logic
- Connection pooling and cleanup
- Browser-specific optimizations

## Best Practices

### 1. Use Appropriate Timeouts
```typescript
// Short-lived queries
useNostrQuery(['quick'], [filter], { timeout: 3000 });

// Complex queries
useNostrQuery(['complex'], [filter], { timeout: 15000 });
```

### 2. Handle Loading States
```typescript
const { data, isLoading, error } = useNostrQuery(['events'], [filter]);

if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
return <EventList events={data?.events || []} />;
```

### 3. Optimize Batch Operations
```typescript
// Instead of multiple individual queries
const filterGroups = authors.map(author => 
  [{ kinds: [1], authors: [author], limit: 10 }]
);

useNostrBatchQuery(['author-events'], filterGroups);
```

### 4. Use Query Invalidation
```typescript
const { mutateAsync: publish } = useNostrPublish();

await publish({
  event: { kind: 1, content: 'Hello' },
  invalidateQueries: [
    ['events'],           // Refresh event lists
    ['user-profile'],     // Refresh user data
  ],
});
```

## Troubleshooting

### Common Issues

1. **Slow queries on Safari**
   - The system automatically uses shorter timeouts for Safari
   - No action needed - optimization is automatic

2. **Relay connection failures**
   - Check relay URLs are correct and online
   - System will retry failed connections automatically

3. **Events not appearing immediately**
   - Use query invalidation after publishing
   - Consider using optimistic updates

4. **Memory leaks**
   - Connection pool automatically cleans up old connections
   - Call `cleanup()` on app shutdown if needed

### Debug Mode

Enable debug logging:

```typescript
// In development
localStorage.setItem('nostr-debug', 'true');

// Check console for detailed logs
```

## Future Enhancements

- Real-time subscriptions with automatic reconnection
- Intelligent relay selection based on performance
- Offline queue with automatic sync
- Advanced caching strategies
- Metrics and performance monitoring