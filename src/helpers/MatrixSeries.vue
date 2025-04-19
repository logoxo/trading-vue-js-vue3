<script>
import Overlay from '../mixins/overlay.js'

export default {
  name: 'MatrixSeries',
  mixins: [Overlay],
  methods: {
    meta_info() {
      return {
        author: 'Claude',
        version: '1.0.0',
        desc: 'Matrix Series Indicator'
      }
    },
    use_for() { return ['MatrixSeries'] },
    calc() {
      return {
        props: {
          smoother: {
            def: 5,
            range: [1, 50, 1],
            text: 'Glättung (EMA-Periode)'
          },
          sup_res_period: {
            def: 50,
            range: [10, 200, 1],
            text: 'Support/Resistance Periode'
          },
          sup_res_percentage: {
            def: 100,
            range: [10, 200, 1],
            text: 'S/R Prozentsatz'
          },
          price_period: {
            def: 16,
            range: [5, 100, 1],
            text: 'Preisperiode'
          },
          ob: {
            def: 200,
            range: [50, 500, 10],
            text: 'Überkauft-Schwelle'
          },
          os: {
            def: -200,
            range: [-500, -50, 10],
            text: 'Überverkauft-Schwelle'
          },
          show_obos: {
            def: false,
            text: 'OB/OS anzeigen'
          },
          dynamic: {
            def: true,
            text: 'Dynamische S/R-Linien'
          },
          trend_threshold: {
            def: 0.05,
            range: [0.01, 0.5, 0.01],
            text: 'Trend-Schwellenwert'
          }
        },
        conf: { renderer: 'Candles' },
        update: `
          // Composite price
          let ys1 = (high + low + close * 2) / 4

          // EMA-Glättung
          let rk3 = ema(ys1, smoother)
          let rk4 = stddev(ys1, smoother)
          let min_std = sma(ys1, smoother) * 0.0001
          let rk4_safe = rk4.map(x => Math.max(x, min_std))

          // Normalisierte Preisdifferenz
          let rk5 = ys1.map((val, i) => (val - rk3[i]) * 200 / rk4_safe[i])
          let rk6 = ema(rk5, smoother)
          let up = ema(rk6, smoother)
          let down = ema(up, smoother)

          // Trendstärke berechnen
          let trend_strength = up.map((val, i) => {
            let denominator = (Math.abs(val) + Math.abs(down[i])) / 2
            return denominator !== 0 ? (val - down[i]) / denominator : 0
          })

          // Starke Trends filtern
          let strong_trend = trend_strength.map(val => Math.abs(val) > trend_threshold)

          // Trendrichtung bestimmen
          let is_uptrend = up.map((val, i) => val > down[i] && strong_trend[i])

          // Künstliche OHLC-Werte
          let min_val = up.map((val, i) => Math.min(val, down[i]))
          let max_val = up.map((val, i) => Math.max(val, down[i]))
          let wick_range = max_val.map((val, i) => (val - min_val[i]) * 0.1)

          let Oo = is_uptrend.map((val, i) => val ? min_val[i] : max_val[i])
          let Cc = is_uptrend.map((val, i) => val ? max_val[i] : min_val[i])
          let Hh = max_val.map((val, i) => val + wick_range[i])
          let Ll = min_val.map((val, i) => val - wick_range[i])

          // Farben zuweisen
          let vcolor = is_uptrend.map(val => val ? 'green' : 'red')

          // Daten zuweisen
          this.Open = Oo
          this.High = Hh
          this.Low = Ll
          this.Close = Cc
          this.Color = vcolor
          this.TrendStrength = trend_strength
          this.IsUptrend = is_uptrend

          // Support/Resistance-Berechnung
          let osc = rolling(close, price_period, x => {
            let mean = x.reduce((a, b) => a + b, 0) / x.length
            let std = Math.sqrt(x.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / x.length)
            return std !== 0 ? x.reduce((a, b) => a + (b - mean), 0) / std : 0
          })

          let value2 = rolling(osc, sup_res_period, x => Math.max(...x))
          let value3 = rolling(osc, sup_res_period, x => Math.min(...x))
          let value4 = value2.map((val, i) => val - value3[i])
          let value5 = value4.map(val => val * (sup_res_percentage / 100))
          let resistance_line = value3.map((val, i) => val + value5[i])
          let support_line = value2.map((val, i) => val - value5[i])

          this.Resistance = dynamic ? resistance_line : Array(resistance_line.length).fill(NaN)
          this.Support = dynamic ? support_line : Array(support_line.length).fill(NaN)

          // OB/OS-Markierungen
          let strong_up = up.map((val, i) => val > ob && trend_strength[i] > 0.2)
          let strong_down = down.map((val, i) => val < os && trend_strength[i] < -0.2)

          let upshape = strong_up.map((val, i) => val ? (is_uptrend[i] ? up[i] + 20 : down[i] + 20) : NaN)
          let downshape = strong_down.map((val, i) => val ? (!is_uptrend[i] ? down[i] - 20 : up[i] - 20) : NaN)

          this.UPshape = upshape
          this.DOWNshape = downshape

          // OB/OS-Linien
          if (show_obos) {
            this.OB = Array(close.length).fill(ob)
            this.OS = Array(close.length).fill(os)
          }
        `
      }
    }
  }
}
</script>