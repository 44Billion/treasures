/**
 * Special-purpose map marker icons for GeocacheMap.
 * (Cache-type markers live in `@/utils/cacheMapIcons`.)
 */

import L from "leaflet";

// Google Maps-style "you are here" indicator: a solid theme-colored dot with a
// white halo and a softly expanding pulse ring. Styling lives in
// `src/styles/map-features.css` so the indicator inherits the active theme's
// `--primary` token across all themes (forest, steel, Mojave, etc.).
export const userLocationIcon = L.divIcon({
  html: `
    <div class="user-location-marker">
      <div class="user-location-marker__pulse" aria-hidden="true"></div>
      <div class="user-location-marker__dot" aria-hidden="true"></div>
    </div>
  `,
  className: "user-location-icon",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Adventure marker icon — amber/gold sparkles
export const adventureMarkerIcon = L.divIcon({
  html: `
    <div style="
      background: linear-gradient(135deg, #d97706, #b45309);
      border: 3px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      position: relative;
      cursor: pointer;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        <path d="M20 3v4"/>
        <path d="M22 5h-4"/>
        <path d="M4 17v2"/>
        <path d="M5 18H3"/>
      </svg>
    </div>
    <div style="
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #d97706;
    "></div>
  `,
  className: "adventure-marker-icon",
  iconSize: [40, 48],
  iconAnchor: [20, 48],
  popupAnchor: [0, -48],
});
