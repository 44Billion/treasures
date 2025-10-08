# Texas Renaissance Festival Page

## Overview
A dedicated page for discovering geocaches at the Texas Renaissance Festival grounds in Todd Mission, TX.

## Features

### Location
- **Coordinates**: 30.2672, -95.7165 (Texas Renaissance Festival grounds)
- **Zoom Level**: 16 (detailed view of festival grounds)
- **Map Lock**: Map is centered on festival grounds (users can pan to explore)

### Theme
- **Auto-switches to Adventure Theme** when page loads
- Uses Pirata One font throughout
- Parchment-textured map markers with blue quest marker styling
- Amber/brown color scheme consistent with Renaissance festival aesthetic

### Functionality
- All standard map features:
  - Filter by difficulty, terrain, cache type
  - Text search for caches
  - Interactive map with geocache markers
  - Click markers to view cache details
  - Mobile-responsive layout with map/list tabs
- Shows all geocaches (no radius restriction)
- Map centered on festival location at startup
- Festival-specific banner with location info
- Full integration with existing geocache system

### Navigation
- **Desktop**: Accessible from "Explore" dropdown menu → "Texas Ren Fest"
- **Mobile**: Accessible from hamburger menu → "Texas Ren Fest"
- **Direct URL**: `/texas-ren-fest`

### Visual Design
- **Hero Banner**:
  - Amber gradient background with festival name
  - Sparkles icon animation
  - Location badge showing "Todd Mission, TX"
- **Map Markers**:
  - Blue quest markers with parchment texture
  - Consistent with adventure theme styling

## Technical Details

### Route
```typescript
<Route path="/texas-ren-fest" element={<TexasRenFest />} />
```

### Key Constants
```typescript
const TEXAS_REN_FEST_CENTER = {
  lat: 30.2672,
  lng: -95.7165
};
const TEXAS_REN_FEST_ZOOM = 16;
```

### Theme Forcing
```typescript
useEffect(() => {
  if (theme !== 'adventure') {
    setTheme('adventure');
  }
}, [theme, setTheme]);
```

## Files Modified
- `/src/pages/TexasRenFest.tsx` - New dedicated page component
- `/src/AppRouter.tsx` - Added route
- `/src/components/MobileNav.tsx` - Added navigation link
- `/src/components/DesktopHeader.tsx` - Added navigation link

## User Experience

### Desktop
1. User clicks "Explore" → "Texas Ren Fest" in header
2. Page loads with adventure theme automatically applied
3. Map shows festival grounds at 16x zoom
4. Left sidebar shows all geocaches (filtered by search/difficulty/terrain if set)
5. Can filter and search caches
6. Click any cache to view details

### Mobile
1. User taps hamburger menu → "Texas Ren Fest"
2. Page loads with adventure theme and festival banner
3. Default view is map (centered on festival grounds)
4. Can switch to list view to see all caches
5. Tap cache card to view details and navigate to location

## Future Enhancements
- Could add festival-specific cache types or badges
- Special QR codes for festival geocaches
- Festival event integration
- Leaderboard for most caches found at festival
- Festival-themed achievements
