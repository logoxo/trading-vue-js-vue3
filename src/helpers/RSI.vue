<script>
import Overlay from '../mixins/overlay.js'

export default {
    name: 'RSI',
    mixins: [Overlay],
    methods: {
        meta_info() {
            return { 
                author: 'Claude', 
                version: '1.0.0',
                desc: 'Relative Strength Index'
            }
        },
        use_for() { return ['RSI'] },
        calc() {
            return {
                props: {
                    length: {
                        def: 14, range: [2, 100, 1],
                        text: 'RSI Length'
                    }
                },
                conf: { 'renderer': 'Splines' },
                update: `
                    // Calculate RSI using the built-in function
                    let result = rsi(close, length)
                    
                    // Return the RSI values
                    this[0] = result
                    
                    // Add upper/lower bands at 70/30
                    this.bands = [{
                        value: 70,
                        color: '#f55',
                        width: 1
                    }, {
                        value: 30,
                        color: '#6fb',
                        width: 1
                    }]
                `
            }
        }
    }
}
</script>