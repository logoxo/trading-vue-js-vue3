
<!-- Waits for an event from Keyboard.vue
     and converts it to a Vue.js event -->

<script>
import { h } from 'vue'

export default {
    name: 'KeyboardListener',
    render() { 
        // Return an empty div as this is a non-visual component
        return h('div', { style: { display: 'none' } })
    },
    created: function () {
        this.$emit('register-kb-listener', {
            id: this._uid,
            keydown: this.keydown,
            keyup: this.keyup,
            keypress: this.keypress
        })
    },
    beforeUnmount: function () {
        this.$emit('remove-kb-listener', {
            id: this._uid
        })
    },
    methods: {
        keydown (event) {
            this.$emit('keydown', event)
        },
        keyup (event) {
            this.$emit('keyup', event)
        },
        keypress (event) {
            this.$emit('keypress', event)
        },
    }
}

</script>
