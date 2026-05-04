# Changelog

## [2.1.2] - 2026-05-04

### Added
- Mojave theme — a new Pip-Boy-inspired look with amber-on-black palette, matching map tiles, and themed cache icons
- Ditto links in the About page footer and navigation menu for folks who want to learn more about the relay

### Changed
- Radius search is smoother on mobile with a refined control and tighter mobile navigation
- Map zooms deeper than before, falling back from satellite to standard imagery past zoom 20 so you can keep zeroing in on the hide
- Tapping a treasure card in the adventure sidebar now focuses the map on that treasure
- Log comments are optional — leave a quick "found it" without typing anything if you're in a hurry
- Creating a cache surfaces inline validation as you fill out step 2, so you know what's missing before you hit next
- Claim page flexibility improvements: the scanner camera stays hidden until you open it, and the flow adapts better to different device capabilities
- MyCaches refresh, Settings reload, and better skeleton layouts while things are loading
- Radar empty state is clearer when no caches are nearby
- Compass overlay, profile counts, and map controls have larger tap targets and better accessibility labels
- Form fields across the app use proper mobile keyboards (numeric, email, URL) and announce errors to screen readers
- Save and login buttons give clearer feedback while submitting
- Error pages, 404s, and PWA update prompts are friendlier and more accessible
- Map popup preview images load through the image proxy for faster, more reliable thumbnails
- Settings theme picker is laid out in rows instead of a cramped grid

### Fixed
- Image uploads on the create-cache form handle size limits, concurrent uploads, and publish gating more reliably
- Posting a new log updates the log list immediately instead of waiting for a round trip

## [2.1.1] - 2026-05-03

### Added
- In-app QR scanner on the claim page — tap to scan the geocache QR code directly without leaving the app; opens automatically on supported mobile devices

### Changed
- Adventure descriptions are now tappable: tap to read the full text in a popup instead of having it cut off

### Fixed
- QR code download and print on the Android app now work correctly
- Map controls no longer clip below the safe area in iPad landscape mode
- Hero logo no longer clips into the navigation bar in iPad landscape mode

## [2.1.0] - 2026-05-02

### Added
- Collapsible sidebar on the map and adventure detail pages — collapse it to get a full-screen map view, expand it any time with one tap
- Earth view button on the map: tap to zoom out to a globe perspective and fly back to the world
- Animated fly-to when tapping Near Me or switching views — the map smoothly pans and zooms instead of jumping
- Download nudge on the home page for mobile browsers, pointing to the Android app on Zapstore

### Changed
- Sharing a geocache now uses the system share sheet on supported devices instead of an in-app dialog
- Tablets now use the mobile layout, which fits the screen much better than the desktop sidebar layout

### Fixed
- QR code download and print on Android no longer silently fail
- Hero logo no longer gets clipped on very large screens
- Grass footer decoration no longer clips or overflows on ultrawide displays

## [2.0.6] - 2026-04-28

### Added
- Privacy setting to opt out of anonymous analytics collection

### Fixed
- Confirmation message now appears when your account key is saved to the Documents folder during sign-up
- Notifications appear correctly above dialogs and modals
- Compass text is easier to read in low-contrast situations

## [2.0.5] - 2026-04-25

### Fixed
- Key save during account creation no longer hangs on Android

## [2.0.4] - 2026-04-25

### Changed
- New account key is saved to your device's password manager (Google Password Manager, iCloud Keychain, or browser credential store) instead of downloading a text file; falls back to file save on de-Googled devices and unsupported browsers

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
