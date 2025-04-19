<script>
import Overlay from '../../../src/mixins/overlay.js'

export default {
    name: 'RSIScript',
    mixins: [Overlay],
    methods: {
        meta_info() {
            return { author: 'Claude', version: '1.0.0' }
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
                conf: {
                    'renderer': 'Splines'
                },
                init: `
                    console.log('RSI script initialized')
                `,
                update: `
                    // Calculate RSI using the built-in function
                    let result = rsi(close, length)
                    
                    // Return the RSI values as the first array
                    this[0] = result
                    
                    // Add fixed lines at 70/30 levels
                    offchart([
                        Array(close.length).fill(70), 
                        Array(close.length).fill(30)
                    ], '', {
                        colors: ['#f55', '#6fb'],
                        widths: [1, 1]
                    })
                `
            }
        }
    }
}
</script>