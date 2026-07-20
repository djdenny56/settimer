import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lincolnlabdesigns.settimer',
  appName: 'SetTimer',
  webDir: 'dist',
  server: {
    // Serve bundled assets over HTTPS on Android (secure context for Web APIs).
    androidScheme: 'https',
    // iOS uses capacitor://localhost, which is treated as a secure origin.
    hostname: 'localhost',
    cleartext: false,
  },
};

export default config;
