const { defineConfig } = require('vite')
const vue = require('@vitejs/plugin-vue')
const path = require('path')

// Global variables (similar to webpack.DefinePlugin)
// This will recreate the environment variables used in webpack
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
      '/data': path.resolve(__dirname, './data'),
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  },
  server: {
    port: 8080
  },
  define: globals
})