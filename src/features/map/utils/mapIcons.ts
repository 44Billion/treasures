import L from 'leaflet';

// Custom marker icon for dropped pin (cache location)
export const droppedPinIcon = L.divIcon({
  html: `
    <div style="position: relative;">
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C9.373 0 4 5.373 4 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#ef4444"/>
        <circle cx="16" cy="12" r="4" fill="white"/>
      </svg>
    </div>
  `,
  className: "location-picker-icon",
  iconSize: [32, 40],
  iconAnchor: [16, 12], // Anchor at the center of the pin's head (where the white circle is)
});

// Blue beacon icon for current/searched location
export const blueBeaconIcon = L.divIcon({
  html: `
    <div style="position: relative; width: 24px; height: 24px;">
      <div style="
        position: absolute;
        width: 24px;
        height: 24px;
        background: rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        animation: pulse 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: #3b82f6;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.5; }
        100% { transform: scale(2); opacity: 0; }
      }
    </style>
  `,
  className: "blue-beacon-icon",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Green icon for found geocaches
export const foundGeocacheIcon = L.divIcon({
  html: `
    <div style="position: relative;">
      <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C7.029 0 3 4.029 3 9c0 6.75 9 18 9 18s9-11.25 9-18c0-4.971-4.029-9-9-9z" fill="#22c55e"/>
        <circle cx="12" cy="9" r="3" fill="white"/>
      </svg>
    </div>
  `,
  className: "found-geocache-icon",
  iconSize: [24, 30],
  iconAnchor: [12, 30],
});

// Orange icon for unfound geocaches
export const unfoundGeocacheIcon = L.divIcon({
  html: `
    <div style="position: relative;">
      <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C7.029 0 3 4.029 3 9c0 6.75 9 18 9 18s9-11.25 9-18c0-4.971-4.029-9-9-9z" fill="#f97316"/>
        <circle cx="12" cy="9" r="3" fill="white"/>
      </svg>
    </div>
  `,
  className: "unfound-geocache-icon",
  iconSize: [24, 30],
  iconAnchor: [12, 30],
});

export const mapIcons = {
  droppedPin: droppedPinIcon,
  blueBeacon: blueBeaconIcon,
  foundGeocache: foundGeocacheIcon,
  unfoundGeocache: unfoundGeocacheIcon,
} as const;