<script>
// The side bar (yep, that thing with a bunch of $$$)

import Sidebar from './js/sidebar.js'
import Canvas from '../mixins/canvas.js'
import { h } from 'vue'

export default {
    name: 'Sidebar',
    props: [
        'sub', 'layout', 'range', 'interval', 'cursor', 'colors', 'font',
        'width', 'height', 'grid_id', 'rerender', 'y_transform', 'tv_id',
        'config', 'shaders'
    ],
    mixins: [Canvas],
    mounted() {
        this.$nextTick(() => {
            const el = this.$refs['canvas']
            if (!el || !this.$props.config) {
                console.error('Sidebar: Canvas element not found or config missing')
                return
            }
            this.renderer = new Sidebar(el, this)
            this.setup()
            this.redraw()
        })
    },
    render() {
        const id = this.$props.grid_id
        const layout = this.$props.layout.grids[id]
        return this.create_canvas(h, `sidebar-${id}`, {
            position: {
                x: layout.width,
                y: layout.offset || 0
            },
            attrs: {
                rerender: this.$props.rerender,
                width: this.$props.width,
                height: layout.height,
            },
            style: {
                backgroundColor: this.$props.colors.back
            },
        })
    },
    watch: {
        range: {
            handler: function() { this.redraw() },
            deep: true
        },
        cursor: {
            handler: function() { this.redraw() },
            deep: true
        },
        rerender() {
            this.$nextTick(() => this.redraw())
        }
    },
    beforeUnmount () {
        if(this.renderer) this.renderer.destroy()
    }
}

</script>
