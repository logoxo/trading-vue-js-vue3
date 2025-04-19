const { defineConfig } = require('vite')
const vue = require('@vitejs/plugin-vue')
const path = require('path')

// Global variables (similar to webpack.DefinePlugin)
const globals = {
  'MOB_DEBUG': JSON.stringify(process.env.MOB_DEBUG),
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'trading-vue-js': path.resolve(__dirname, './src'),
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  },
  server: {
    port: 8080,
    proxy: {
      '/api/v1/**': {
        target: 'https://api.binance.com',
        changeOrigin: true
      },
      '/ws/**': {
        target: 'wss://stream.binance.com:9443',
        changeOrigin: true,
        ws: true
      },
      '/api/udf/**': {
        target: 'https://www.bitmex.com',
        changeOrigin: true
      },
      '/debug': {
        target: 'http://localhost:8080',
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const url = new URL(req.url, 'http://localhost:8080')
            const argv = JSON.parse(url.searchParams.get('argv') || '[]')
            console.log(...argv)
            res.end('[OK]')
          })
        }
      }
    }
  },
  define: globals,
  // Change entry point to test
  root: './test',
  publicDir: '../public'
})