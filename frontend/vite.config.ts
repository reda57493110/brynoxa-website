import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function reactRefreshPreamble() {
  return {
    name: 'react-refresh-preamble',
    apply: 'serve' as const,
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          injectTo: 'head-prepend' as const,
          children: `import RefreshRuntime from "/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;`,
        },
      ]
    },
  }
}

export default defineConfig({
  plugins: [reactRefreshPreamble(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react'
          }
          if (id.includes('node_modules/react-router-dom')) return 'react'
          if (
            id.includes('node_modules/@tanstack/react-query') ||
            id.includes('node_modules/axios')
          ) {
            return 'data'
          }
          if (id.includes('node_modules/framer-motion')) return 'motion'
          return undefined
        },
      },
    },
  },
})
