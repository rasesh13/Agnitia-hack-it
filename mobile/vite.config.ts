import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative base so the build loads from the Capacitor WebView's bundled assets.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5190 },
});
