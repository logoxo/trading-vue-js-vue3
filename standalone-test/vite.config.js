const { defineConfig } = require('vite')
const vue = require('@vitejs/plugin-vue')
const path = require('path')

module.exports = defineConfig({
  plugins: [vue()],
  server: {
    port: 8082
  },
  resolve: {
    alias: {
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  }
})