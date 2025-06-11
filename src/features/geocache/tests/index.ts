// Geocache feature tests
// This directory contains all tests related to geocache functionality

// Core utility tests
export * from './cacheIcons.test';
export * from './cacheIntegration.test';
export * from './cacheManager.test';

// Component tests
export * from './geocache-form.test';

// Hook tests
export * from './useGeocacheByNaddr.test';

// Integration tests (may require additional mocking for page-level components)
// These tests are preserved but may need updates for full integration testing
// - cache-detail-layout.test.tsx
// - cache-link-routing.test.tsx
// - cache-menu-mobile-scroll.test.tsx
// - cache-menu-navigation.test.tsx
// - cache-menu-url-generation.test.tsx
// - geocache-offline-fix.test.tsx
// - geocache-stats.test.tsx
// - qr-regeneration-cache-fix.test.tsx
// - saved-caches-simple.test.tsx
// - saved-caches-verification.test.tsx
// - saved-caches.test.tsx