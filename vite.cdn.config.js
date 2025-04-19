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
    port: 8080
  },
  define: globals,
  build: {
    lib: {
      entry: path.resolve(__dirname, './src/index.js'),
      name: 'TradingVueJs',
      fileName: 'trading-vue',
      formats: ['umd']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  }
})