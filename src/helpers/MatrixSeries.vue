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
                desc: 'Matrix Series Indikator (Python zu JS Konvertierung)'
            }
        },
        use_for() { return ['MatrixSeries'] },
        calc() {
            return {
                props: {
                    smoother: { def: 5, text: 'EMA Glättung' },
                    supResPeriod: { def: 50, text: 'S/R Periode' },
                    supResPercentage: { def: 100, text: 'S/R Prozent' },
                    pricePeriod: { def: 16, text: 'Preis Periode' },
                    ob: { def: 200, text: 'Überkauft' },
                    os: { def: -200, text: 'Überverkauft' },
                    showObOs: { def: false, text: 'OB/OS anzeigen' },
                    dynamic: { def: true, text: 'Dynamische S/R' },
                    trendThreshold: { def: 0.05, text: 'Trend Schwelle' }
                },
                conf: { 'renderer': 'Candles' },
                update: `
                    // Daten vorbereiten
                    const ohlc = this.$props.data
                    if (!ohlc || !ohlc.length) return
                    
                    const high = ohlc.map(x => x[2])  // high
                    const low = ohlc.map(x => x[3])   // low
                    const close = ohlc.map(x => x[4]) // close
                    const timestamps = ohlc.map(x => x[0])
                    
                    // Composite price
                    const ys1 = high.map((h, i) => (h + low[i] + close[i] * 2) / 4)
                    
                    // EMA Berechnung
                    const calcEMA = (data, period, smoothing = 2) => {
                        const ema = [data[0]]
                        const k = smoothing / (period + 1)
                        
                        for (let i = 1; i < data.length; i++) {
                            ema.push(data[i] * k + ema[i-1] * (1-k))
                        }
                        return ema
                    }
                    
                    // Standard Abweichung berechnen
                    const calcStd = (data, period) => {
                        const result = []
                        
                        for (let i = 0; i < data.length; i++) {
                            if (i < period - 1) {
                                result.push(0)
                                continue
                            }
                            
                            const slice = data.slice(i - period + 1, i + 1)
                            const mean = slice.reduce((a, b) => a + b, 0) / slice.length
                            const sqDiffs = slice.map(value => {
                                const diff = value - mean
                                return diff * diff
                            })
                            const variance = sqDiffs.reduce((a, b) => a + b, 0) / slice.length
                            result.push(Math.sqrt(variance))
                        }
                        return result
                    }
                    
                    // Rolling Apply für OSC
                    const rollingApply = (data, period, fn) => {
                        const result = []
                        
                        for (let i = 0; i < data.length; i++) {
                            if (i < period - 1) {
                                result.push(NaN)
                                continue
                            }
                            
                            const slice = data.slice(i - period + 1, i + 1)
                            result.push(fn(slice))
                        }
                        return result
                    }
                    
                    // Rolling Min/Max
                    const rollingMax = (data, period) => {
                        const result = []
                        
                        for (let i = 0; i < data.length; i++) {
                            if (i < period - 1) {
                                result.push(NaN)
                                continue
                            }
                            
                            const slice = data.slice(i - period + 1, i + 1)
                            result.push(Math.max(...slice))
                        }
                        return result
                    }
                    
                    const rollingMin = (data, period) => {
                        const result = []
                        
                        for (let i = 0; i < data.length; i++) {
                            if (i < period - 1) {
                                result.push(NaN)
                                continue
                            }
                            
                            const slice = data.slice(i - period + 1, i + 1)
                            result.push(Math.min(...slice))
                        }
                        return result
                    }
                    
                    // Indikatorberechnungen
                    const rk3 = calcEMA(ys1, smoother)
                    const rk4 = calcStd(ys1, smoother)
                    
                    // Behandlung von Division durch Null
                    const minStd = ys1.reduce((a, b) => a + b, 0) / ys1.length * 0.0001
                    const rk4Safe = rk4.map(x => Math.max(x, minStd))
                    
                    // Normalisierte Preisdifferenz
                    const rk5 = ys1.map((y, i) => (y - rk3[i]) * 200 / rk4Safe[i])
                    const rk6 = calcEMA(rk5, smoother)
                    const up = calcEMA(rk6, smoother)
                    const down = calcEMA(up, smoother)
                    
                    // Trendstärke berechnen
                    const trendStrength = up.map((u, i) => {
                        const denominator = (Math.abs(u) + Math.abs(down[i])) / 2
                        return denominator !== 0 ? (u - down[i]) / denominator : 0
                    })
                    
                    // Filtere schwache Trends
                    const strongTrend = trendStrength.map(t => Math.abs(t) > trendThreshold)
                    
                    // Trendbestimmung
                    const isUptrend = up.map((u, i) => u > down[i] && strongTrend[i])
                    
                    // OHLC-Werte für die Visualisierung
                    const minVal = up.map((u, i) => Math.min(u, down[i]))
                    const maxVal = up.map((u, i) => Math.max(u, down[i]))
                    
                    // Künstliche OHLC-Werte
                    const Oo = up.map((u, i) => isUptrend[i] ? minVal[i] : maxVal[i])
                    const Cc = up.map((u, i) => isUptrend[i] ? maxVal[i] : minVal[i])
                    
                    // Dochte für bessere Visualisierung
                    const wickRange = maxVal.map((m, i) => (m - minVal[i]) * 0.1)
                    const Hh = maxVal.map((m, i) => m + wickRange[i])
                    const Ll = minVal.map((m, i) => m - wickRange[i])
                    
                    // Farben
                    const vcolor = isUptrend.map(up => up ? '#4CAF50' : '#FF5252')
                    
                    // Support/Resistance berechnen
                    const osc = rollingApply(close, pricePeriod, (slice) => {
                        const mean = slice.reduce((a, b) => a + b, 0) / slice.length
                        const diffs = slice.map(x => x - mean)
                        const sumDiffs = diffs.reduce((a, b) => a + b, 0)
                        
                        // Berechne Standardabweichung
                        const sqDiffs = diffs.map(diff => diff * diff)
                        const variance = sqDiffs.reduce((a, b) => a + b, 0) / slice.length
                        const std = Math.sqrt(variance)
                        
                        return sumDiffs / Math.max(std, 0.0001)
                    })
                    
                    const value1 = osc
                    const value2 = rollingMax(value1, supResPeriod)
                    const value3 = rollingMin(value1, supResPeriod)
                    const value4 = value2.map((v, i) => v - value3[i])
                    const value5 = value4.map(v => v * (supResPercentage / 100))
                    
                    const resistanceLine = value3.map((v, i) => v + value5[i])
                    const supportLine = value2.map((v, i) => v - value5[i])
                    
                    // OB/OS-Markierungen
                    const strongUp = up.map((u, i) => u > ob && trendStrength[i] > 0.2)
                    const strongDown = down.map((d, i) => d < os && trendStrength[i] < -0.2)
                    
                    // Candles erstellen
                    const candles = timestamps.map((t, i) => [
                        t,           // time
                        Oo[i],       // open
                        Hh[i],       // high
                        Ll[i],       // low
                        Cc[i],       // close
                        vcolor[i]    // color
                    ])
                    
                    // Ausgabe erstellen
                    this.v = candles
                    
                    // Support/Resistance Linien
                    if (dynamic) {
                        let lines = []
                        
                        // Resistance Line
                        lines.push({
                            value: resistanceLine[resistanceLine.length - 1],
                            color: '#FF9800',
                            text: 'Resistance'
                        })
                        
                        // Support Line
                        lines.push({
                            value: supportLine[supportLine.length - 1],
                            color: '#2196F3',
                            text: 'Support'
                        })
                        
                        this.bands = lines
                    }
                    
                    // OB/OS-Markierungen
                    if (showObOs) {
                        this.bands.push({
                            value: ob,
                            color: '#FF5252',
                            width: 1,
                            text: 'Überkauft'
                        })
                        
                        this.bands.push({
                            value: os,
                            color: '#4CAF50',
                            width: 1,
                            text: 'Überverkauft'
                        })
                    }
                    
                    // Markierungen für starke Trends
                    const upMarkers = []
                    const downMarkers = []
                    
                    for (let i = 0; i < timestamps.length; i++) {
                        if (strongUp[i] && isUptrend[i]) {
                            upMarkers.push([timestamps[i], Math.max(...up.slice(Math.max(0, i-1), i+1)) + 20])
                        } else if (strongDown[i] && !isUptrend[i]) {
                            downMarkers.push([timestamps[i], Math.min(...down.slice(Math.max(0, i-1), i+1)) - 20])
                        }
                    }
                    
                    // Zusätzliche Indikatoren
                    this.tool = 'Candles' // Renderer als Candles
                `
            }
        }
    }
}
</script>