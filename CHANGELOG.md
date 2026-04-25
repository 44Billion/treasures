# Changelog

## [2.0.3] - 2026-04-25

### Added
- Haptic feedback on key interactions: compass proximity alerts, publish confirmations, save toggles, share actions, map pin drops, and verified reveals

### Changed
- Splash screen uses original brand colors instead of plain white

### Fixed
- Status bar icons now match the theme when the device is in system dark mode
- "Near me" location marker no longer appears as a white dot on the map

## [2.0.2] - 2026-04-25

### Changed
- Status bar icons adapt dynamically when scrolling past the hero section
- Ditto profile themes correctly trigger light or dark status bar icons

### Fixed
- Status bar no longer stays white-on-white after navigating away from hero pages
- Adventure detail pages with dark themes now show light status bar icons
- Deep linking for treasures.to URLs (Digital Asset Links)
- Zapstore repository URL and icon format

## [2.0.1] - 2026-04-24

### Fixed
- Hero treasure name sits above bottom safe area on notched devices
- Left navigation drawer respects bottom safe area
- Toast notifications clear top safe area
- Map and adventure pages no longer hidden behind mobile nav bar
- Left nav highlights only the active tab (map vs list)
- Loading spinner centers correctly without scroll overflow
- Tapping adventure name bar expands the detail drawer

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
