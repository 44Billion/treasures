import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'to.treasures.app',
  appName: 'Treasures',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  android: {
    // Enable safe area handling for notches and navigation bars
    allowMixedContent: false,
    backgroundColor: '#0e1a15',
  },
  ios: {
    backgroundColor: '#0e1a15',
    contentInset: 'never',
    scheme: 'Treasures',
  },
  plugins: {
    SystemBars: {
      // Inject --safe-area-inset-* CSS variables on Android to work around
      // a Chromium bug (<140) where env(safe-area-inset-*) reports 0.
      insetsHandling: 'css',
    },
  },
};

export default config;
