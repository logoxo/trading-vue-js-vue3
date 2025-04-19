<script>
import Overlay from '../mixins/overlay.js'

// Minimalistischer Ansatz

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
        conf: { renderer: 'Splines' },
        update: `
          // Manuelle Daten erstellen, ohne Abhängigkeit von Bibliotheksfunktionen
          // 100 Datenpunkte zwischen 0 und 100
          let data = []
          
          for (let i = 0; i < time.length; i++) {
            // Einfache Sinuskurve zwischen 40 und 60
            let value = 50 + Math.sin(i * 0.2) * 10
            data.push([time[i], value])
          }
          
          // Ein Wert in der Mitte des sichtbaren Bereichs - sollte sichtbar sein
          console.log('Direkter Datenpunkt:', data[Math.floor(data.length / 2)])
          
          // Definiere die Y-Achsen-Grenzen fest
          this.$setYrange([0, 100])
          
          // Direktes Setzen des Werts
          this.v = data
          
          // Auch Standard-Weise setzen
          this[0] = data
          
          // Debug-Ausgabe
          console.log('Basic Indicator Daten:', {
            length: data.length,
            first_point: data[0],
            last_point: data[data.length - 1],
            min: 40, 
            max: 60
          })
        `
      }
    }
  }
}
</script>