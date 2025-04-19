/**
 * Matrix Series Indikator für lightweight-charts
 * Basierend auf dem Python-Code
 */
export default class MatrixSeries {
  constructor(options = {}) {
    // Parameter mit Standardwerten
    this.smoother = options.smoother || 5;
    this.supResPeriod = options.supResPeriod || 50;
    this.supResPercentage = options.supResPercentage || 100;
    this.pricePeriod = options.pricePeriod || 16;
    this.ob = options.ob || 200;
    this.os = options.os || -200;
    this.showObOs = options.showObOs || false;
    this.dynamic = options.dynamic || true;
    this.trendThreshold = options.trendThreshold || 0.05;
    
    // Berechnungsfelder
    this.prices = [];
    this.results = [];
    this.supportLine = [];
    this.resistanceLine = [];
  }

  /**
   * Berechnet Exponential Moving Average
   * @param {Array} data - Array von Preisdaten
   * @param {Number} period - EMA-Periode
   * @returns {Array} Array von EMA-Werten
   */
  ema(data, period) {
    const alpha = 2 / (period + 1);
    const result = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
    }
    
    return result;
  }

  /**
   * Berechnet Simple Moving Average
   * @param {Array} data - Array von Preisdaten
   * @param {Number} period - SMA-Periode
   * @returns {Array} Array von SMA-Werten
   */
  sma(data, period) {
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      
      result.push(sum / period);
    }
    
    return result;
  }

  /**
   * Berechnet Standardabweichung
   * @param {Array} data - Array von Preisdaten
   * @param {Number} period - Periode für die Standardabweichung
   * @returns {Array} Array von Standardabweichungswerten
   */
  stddev(data, period) {
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(0);
        continue;
      }
      
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      
      result.push(Math.sqrt(variance));
    }
    
    return result;
  }

  /**
   * Berechnet rollierende Funktion über Daten
   * @param {Array} data - Array von Preisdaten
   * @param {Number} period - Periode für die Funktion
   * @param {Function} fn - Funktion, die auf jedes Fenster angewendet wird
   * @returns {Array} Array von Ergebnissen
   */
  rolling(data, period, fn) {
    const result = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      
      const slice = data.slice(i - period + 1, i + 1);
      result.push(fn(slice));
    }
    
    return result;
  }

  /**
   * Berechnet Minimum über eine rollende Periode
   * @param {Array} data - Array von Preisdaten
   * @param {Number} period - Periode
   * @returns {Array} Array von Minimumwerten
   */
  rollingMin(data, period) {
    return this.rolling(data, period, slice => Math.min(...slice));
  }

  /**
   * Berechnet Maximum über eine rollende Periode
   * @param {Array} data - Array von Preisdaten
   * @param {Number} period - Periode
   * @returns {Array} Array von Maximumwerten
   */
  rollingMax(data, period) {
    return this.rolling(data, period, slice => Math.max(...slice));
  }

  /**
   * Berechnet Matrix Series für ein Array von Kerzen
   * @param {Array} candles - Array von Kerzen im Format [{time, open, high, low, close}, ...]
   * @returns {Object} Ergebnis mit Matrix-Series-Daten und Zusatzlinien
   */
  calculate(candles) {
    // Extrahiere die notwendigen Preisdaten
    const timeValues = candles.map(c => c.time);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    
    // Composite price (gewichteter Preis)
    const compositePrices = highs.map((h, i) => (h + lows[i] + closes[i] * 2) / 4);
    
    // EMA-Berechnungen
    const rk3 = this.ema(compositePrices, this.smoother);
    const rk4 = this.stddev(compositePrices, this.smoother);
    
    // Minimaler Standardabweichungswert für numerische Stabilität
    const meanPrice = compositePrices.reduce((a, b) => a + b, 0) / compositePrices.length;
    const minStd = meanPrice * 0.0001;
    const rk4Safe = rk4.map(std => Math.max(std, minStd));
    
    // Normalisierte Preisdifferenz
    const rk5 = compositePrices.map((price, i) => 
      (price - rk3[i]) * 200 / rk4Safe[i]
    );
    
    const rk6 = this.ema(rk5, this.smoother);
    const up = this.ema(rk6, this.smoother);
    const down = this.ema(up, this.smoother);
    
    // Trendstärke berechnen
    const trendStrength = up.map((u, i) => {
      const denominator = (Math.abs(u) + Math.abs(down[i])) / 2;
      return denominator !== 0 ? (u - down[i]) / denominator : 0;
    });
    
    // Starke Trends filtern
    const strongTrend = trendStrength.map(t => Math.abs(t) > this.trendThreshold);
    
    // Trendrichtung bestimmen
    const isUptrend = up.map((u, i) => u > down[i] && strongTrend[i]);
    
    // Künstliche OHLC-Werte
    const minVal = up.map((u, i) => Math.min(u, down[i]));
    const maxVal = up.map((u, i) => Math.max(u, down[i]));
    
    // Dochte für bessere Visualisierung
    const wickRange = maxVal.map((m, i) => (m - minVal[i]) * 0.1);
    
    // Daten für Candlestick-Serie
    const matrixCandles = timeValues.map((time, i) => {
      return {
        time: time,
        open: isUptrend[i] ? minVal[i] : maxVal[i],
        high: maxVal[i] + wickRange[i],
        low: minVal[i] - wickRange[i],
        close: isUptrend[i] ? maxVal[i] : minVal[i],
        color: isUptrend[i] ? '#4CAF50' : '#FF5252'
      };
    });
    
    // Daten für Linienserie (Up-Werte)
    const upLine = timeValues.map((time, i) => ({
      time: time,
      value: up[i]
    }));
    
    // Daten für Linienserie (Down-Werte)
    const downLine = timeValues.map((time, i) => ({
      time: time,
      value: down[i]
    }));
    
    // Support/Resistance berechnen
    // OSC - Preisoszillator
    const osc = this.rolling(closes, this.pricePeriod, (slice) => {
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const diffs = slice.map(x => x - mean);
      const sumDiffs = diffs.reduce((a, b) => a + b, 0);
      
      // Standardabweichung berechnen
      const sqDiffs = diffs.map(diff => diff * diff);
      const variance = sqDiffs.reduce((a, b) => a + b, 0) / slice.length;
      const std = Math.sqrt(variance);
      
      return sumDiffs / Math.max(std, 0.0001);
    });
    
    // Support- und Resistance-Berechnungen
    const value2 = this.rollingMax(osc, this.supResPeriod);
    const value3 = this.rollingMin(osc, this.supResPeriod);
    
    // Support- und Resistance-Linien
    const value4 = value2.map((v, i) => v !== null && value3[i] !== null ? v - value3[i] : null);
    const value5 = value4.map(v => v !== null ? v * (this.supResPercentage / 100) : null);
    
    const resistanceLine = value3.map((v, i) => 
      v !== null && value5[i] !== null ? v + value5[i] : null
    );
    
    const supportLine = value2.map((v, i) => 
      v !== null && value5[i] !== null ? v - value5[i] : null
    );
    
    // Gebe alle berechneten Daten zurück
    return {
      matrix: matrixCandles,
      upLine: upLine,
      downLine: downLine,
      supportLine: this.dynamic ? supportLine : [],
      resistanceLine: this.dynamic ? resistanceLine : [],
      ob: this.ob,
      os: this.os
    };
  }
}