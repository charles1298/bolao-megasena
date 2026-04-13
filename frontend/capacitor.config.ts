import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.bolaomegasena',
  appName: 'Bolão Mega Sena',
  webDir: 'dist',
  android: {
    backgroundColor: '#0f0f1a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f0f1a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0f0f1a',
    },
  },
};

export default config;
