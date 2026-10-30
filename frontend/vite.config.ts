import fs from 'node:fs'
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

type BundleChunk = { type: 'chunk'; fileName: string; imports: string[]; isEntry: boolean; facadeModuleId: string | null }

/**
 * Writes the code files of the shop pages people land on into index.html as a JSON data block
 * (not run, so the CSP allows it). public/preload.js reads it and starts downloading that page's
 * code at once, instead of after the main code has run.
 */
function routeChunks() {
  const pages = {
    shop: 'src/pages/store/Shop.tsx',
    category: 'src/pages/store/CategoryPage.tsx',
    product: 'src/pages/store/ProductDetail.tsx',
  }
  return {
    name: 'route-chunks',
    apply: 'build' as const,
    transformIndexHtml: {
      order: 'post' as const,
      handler(_html: string, ctx: { bundle?: Record<string, { type: string }> }) {
        const bundle = ctx.bundle as Record<string, BundleChunk> | undefined
        if (!bundle) return []
        const chunks = Object.values(bundle).filter((c) => c.type === 'chunk')
        const entry = chunks.find((c) => c.isEntry)
        // Files the page already preloads (the main code and what it imports)
        const preloaded = new Set([entry?.fileName, ...(entry?.imports ?? [])])
        const map: Record<string, string[]> = {}
        for (const [key, src] of Object.entries(pages)) {
          const chunk = chunks.find((c) => c.facadeModuleId?.replace(/\\/g, '/').endsWith(src))
          if (!chunk) continue
          const files = new Set<string>()
          const walk = (c: BundleChunk) => {
            if (files.has(c.fileName) || preloaded.has(c.fileName)) return
            files.add(c.fileName)
            for (const name of c.imports) if (bundle[name]?.type === 'chunk') walk(bundle[name])
          }
          walk(chunk)
          map[key] = [...files]
        }
        return [
          {
            tag: 'script',
            attrs: { type: 'application/json', id: 'route-chunks' },
            children: JSON.stringify(map).replace(/</g, '\\u003c'),
            injectTo: 'head-prepend' as const,
          },
        ]
      },
    },
  }
}

/**
 * Vercel sends the app only for the shop's own addresses (vercel.json); any other address gets
 * 404.html with a real "not found" status, so Google does not list made-up pages. It is the same
 * app, which shows its own "page not found" screen.
 */
function notFoundPage() {
  let outDir = 'dist'
  return {
    name: 'not-found-page',
    apply: 'build' as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      fs.copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  plugins: [reactRefreshPreamble(), react(), tailwindcss(), routeChunks(), notFoundPage()],
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
          return undefined
        },
      },
    },
  },
})
