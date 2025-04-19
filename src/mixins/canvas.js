// Interactive canvas-based component
// Should implement: mousemove, mouseout, mouseup, mousedown, click

import Utils from '../stuff/utils.js'

export default {
    methods: {
        setup() {
            // Use the ref instead of getElementById
            this.$nextTick(() => {
                if (!this.$refs.canvas) {
                    console.error(`Canvas ref not found for ${this._id}`)
                    return
                }
                this.initCanvas(this.$refs.canvas)
            })
        },
        
        initCanvas(canvas) {
            let dpr = window.devicePixelRatio || 1
            if (!canvas.style) {
                console.error(`Canvas style is null for canvas`)
                return
            }
            canvas.style.width = `${this._attrs.width}px`
            canvas.style.height = `${this._attrs.height}px`
            if (dpr < 1) dpr = 1 // Realy ? That's it? Issue #63
            
            var rect = canvas.getBoundingClientRect()
            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr
            const ctx = canvas.getContext('2d', {
                // TODO: test the boost:
                //alpha: false,
                //desynchronized: true,
                //preserveDrawingBuffer: false
            })
            ctx.scale(dpr, dpr)
            this.redraw()
            // Fallback fix for Brave browser
            // https://github.com/brave/brave-browser/issues/1738
            if (!ctx.measureTextOrg) {
                ctx.measureTextOrg = ctx.measureText
            }
            ctx.measureText = text =>
                Utils.measureText(ctx, text, this.$props.tv_id)
        },
        create_canvas(h, id, props) {
            this._id = id
            this._attrs = props.attrs
            return h('div', {
                class: `trading-vue-${id}`,
                style: {
                    left: props.position.x + 'px',
                    top: props.position.y + 'px',
                    position: 'absolute',
                }
            }, [
                h('canvas', {
                    // Support both Vue 2 and Vue 3 event binding
                    on: {
                        mousemove: e => this.renderer && this.renderer.mousemove(e),
                        mouseout: e => this.renderer && this.renderer.mouseout(e),
                        mouseup: e => this.renderer && this.renderer.mouseup(e),
                        mousedown: e => this.renderer && this.renderer.mousedown(e)
                    },
                    // These are for Vue 3
                    onMousemove: e => this.renderer && this.renderer.mousemove(e),
                    onMouseout: e => this.renderer && this.renderer.mouseout(e),
                    onMouseup: e => this.renderer && this.renderer.mouseup(e),
                    onMousedown: e => this.renderer && this.renderer.mousedown(e),
                    attrs: Object.assign({
                        id: `${this.$props.tv_id}-${id}-canvas`
                    }, props.attrs),
                    ref: 'canvas',
                    style: props.style,
                })
            ].concat(props.hs || []))
        },
        redraw() {
            if (!this.renderer) return
            this.renderer.update()
        }
    },
    watch: {
        width(val) {
            this._attrs.width = val
            this.setup()
        },
        height(val) {
            this._attrs.height = val
            this.setup()
        }
    }
}
