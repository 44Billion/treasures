# Publish Error Handling

This document explains the improved error handling system for Nostr event publishing, designed to help users understand and resolve the frustrating "no promise in promise.any resolved" error and other publishing issues.

## Overview

The enhanced publishing system includes:

1. **Improved `useNostrPublish` hook** with better error messages and retry logic
2. **Relay status monitoring** to diagnose connection issues
3. **Interactive troubleshooting components** to guide users through fixes
4. **Automatic retry mechanism** for transient failures

## Components

### `useNostrPublish` Hook

The updated hook now provides:

- **Better error messages**: Translates cryptic errors like "no promise in promise.any resolved" into user-friendly messages
- **Automatic retries**: Attempts to publish up to 2 times with exponential backoff
- **Event verification**: Checks if the event was successfully published
- **Specific error handling**: Different handling for timeouts, relay failures, user cancellation, etc.

```tsx
import { useNostrPublish } from '@/hooks/useNostrPublish';

function MyComponent() {
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();

  const handlePublish = async () => {
    try {
      await publishEvent({ kind: 1, content: "Hello world!" });
      // Success!
    } catch (error) {
      // Error will now have a user-friendly message
      console.error(error.message); // e.g., "All relay connections failed. Please check your internet connection and try again."
    }
  };
}
```

### `useRelayStatus` Hook

Monitor the health of relay connections:

```tsx
import { useRelayHealth } from '@/hooks/useRelayStatus';

function MyComponent() {
  const { data: relayStatuses, health } = useRelayHealth();

  if (health.allRelaysDown) {
    return <div>All relays are down!</div>;
  }

  return (
    <div>
      {health.connectedRelays}/{health.totalRelays} relays connected
      Average latency: {Math.round(health.averageLatency)}ms
    </div>
  );
}
```

### `RelayStatusIndicator` Component

Shows relay connection status with optional details:

```tsx
import { RelayStatusIndicator } from '@/components/RelayStatusIndicator';

// Compact version for headers/status bars
<RelayStatusIndicator compact />

// Full version with details
<RelayStatusIndicator showDetails />
```

### `PublishTroubleshooter` Component

Interactive troubleshooting guide that appears when publishing fails:

```tsx
import { PublishTroubleshooter } from '@/components/PublishTroubleshooter';

function MyForm() {
  const [publishError, setPublishError] = useState<string | null>(null);
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();

  const handleSubmit = async (data) => {
    setPublishError(null);
    try {
      await publishEvent(data);
    } catch (error) {
      setPublishError(error.message);
    }
  };

  const handleRetry = () => {
    setPublishError(null);
    // Retry the submission
    handleSubmit(formData);
  };

  return (
    <div>
      {/* Your form */}
      
      {publishError && (
        <PublishTroubleshooter 
          error={publishError} 
          onRetry={handleRetry}
          isRetrying={isPending}
        />
      )}
    </div>
  );
}
```

## Error Types and Messages

The system now provides specific error messages for different failure scenarios:

### Relay Connection Failures
- **Original**: "no promise in promise.any resolved"
- **New**: "All relay connections failed. Please check your internet connection and try again."

### Timeouts
- **Original**: "timeout"
- **New**: "Connection timeout. Your event may have been published successfully."

### User Cancellation
- **Original**: "User rejected the request"
- **New**: "Event signing was cancelled."

### Authentication Issues
- **Original**: Various cryptic messages
- **New**: "No signer available. Please check your Nostr extension."

### Network Issues
- **Original**: "WebSocket connection failed"
- **New**: "Relay connection failed. Please check your internet connection and try again."

## Troubleshooting Steps

The `PublishTroubleshooter` component provides context-aware troubleshooting steps:

### For Relay Connection Failures:
1. Check your internet connection
2. Try refreshing the page
3. Wait a moment and try again - relays may be temporarily unavailable
4. Check if other Nostr apps are working

### For Timeouts:
1. Your internet connection may be slow
2. Try again - the event may have been published successfully
3. Check your network connection
4. Try refreshing the page if the issue persists

### For Authentication Issues:
1. Install a Nostr browser extension (like Alby, nos2x, or Flamingo)
2. Make sure the extension is enabled
3. Refresh the page after installing the extension
4. Check that the extension has permission to access this site

## Implementation Example

Here's how the `EditProfileForm` component was enhanced:

```tsx
export const EditProfileForm = ({ onSuccess }) => {
  const [publishError, setPublishError] = useState<string | null>(null);
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();

  const onSubmit = async (values) => {
    setPublishError(null); // Clear previous errors

    try {
      await publishEvent({
        kind: 0,
        content: JSON.stringify(values),
      });
      
      toast({ title: 'Success', description: 'Profile updated!' });
      onSuccess?.();
    } catch (error) {
      const errorMessage = error.message || 'Failed to update profile';
      setPublishError(errorMessage); // Set for troubleshooter
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleRetry = () => {
    setPublishError(null);
    form.handleSubmit(onSubmit)();
  };

  return (
    <Form>
      {/* Form fields */}
      
      {publishError && (
        <PublishTroubleshooter 
          error={publishError} 
          onRetry={handleRetry}
          isRetrying={isPending}
        />
      )}
    </Form>
  );
};
```

## Best Practices

1. **Always clear errors before retrying**: Set `publishError` to `null` before attempting to publish again
2. **Provide immediate feedback**: Show a toast notification for immediate user feedback
3. **Use the troubleshooter for complex errors**: Let users diagnose and fix issues themselves
4. **Handle retries gracefully**: Disable retry buttons during publishing to prevent multiple submissions
5. **Monitor relay health**: Use `RelayStatusIndicator` in your app's header or status area

## Testing

The error handling system can be tested by:

1. **Disconnecting from the internet** and trying to publish
2. **Cancelling the signing request** in your Nostr extension
3. **Using a slow network connection** to trigger timeouts
4. **Disabling your Nostr extension** to test authentication errors

The troubleshooter will provide appropriate guidance for each scenario.