import { defineConfig } from 'vite';

export default defineConfig({
  define: { global: 'globalThis' },
  resolve: {
    alias: { 'react-native': 'react-native-web' },
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
  },
  server: {
    host: '127.0.0.1',
    watch: {
      ignored: ['**/android/**', '**/artifacts/**', '**/test-results/**'],
    },
  },
});
