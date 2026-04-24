# Changelog

## [2.0.0] - 2026-04-24

### Added
- Android app with native splash screen, deep links, and status bar theming
- Wind Waker-style compass navigation with radar mode, GPS tracking, and "Treasure Nearby" detection
- Adventures — curated geocache collections with immersive full-page browsing and map integration
- Profile search for finding other users
- Search bar on the map with relay-powered full-text search
- Smart coordinate input that accepts degrees-minutes-seconds, decimal, and other common formats
- Encrypted drafts for treasure creation so unfinished caches are saved securely
- Drag-to-reorder images when uploading photos
- Curated treasures showcase in the hero section with real images, authors, and locations
- Internationalization for 200+ UI strings across English, German, Japanese, and Thai
- Profile theme sync — import colors, fonts, and backgrounds from your Nostr profile
- Paste button on the claim page URL input
- "How It Works" steps on the landing page with rotating photo gallery
- FAQ comparing Treasures to traditional geocaching services
- Mobile menu redesign with unified profile and navigation drawer
- Globe view as default map perspective
- Auto-triggered radius search when the map loads
- Skip-to-create shortcut for treasure owners on the loading page

### Changed
- Redesign the home hero with large centered logo, responsive layout, and curated treasure cards
- Redesign QR codes with branded styling and improved print layout
- Redesign the verified find experience and signup flow
- Streamline treasure creation with two-path landing, fewer steps, and smart draft saving
- Redesign blog pages to match the site's visual language
- Redesign About page with single-card layout and tighter copy
- Polish map popup cards for small screens and adventure theme readability
- Improve compass error handling with separate sensor and GPS diagnostics
- Improve map and list performance with lazy loading, virtualization, and image proxy
- Optimize hero images with local pre-compressed WebP instead of remote fetches
- Rebrand terminology to treasures, finders, and hide throughout the app
- Full-screen compass overlay on all devices
- Dismiss map popups by tapping outside instead of close button
- Compact mobile UI for distance search with an "All" distance option

### Fixed
- Mobile image upload now correctly prompts for camera vs media picker
- Compass updates reliably as the user moves on mobile
- Map popup cards no longer break when clicking between listings
