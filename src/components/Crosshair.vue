<script>

import Crosshair from './js/crosshair.js'
import Utils from '../stuff/utils.js'
import { h } from 'vue'

export default {
    name: 'Crosshair',
    props: [ 'cursor', 'colors', 'layout', 'sub' ],
    methods: {
        create() {
            this.ch = new Crosshair(this)

            // New grid overlay-renderer descriptor.
            // Should implement draw() (see Spline.vue)
            this.$emit('new-grid-layer', {
                name: 'crosshair',
                renderer: this.ch
            })
        }
    },
    watch: {
        cursor: {
            handler: function() {

                if (!this.ch) this.create()

                // Explore = default mode on mobile
                const cursor = this.$props.cursor
                const explore = cursor.mode === 'explore'

                if (!cursor.x || !cursor.y) {
                    this.ch.hide()
                    this.$emit('redraw-grid')
                    return
                }
                this.ch.visible = !explore
            },
            deep: true
        }
    },
    render() { 
        // Return an empty div as the component doesn't need to render anything
        return h('div', { style: { display: 'none' } })
    }
}
</script>
