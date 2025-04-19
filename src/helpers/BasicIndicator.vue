<script>
import Overlay from '../mixins/overlay.js'

export default {
  name: 'BasicIndicator',
  mixins: [Overlay],
  methods: {
    meta_info() {
      return {
        author: 'Claude',
        version: '1.0.0',
        desc: 'Einfacher Testindikator'
      }
    },
    use_for() { 
      return ['BasicIndicator'] 
    },
    calc() {
      return {
        props: {},
        conf: {},
        update: `
          // Erstelle einen Testindikator (einfache 20-Tage-SMA)
          let sma20 = sma(close, 20)
          
          // Zeit und SMA-Werte in [time, value] Format für den Indikator
          let data = []
          for (let i = 0; i < time.length; i++) {
            data.push([time[i], sma20[i]])
          }
          
          // Für TradingVue setze den ersten Datenpunkt
          this[0] = data
          
          // Debug-Ausgabe
          console.log('Basic Indicator erstellt mit ' + data.length + ' Datenpunkten')
        `
      }
    }
  }
}
</script>