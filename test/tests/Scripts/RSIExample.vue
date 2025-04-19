<script>
// Simple RSS overlay for TradingVue.js

import Overlay from '../../../src/mixins/overlay.js'

export default {
    name: 'RSIExample',
    mixins: [Overlay],
    methods: {
        meta_info() {
            return { 
                author: 'Claude', 
                version: '1.0.0',
                desc: 'Simple RSI implementation'
            }
        },
        use_for() { 
            return ['RSIExample'] 
        },
        draw(ctx) {
            // Get the overlay data
            const layout = this.$props.layout
            const data = this.$props.sub
            if (!data || !data.length) return
            
            // Define line styles
            ctx.lineWidth = 1
            ctx.strokeStyle = '#85c'
            
            // Draw the main RSI line
            ctx.beginPath()
            const points = data.map((p, i) => [
                layout.t2screen(p[0]), // t
                layout.$2screen(p[1]), // price
            ])
            
            // Draw the line
            for (let i = 0; i < points.length; i++) {
                const p = points[i]
                if (i === 0) {
                    ctx.moveTo(p[0], p[1])
                } else {
                    ctx.lineTo(p[0], p[1])
                }
            }
            ctx.stroke()
            
            // Draw oversold/overbought lines
            const upper = 70
            const lower = 30
            
            // Upper line (overbought)
            ctx.strokeStyle = '#f55'
            ctx.beginPath()
            ctx.moveTo(0, layout.$2screen(upper))
            ctx.lineTo(layout.width, layout.$2screen(upper))
            ctx.stroke()
            
            // Lower line (oversold)
            ctx.strokeStyle = '#6fb'
            ctx.beginPath()
            ctx.moveTo(0, layout.$2screen(lower))
            ctx.lineTo(layout.width, layout.$2screen(lower))
            ctx.stroke()
        }
    },
    // Default settings
    data() {
        return {}
    }
}
</script>