# TypeScript Patterns and Guidelines

This document outlines the TypeScript patterns and conventions used throughout the Treasures application.

## Type Organization

### Directory Structure
```
src/shared/types/
├── index.ts          # Barrel exports
├── common.ts         # Common/generic types
├── nostr.ts          # Nostr-specific types
├── geocache.ts       # Geocache domain types
└── patterns.md       # This documentation
```

### Import Patterns
```typescript
// ✅ Preferred: Import from shared types barrel
import type { Geocache, GeocacheLog, ApiResponse } from '@/shared/types';

// ✅ Acceptable: Import specific type modules
import type { NostrEvent } from '@/shared/types/nostr';

// ❌ Avoid: Direct imports from external libraries in components
import type { NostrEvent } from '@nostrify/nostrify'; // Use shared types instead
```

## Common Type Patterns

### API Response Wrapper
```typescript
// ✅ Use ApiResponse wrapper for consistent API handling
interface ApiResponse<T = unknown> {
  data: T;
  error?: string;
  success: boolean;
}

// Usage in hooks
function useGeocaches(): UseQueryResult<ApiResponse<Geocache[]>> {
  // ...
}
```

### Error Handling
```typescript
// ✅ Use AppError for consistent error handling
interface AppError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// Usage in error boundaries and hooks
catch (error: unknown) {
  const appError: AppError = {
    message: error instanceof Error ? error.message : 'Unknown error',
    code: 'UNKNOWN_ERROR',
    details: { originalError: error }
  };
}
```

### Form Props Pattern
```typescript
// ✅ Use FormFieldProps for consistent form components
interface FormFieldProps {
  fieldId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

// Extend for specific field types
interface SelectFieldProps extends FormFieldProps {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}
```

### Async State Pattern
```typescript
// ✅ Use AsyncState for consistent loading states
interface AsyncState<T = unknown> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

// Usage in components
function MyComponent() {
  const [state, setState] = useState<AsyncState<Geocache[]>>({
    data: null,
    loading: false,
    error: null
  });
}
```

## Nostr Type Patterns

### Event Handling
```typescript
// ✅ Use NostrEventTemplate for creating events
interface NostrEventTemplate {
  kind: NostrKind | number;
  content: string;
  tags?: NostrTag[];
  created_at?: number;
}

// Usage in publish hooks
function useCreateGeocache() {
  const createEvent = (data: GeocacheFormData): NostrEventTemplate => ({
    kind: NostrKind.Geocache,
    content: JSON.stringify(data),
    tags: [['d', data.name]]
  });
}
```

### Query Parameters
```typescript
// ✅ Use NostrQueryParams for consistent query handling
interface NostrQueryParams {
  filters: NostrFilter[];
  signal?: AbortSignal;
  timeout?: number;
}

// Usage in data hooks
function useGeocaches(params: NostrQueryParams) {
  // ...
}
```

## Component Prop Patterns

### Generic Component Props
```typescript
// ✅ Use generic props for reusable components
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  loading?: boolean;
  error?: AppError;
  emptyMessage?: string;
}

function List<T>({ items, renderItem, loading, error, emptyMessage }: ListProps<T>) {
  // ...
}
```

### Event Handler Props
```typescript
// ✅ Use specific event handler types
interface ButtonProps {
  onClick: EventHandler<React.MouseEvent<HTMLButtonElement>>;
  onKeyDown?: EventHandler<React.KeyboardEvent<HTMLButtonElement>>;
}

// ✅ Use generic callback types
interface DialogProps {
  onClose: Callback<void>;
  onConfirm: AsyncCallback<boolean>;
}
```

## Hook Return Type Patterns

### Query Hooks
```typescript
// ✅ Return structured objects from hooks
interface UseGeocachesReturn {
  geocaches: Geocache[];
  loading: boolean;
  error: AppError | null;
  refetch: () => void;
  hasMore: boolean;
  loadMore: () => void;
}

function useGeocaches(): UseGeocachesReturn {
  // ...
}
```

### Mutation Hooks
```typescript
// ✅ Return mutation functions with proper typing
interface UseCreateGeocacheReturn {
  createGeocache: (data: GeocacheFormData) => Promise<Geocache>;
  loading: boolean;
  error: AppError | null;
  reset: () => void;
}

function useCreateGeocache(): UseCreateGeocacheReturn {
  // ...
}
```

## Utility Type Patterns

### Partial Updates
```typescript
// ✅ Use Partial for update operations
type GeocacheUpdate = Partial<Pick<Geocache, 'name' | 'description' | 'status'>>;

function updateGeocache(id: string, updates: GeocacheUpdate) {
  // ...
}
```

