# Location Search Features

The NostrCache geocaching site now includes comprehensive location search capabilities powered by OpenStreetMap's Nominatim geocoding service.

## 🔍 Search Capabilities

### 1. **Universal Location Search**
The search box accepts multiple input formats:

- **City Names**: "New York", "London", "Tokyo"
- **ZIP/Postal Codes**: "10001", "SW1A 1AA", "100-0001"
- **Countries**: "United States", "Japan", "Germany"
- **States/Provinces**: "California", "Ontario", "Bavaria"
- **Addresses**: "123 Main St, New York"
- **Landmarks**: "Central Park", "Eiffel Tower"
- **Coordinates**: Multiple formats supported:
  - Decimal: `40.7128, -74.0060`
  - With directions: `40.7128N 74.0060W`
  - DMS: `40°42'46"N 74°00'22"W`

### 2. **Search Features**

- **Auto-complete**: Results appear as you type (with 500ms debounce)
- **Result Icons**: Different icons for different location types:
  - 📍 General locations
  - 📮 Postal codes
  - 🏘️ Cities/Towns/Villages
  - 🌍 Countries
- **Result Details**: Shows full address and coordinates
- **One-click Selection**: Click any result to center the map

### 3. **Near Me Functionality**

- **Find Near Me Button**: Uses browser geolocation to find your position
- **Distance Display**: Shows distance to each cache when "Near Me" is active
- **Sorted Results**: Caches are automatically sorted by distance
- **Visual Indicators**: Your location shown as a blue dot on the map

### 4. **Integration Points**

#### Map Explorer (`/map`)
- **Header Search**: Desktop users see search in the header
- **Mobile Search**: Compact search in the sidebar for mobile
- **Instant Updates**: Map centers on selected location
- **Zoom Adjustment**: Automatically zooms to appropriate level

#### Create Cache (`/create`)
- **Location Search**: Search for the area where you want to hide a cache
- **Click to Place**: After searching, click the exact spot on the map
- **Current Location**: Option to use GPS for current position
- **Manual Entry**: Still supports direct coordinate input

## 🛠️ Technical Implementation

### Geocoding Service
- Uses **OpenStreetMap Nominatim** (free, no API key required)
- Respects OSM usage policies
- Returns worldwide results
- No tracking or data collection

### Distance Calculations
- **Haversine Formula**: Accurate distance calculations
- **Metric Display**: Shows meters for <1km, kilometers for longer
- **Real-time Updates**: Distances recalculate as you move

### User Experience
- **Debounced Search**: Prevents excessive API calls
- **Loading States**: Shows spinner while searching
- **Error Handling**: Graceful fallbacks for failed searches
- **Clear Button**: Easy way to reset search

## 📍 Example Searches

Try these searches to see the functionality:

1. **City Search**: "San Francisco"
2. **ZIP Code**: "94105"
3. **Landmark**: "Golden Gate Bridge"
4. **Country**: "Switzerland"
5. **Coordinates**: "37.7749, -122.4194"
6. **Address**: "1 Market St, San Francisco"

## 🚀 Future Enhancements

The search system is extensible for:
- Search history/favorites
- Radius-based filtering (e.g., "within 10km")
- Advanced filters combined with location
- Offline geocoding for common locations
- Custom POI database for popular geocaching spots

The location search makes finding and creating geocaches intuitive and accessible to users worldwide!