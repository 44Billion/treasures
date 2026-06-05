# Changelog

## [2.6.0] - 2026-06-05

Treasure owners can now crown a First to Find winner straight from a log's menu — handy when someone clearly nabbed the find but never ran the verified-find flow. The map remembers exactly where you left it, so jumping back from a treasure no longer snaps you across the world, and your treasures now ride along in a local backup so they survive reloads and offline trips. KrakenM shows up with fresh artwork across the app, plus mobile fixes for directions, coordinate entry, and the edit bar.

### Added
- Owners can mark a finder as the First to Find winner from a log's menu, even when the finder never used the verified-find flow — the trophy badge and claim banner update to match
- Treasures and profiles are now mirrored to a local backup on your device, so they survive reloads and keep showing up when you're offline or the network hiccups
- Fresh KrakenM artwork across the Home, How To, Claim, and About screens

### Changed
- The map now remembers your zoom and position, so heading back to it after viewing a treasure keeps you right where you were
- Location locks are quieter and lean on your device's GPS first when you're offline
- The unlisted toggle now always appears in the treasure edit form, so you can flip a listing's visibility no matter its current state

### Fixed
- "Get directions" now prefills the destination correctly when opening OpenStreetMap
- Coordinate entry on mobile no longer fights your keyboard, making it easier to type and edit positions
- The edit bar on mobile now clears the safe-area inset instead of hiding behind it

The Treasure Trolls hunt in Oslo is live, and the Treasure Trolls landing page now says so. A pulsing "Live in Oslo Now" badge sits up top, and a new "Start the Hunt" button drops you straight into the adventure so you can start tracking down all ten trolls.

### Changed
- The Treasure Trolls landing page now shows a live event badge and a "Start the Hunt" button that links straight to the Oslo adventure

## [2.5.2] - 2026-05-29

A small polish release. There's a new in-app Changelog page so you can see what's new in Treasures without leaving the app, reachable from the explore menu and the mobile nav. Treasure cards also got a light touch-up: the author avatar now sits next to the name (matching the map preview), and art treasures wear the same paint-palette glyph on cards that they already wear on the map.

### Added
- New in-app Changelog page that shows what's new in each release, linked from the explore menu and the mobile nav

### Changed
- Treasure cards now put the author avatar before the name (matching the map preview) and show the paint-palette glyph for art treasures, keeping cards and map markers consistent

## [2.5.1] - 2026-05-28

A round of map polish and lookup improvements. First to Find claims now show up for every seeker on the map and adventure lists, art treasures wear a paint-palette glyph on their map markers, the "near me" indicator is a theme-aware pulsing dot, and the treasure lookup screen surfaces the listing's author from the very first frame. There's also a new printable rules-card insert you can drop inside any treasure container.

### Added
- First to Find claims now show up for everyone — adventure progress lists and the map both mark a First to Find treasure as claimed once any seeker locks it in, with a trophy badge on the map pin so the race result is visible at a glance
- Art treasures wear a paint-palette glyph on the map, keeping the cache color and shape intact so the type still reads clearly
- Printable rules card insert for treasure boxes — a new option on the Create Treasure landing page prints a US-Letter sheet of ten business-card-sized inserts you can drop inside your containers, each with a four-step TL;DR for finders

### Changed
- The "near me" indicator on the map is now a soft pulsing dot that picks up your active theme across Forest, Steel, and Mojave, and honors reduced-motion preferences
- Cache lookup screens now show the listing's author up front, even before the listing finishes loading or when a treasure can't be found, so you always know whose hide you're looking at
- Cache lookup also reaches out across your own Nostr relays in addition to the defaults, with a tidier progress display that doesn't overflow when you carry a long relay list

### Fixed
- Compact treasure cards grow to fit multiple modifier badges instead of clipping them off the bottom
- Map "near me" pin renders correctly in browsers that previously clipped it to just the inner dot
- Removed the noisy "cache not found on any relay" banner — the not-found screen already says everything that needs saying

## [2.5.0] - 2026-05-27

A small but handy release for hiders working off-grid. If the relay can't be reached while you're creating a treasure, Treasures now quietly stashes your draft on your device and finishes the publish later — no more lost drafts on a shaky trail connection. Also fixes a crash when backing out of a listing with an open map popup.

### Added
- Offline draft rescue — start a treasure on a shaky trail connection and Treasures will quietly stash your draft on your device if the relay can't be reached. Your drafts show a "Not synced" badge until they make it to the network, and the next successful save cleans them up automatically

### Fixed
- Backing out to home from a treasure listing with an open map popup no longer crashes the app

## [2.4.0] - 2026-05-26

A big feature drop. Three brand-new treasure types — First to Find, Art, and Key Quest — give hiders new ways to design a hunt, with badges showing them off across cards, maps, and detail pages. Newcomers get a five-chapter illustrated walk-through at /how-to, and adventures now welcome first-time visitors with an inline sign-up overlay. Plus festive landing pages for the BOQM Austin hunt and the Treasure Trolls collaboration.

