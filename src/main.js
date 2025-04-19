import { createApp, version } from 'vue'
import App from './App.vue'

// MOB_DEBUG=true npm run test - Enables mobile debugging
// (sending console output to the terminal)
if (typeof MOB_DEBUG !== 'undefined' && MOB_DEBUG) {
    console.log = debug
    console.error = debug
    console.warn = debug
}

// Add debugging
console.log('Initializing app with Vue version:', version)

try {
    const app = createApp(App)
    
    // Show rendering errors
    app.config.errorHandler = (err, vm, info) => {
        console.error('Vue Error:', err)
        console.error('Info:', info)
    }
    
    app.mount('#app')
    console.log('App mounted successfully')
} catch (e) {
    console.error('Error initializing app:', e)
}

function debug(...argv) {
    fetch('/debug?argv=' + JSON.stringify(argv))
}