### Omit for Form Data
```typescript
// ✅ Use Omit to exclude generated fields from form data
type GeocacheFormData = Omit<Geocache, 'id' | 'createdAt' | 'updatedAt' | 'event'>;
```

### Pick for Minimal Data
```typescript
// ✅ Use Pick for minimal data representations
type GeocacheListItem = Pick<Geocache, 'id' | 'name' | 'coordinates' | 'difficulty' | 'terrain'>;
```

## Validation Patterns

### Type Guards
```typescript
// ✅ Create type guards for runtime validation
function isGeocache(obj: unknown): obj is Geocache {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'coordinates' in obj
  );
}

// Usage
if (isGeocache(data)) {
  // data is now typed as Geocache
  console.log(data.name);
}
```

### Validation Results
```typescript
// ✅ Use ValidationResult for form validation
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function validateGeocache(data: GeocacheFormData): ValidationResult {
  const errors: string[] = [];
  
  if (!data.name.trim()) {
    errors.push('Name is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

## Error Handling Patterns

### Try-Catch with Type Safety
```typescript
// ✅ Handle errors with proper typing
async function fetchGeocache(id: string): Promise<Geocache | null> {
  try {
    const response = await api.get(`/geocaches/${id}`);
    return response.data;
  } catch (error: unknown) {
    const appError: AppError = {
      message: error instanceof Error ? error.message : 'Failed to fetch geocache',
      code: 'FETCH_ERROR',
      details: { geocacheId: id, originalError: error }
    };
    throw appError;
  }
}
```

### Optional Chaining and Nullish Coalescing
```typescript
// ✅ Use optional chaining for safe property access
function getGeocacheName(geocache: Geocache | null | undefined): string {
  return geocache?.name ?? 'Unknown Cache';
}

// ✅ Use nullish coalescing for default values
function getGeocacheDescription(geocache: Geocache): string {
  return geocache.description ?? 'No description available';
}
```

## Performance Patterns

### Memoization with Types
```typescript
// ✅ Use proper typing with React.memo
interface GeocacheCardProps {
  geocache: Geocache;
  onClick: (geocache: Geocache) => void;
}

const GeocacheCard = React.memo<GeocacheCardProps>(({ geocache, onClick }) => {
  // ...
});
```

### Callback Memoization
```typescript
// ✅ Use useCallback with proper typing
function GeocacheList({ geocaches }: { geocaches: Geocache[] }) {
  const handleGeocacheClick = useCallback((geocache: Geocache) => {
    // Handle click
  }, []);
  
  return (
    <div>
      {geocaches.map(geocache => (
        <GeocacheCard
          key={geocache.id}
          geocache={geocache}
          onClick={handleGeocacheClick}
        />
      ))}
    </div>
  );
}
```

## Testing Patterns

### Mock Types
```typescript
// ✅ Create mock factories for testing
function createMockGeocache(overrides: Partial<Geocache> = {}): Geocache {
  return {
    id: 'test-id',
    name: 'Test Cache',
    description: 'Test description',
    coordinates: { latitude: 0, longitude: 0 },
    difficulty: 1,
    terrain: 1,
    size: 'regular',
    type: 'traditional',
    status: 'active',
    ownerPubkey: 'test-pubkey',
    createdAt: Date.now(),
    ...overrides
  };
}
```

### Type Assertions in Tests
```typescript
// ✅ Use type assertions carefully in tests
test('should return geocache data', async () => {
  const result = await fetchGeocache('test-id');
  
  expect(result).toBeDefined();
  expect(isGeocache(result)).toBe(true);
  
  // Safe to assert after type guard
  const geocache = result as Geocache;
  expect(geocache.name).toBe('Test Cache');
});
```

## Migration Guidelines

### Gradual Type Adoption
1. Start with `unknown` instead of `any`
2. Add type guards for runtime validation
3. Create interfaces for complex objects
4. Use utility types for transformations
5. Add proper error handling

### Legacy Code Handling
```typescript
// ✅ Gradually improve legacy code
function legacyFunction(data: unknown): Geocache | null {
  // Add runtime validation
  if (!isGeocache(data)) {
    console.warn('Invalid geocache data:', data);
    return null;
  }
  
  return data;
}
```

## Best Practices Summary

1. **Always use `unknown` instead of `any`**
2. **Create type guards for runtime validation**
3. **Use utility types (Pick, Omit, Partial) for transformations**
4. **Prefer interfaces over types for object shapes**
5. **Use enums for fixed sets of values**
6. **Create shared types for common patterns**
7. **Document complex types with JSDoc comments**
8. **Use strict TypeScript settings**
9. **Handle errors with proper typing**
10. **Test type guards and validation functions**