### Added
- **First to Find** — a new treasure type for one-shot prizes. The first verified finder gets the claim, with a banner on the listing showing who won and when. Cache owners can lock in the winner with one tap, archiving the treasure and making the claim tamper-proof
- **Art treasures** — mark a hide as an art piece so seekers know the treasure itself is the prize
- **Key Quest** — set a mission for your treasure that finders must complete before they can log a find. Verified finders submit their completion as a Good Deed, so the claim doubles as a public record of the deed
- **How To** — a new walk-through at `/how-to` that takes newcomers through signing up, finding, the compass, claiming, and hiding in five short illustrated chapters with inline sign-up
- **Adventure welcome overlay** — first-time visitors landing on an adventure get a friendly intro with Join, Log in, and "How does this work?" options without leaving the page
- **BOQM Austin** — a festive landing page at `/boqm` for the Treasures hunt at the Big Ole Queer Market (June 6-7, 2026), with a live countdown, a preview map of nearby treasures, ticket links, and a door-prize voucher for every Treasures account
- **Treasure Trolls teaser** — a colorful landing page at `/treasure-trolls` promoting the Treasure Trolls x BitPopArt collaboration with aurora effects and confetti
- Treasure type badges (First to Find, Art, Key Quest) appear on cards, map popups, and the detail page so you can spot special treasures at a glance
- User search in the compact URL tool — look up a Nostr profile by name and generate a short link for their npub without copy-pasting a 63-character key

### Changed
- Sign-up flow now keeps the welcome overlay open through profile setup, so the screen doesn't unmount mid-flow when you create your account from a landing page
- Mobile header Join button now sports a person-with-plus icon so it matches the inline sign-up calls on the How To page
- Claim banners on First to Find treasures show the winner's avatar and display name as a single profile link

### Fixed
- Printing QR sheets and stamps on the Android app now produces a real PDF instead of a blank preview, and prints at the right size with legible text
- Tapping a claim link while you're already on the claim screen no longer bounces you back when you try to navigate to Create a Treasure
- QR stamp sheets are now sharp and readable, with bigger cells, properly sized fonts, and direct rendering of every QR code

## [2.3.0] - 2026-05-10

Short links land — every treasure now has a tidy /d/<id> URL with a one-tap copy button, perfect for stickers and signs. Plus an auto-decoding hint reveal, Mojave theme support for adventures, a longer initial map load, and a basket of mobile and theme polish.

### Added
- Short links for every cache — a tidy `/d/<id>` URL shows up on the create flow and the cache detail page with a one-tap copy button, perfect for stickers, signs, and word-of-mouth shares
- Adventure deletion — adventure owners can now retire an adventure they no longer want listed
- Settings menu is now reachable from an adventure page so visitors can switch themes and tweak preferences without leaving the trail
- Auto-decode hints on reveal — old-school ROT13 hints unscramble automatically when you tap to peek, no decoder ring required
- Middle-click or Ctrl/Cmd-click a cache card to open the listing in a new tab
- Mojave theme is now an option for adventure styling, so adventure owners can match the Pip-Boy look
- Logged-out visitors on desktop can now find Settings right next to Explore, making it easy to pick a theme or language before signing in

### Changed
- Older caches now show up on the map — the initial load pages through up to 500 listings instead of stopping at 150
- Map clusters break apart sooner and tighter, so individual caches are easier to spot as you zoom in
- Cache cards without a photo now wear a subtle half-logo backdrop that adapts to your theme, instead of looking blank
- Map popups skip the photo strip entirely when there's nothing to show, keeping the preview compact
- Hint label and reveal button now follow your active theme instead of a hard-coded color
- Pasting on the Android app uses the native clipboard for snappier, more reliable behavior
- Map zoom controls share a single look across every map in the app
- The home page grass footer now sits flush with the bottom navigation bar on mobile

### Fixed
- Tapping a `/d/<id>` short link or `#verify=` claim URL on the Android app now opens the right page on cold and warm starts instead of bouncing through `localhost`
- QR codes render in flat brand green instead of a washed-out gradient, scanning more reliably from a distance
- Mojave and other custom themes no longer leak the default background through transparent areas
- Cache detail page no longer hides the city and state when location metadata is passed in directly
- Image uploads on the create-cache form give clearer feedback and the Join button now appears in the right place
- Map icons on the Mojave theme now pick up the correct amber tint

## [2.2.0] - 2026-05-04

Cache owners can now signal a treasure's status — mark a hide as Needs maintenance or Archived right from the edit form, and status badges show up across cards, listings, and the map filter so seekers always know the state of a treasure before they head out.

### Added
- Cache owners can now set a listing status — mark a hide as **Needs maintenance** or **Archived** directly from the edit form; the status is stored on the listing so seekers always see the current state
- Status badges appear on cache cards and the detail page so seekers know at a glance whether a cache needs attention or has been retired
- Map filter lets seekers opt in to seeing maintenance and archived listings (hidden by default to keep the map clean)

