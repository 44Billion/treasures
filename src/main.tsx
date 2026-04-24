import { createRoot } from 'react-dom/client'
import '@fontsource/pirata-one'
import { validateReactAvailability } from '@/utils/safeContext'

import App from './App.tsx'
import './index.css'
import './styles/mobile.css'
import './styles/adventure.css'

// Validate React is properly loaded before proceeding
validateReactAvailability();

// ─── Native status bar theming (Android APK / iOS) ───────────────────────────
// Keeps the OS top chrome in sync with the active app theme.
// Runs before React so the very first paint matches the persisted theme.
// Uses a MutationObserver so it reacts to all subsequent theme changes.
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Hide the iOS keyboard accessory bar (prev/next/done toolbar above the keyboard).
  if (Capacitor.getPlatform() === 'ios') {
    import('@capacitor/keyboard').then(({ Keyboard }) => {
      Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
    }).catch(() => {});
  }

  /**
   * Sync the native system bar icon style with the active CSS theme.
   *
   * SystemBarsStyle.Dark  = light/white icons (use on dark backgrounds)
   * SystemBarsStyle.Light = dark/black icons  (use on light backgrounds)
   */
  function updateStatusBar() {
    const isDark = document.documentElement.classList.contains('dark');
    SystemBars.setStyle({ style: isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }

  // Apply immediately
  updateStatusBar();

  // Re-apply whenever the theme class changes on <html>
  const classObserver = new MutationObserver(() => updateStatusBar());
  classObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// Ensure React is properly loaded before creating the app
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Validate React is fully loaded
if (typeof createRoot !== 'function') {
  throw new Error("React createRoot is not available. React may not be fully loaded.");
}

// Add error boundary for context creation issues
try {
  const root = createRoot(rootElement);
  root.render(<App />);
} catch (error) {
  console.error("Failed to initialize React app:", error);
  
  // Fallback error display with additional debugging info
  rootElement.innerHTML = `
    <div style="padding: 20px; text-align: center; font-family: system-ui;">
      <h1>Application Error</h1>
      <p>Failed to load the application. Please refresh the page.</p>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
      <p style="font-size: 10px; color: #999; margin-top: 5px;">Build: ${new Date().toISOString()}</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 10px;">
        Refresh Page
      </button>
      <button onclick="window.location.href = window.location.href + '?t=' + Date.now()" style="padding: 10px 20px; margin-top: 10px; margin-left: 10px;">
        Force Refresh
      </button>
    </div>
  `;
}
