import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.batchcrickbd',
  appName: 'BatchCrick',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'batchcrick.vercel.app'
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '899272110972-pjfti5ug438ubliit4ri5civ6nuhkftv.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    },
    StatusBar: {
      backgroundColor: '#0f172a',
      style: 'DARK'
    }
  }
};

export default config;
