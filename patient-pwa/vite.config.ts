import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages のサブパスに置く場合は VITE_BASE="/リポジトリ名/" を設定する
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: '術前リハビリ',
        short_name: '術前リハ',
        description: '手術に向けた自宅リハビリの動画と毎日の記録',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1a6b8a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // Apps Script への送信はキャッシュしない（既定で同一オリジン以外はキャッシュされない）
        navigateFallback: 'index.html'
      }
    })
  ]
});
