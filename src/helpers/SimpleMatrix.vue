<script>
// Vereinfachte Version des Matrix Series Indikators
import Overlay from '../mixins/overlay.js'

export default {
    name: 'SimpleMatrix',
    mixins: [Overlay],
    methods: {
        meta_info() {
            return { 
                author: 'Claude', 
                version: '1.0.0',
                desc: 'Simple Matrix Series'
            }
        },
        use_for() { return ['SimpleMatrix'] },
        draw(ctx) {
            const layout = this.$props.layout
            const data = this.$props.sub
            
            if (!data || !data.length) return
            
            // Liniendarstellung des Indikators
            ctx.lineWidth = 2
            ctx.strokeStyle = '#2196F3' // Blaue Linie
            
            ctx.beginPath()
            for (let i = 0; i < data.length; i++) {
                const p = data[i]
                const x = layout.t2screen(p[0])
                const y = layout.$2screen(p[1])
                
                if (i === 0) {
                    ctx.moveTo(x, y)
                } else {
                    ctx.lineTo(x, y)
                }
            }
            ctx.stroke()
            
            // Zeichne Punkte an den Linien für bessere Sichtbarkeit
            ctx.fillStyle = '#FF5722' // Orange Punkte
            
            for (let i = 0; i < data.length; i++) {
                if (i % 5 !== 0) continue // Nur jeden 5. Punkt zeichnen
                
                const p = data[i]
                const x = layout.t2screen(p[0])
                const y = layout.$2screen(p[1])
                
                ctx.beginPath()
                ctx.arc(x, y, 3, 0, Math.PI * 2)
                ctx.fill()
            }
            
            // Zeichne auch einen Referenzwert bei 0
            ctx.strokeStyle = '#888'
            ctx.lineWidth = 1
            ctx.setLineDash([5, 3]) // Gestrichelte Linie
            
            const y0 = layout.$2screen(0)
            ctx.beginPath()
            ctx.moveTo(0, y0)
            ctx.lineTo(layout.width, y0)
            ctx.stroke()
            
            ctx.setLineDash([]) // Zurücksetzen
        },
        calc() {
            return {
                props: {},
                conf: {},
                init: ``,
                update: `
                    const close = this.$props.data.map(x => x[4])
                    
                    // Einfache Berechnung ähnlich dem Matrix Series
                    const ema5 = sma(close, 5)
                    const ema10 = sma(close, 10)
                    
                    // Differenz zwischen beiden EMAs
                    const diff = ema5.map((val, i) => val - ema10[i])
                    
                    // Skalieren für bessere Sichtbarkeit
                    const scaled = diff.map(d => d * 100)
                    
                    this.v = scaled.map((val, i) => [
                        this.$props.data[i][0], // timestamp
                        val                    // wert
                    ])
                `
            }
        }
    }
}
</script>