### Fixed
- Mojave theme now correctly shows light status bar icons on Android instead of being treated as a light theme
- "Compass" label is restored on the mobile bottom navigation bar

## [2.1.2] - 2026-05-04

Adds the Mojave theme — a Pip-Boy-inspired amber-on-black look with matching map tiles and icons — plus a long list of mobile polish: refined radius search, deeper map zoom, optional log comments, inline create-cache validation, larger tap targets across the app, and friendlier error pages.

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

Adds an in-app QR scanner on the claim page so you can scan a treasure's QR code without leaving the app, makes long adventure descriptions tappable to read in full, and fixes QR download/print on Android plus a couple of iPad landscape clipping issues.

### Added
- In-app QR scanner on the claim page — tap to scan the geocache QR code directly without leaving the app; opens automatically on supported mobile devices

### Changed
- Adventure descriptions are now tappable: tap to read the full text in a popup instead of having it cut off

### Fixed
- QR code download and print on the Android app now work correctly
- Map controls no longer clip below the safe area in iPad landscape mode
- Hero logo no longer clips into the navigation bar in iPad landscape mode

## [2.1.0] - 2026-05-02

Map views get a real glow-up: a collapsible sidebar for a true full-screen map, a one-tap Earth view, animated fly-to when jumping to Near Me or switching views, and a home-page nudge for the Android app on Zapstore. Sharing now uses the system share sheet, and tablets pick up the mobile layout instead of the cramped desktop sidebar.

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

A privacy and polish release. Adds an opt-out for anonymous analytics, makes the key-save confirmation visible during sign-up, fixes notification stacking above modals, and improves compass readability in low contrast.

### Added
- Privacy setting to opt out of anonymous analytics collection

### Fixed
- Confirmation message now appears when your account key is saved to the Documents folder during sign-up
- Notifications appear correctly above dialogs and modals
- Compass text is easier to read in low-contrast situations

## [2.0.5] - 2026-04-25

A one-fix patch that unsticks the key-save step during account creation on Android.

### Fixed
- Key save during account creation no longer hangs on Android

## [2.0.4] - 2026-04-25

New accounts now save their key straight to your device's password manager — Google Password Manager, iCloud Keychain, or your browser's credential store — instead of downloading a text file. De-Googled devices and unsupported browsers fall back to the old file save.

### Changed
- New account key is saved to your device's password manager (Google Password Manager, iCloud Keychain, or browser credential store) instead of downloading a text file; falls back to file save on de-Googled devices and unsupported browsers

## [2.0.3] - 2026-04-25

Adds haptic feedback to key moments — compass proximity alerts, publish confirmations, save toggles, share actions, map pin drops, and verified reveals — plus brand-coloured splash, theme-aware status bars in system dark mode, and a fix for the white "near me" dot on the map.

### Added
- Haptic feedback on key interactions: compass proximity alerts, publish confirmations, save toggles, share actions, map pin drops, and verified reveals

### Changed
- Splash screen uses original brand colors instead of plain white

### Fixed
- Status bar icons now match the theme when the device is in system dark mode
- "Near me" location marker no longer appears as a white dot on the map

## [2.0.2] - 2026-04-25

Status bar icons now adapt dynamically as you scroll past dark hero sections and respect Ditto profile themes. Also fixes Android deep linking for treasures.to URLs and a few small Zapstore listing issues.

### Changed
- Status bar icons adapt dynamically when scrolling past the hero section
- Ditto profile themes correctly trigger light or dark status bar icons

### Fixed
- Status bar no longer stays white-on-white after navigating away from hero pages
- Adventure detail pages with dark themes now show light status bar icons
- Deep linking for treasures.to URLs (Digital Asset Links)
- Zapstore repository URL and icon format

## [2.0.1] - 2026-04-24

A safe-area and layout cleanup for the fresh Android app: hero text, drawers, toasts, map, and loading spinner all respect notches and the bottom nav properly.

### Fixed
- Hero treasure name sits above bottom safe area on notched devices
- Left navigation drawer respects bottom safe area
- Toast notifications clear top safe area
- Map and adventure pages no longer hidden behind mobile nav bar
- Left nav highlights only the active tab (map vs list)
- Loading spinner centers correctly without scroll overflow
- Tapping adventure name bar expands the detail drawer

## [2.0.0] - 2026-04-24

The Treasures 2.0 launch. A brand-new Android app with native splash, deep links, and themed status bars. A Wind Waker-style compass with radar mode for nearby treasures. Curated Adventures, profile search, full-text relay search, smart coordinate input, encrypted drafts, drag-to-reorder photo uploads, profile theme sync, and 200+ strings in English, German, Japanese, and Thai. Plus a top-to-bottom redesign of the home page, treasure creation, QR codes, the verified-find flow, blog, and About.

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
