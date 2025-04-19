import { createApp } from 'vue'
import App from './Test.vue'

// MOB_DEBUG=true npm run test - Enables mobile debugging
// (sending console output to the terminal)
if (typeof MOB_DEBUG !== 'undefined' && MOB_DEBUG) {
    console.log = debug
    console.error = debug
    console.warn = debug
}

const app = createApp(App)
const isDev = process.env.NODE_ENV !== "production"
app.config.performance = isDev
app.mount('#app')

function debug(...argv) {
    fetch('/debug?argv=' + JSON.stringify(argv))
}
