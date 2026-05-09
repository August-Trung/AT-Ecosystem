import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.augusttrung.atremote',
  appName: 'AT Remote',
  webDir: 'dist',
  server: {
    cleartext: true
  }
};

export default config;
