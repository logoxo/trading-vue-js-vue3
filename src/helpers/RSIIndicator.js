/**
 * RSI Indikator für lightweight-charts
 */
export default class RSIIndicator {
  constructor(period = 14) {
    this.period = period;
    this.prevGain = 0;
    this.prevLoss = 0;
    this.prices = [];
    this.results = [];
    this.initialized = false;
  }

  /**
   * Berechnet den RSI-Wert für eine Kerze
   * @param {Object} candle - Kerze mit {time, close}
   * @returns {Object} RSI-Datenpunkt {time, value} oder null wenn nicht genug Daten
   */
  update(candle) {
    this.prices.push(candle.close);
    
    // Wir brauchen mindestens period+1 Preisdaten für die erste Berechnung
    if (this.prices.length <= this.period) {
      return null;
    }

    // Bei der ersten Berechnung initialisieren wir die Werte
    if (!this.initialized) {
      return this.initialize(candle.time);
    }

    // Berechne die Preisänderung
    const change = this.prices[this.prices.length - 1] - this.prices[this.prices.length - 2];
    
    // Berechne Gewinne und Verluste
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    // Aktualisiere den durchschnittlichen Gewinn und Verlust mit der Smoothing-Formel
    const avgGain = (this.prevGain * (this.period - 1) + gain) / this.period;
    const avgLoss = (this.prevLoss * (this.period - 1) + loss) / this.period;
    
    // Speichere die Werte für die nächste Berechnung
    this.prevGain = avgGain;
    this.prevLoss = avgLoss;
    
    // Berechne den RSI
    let rsi;
    if (avgLoss === 0) {
      rsi = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
    }
    
    const result = { time: candle.time, value: rsi };
    this.results.push(result);
    
    return result;
  }

  /**
   * Initialisiere den RSI mit den ersten period+1 Werten
   * @param {string} time - Zeitstempel für den RSI-Wert
   * @returns {Object} RSI-Datenpunkt {time, value}
   */
  initialize(time) {
    let sumGain = 0;
    let sumLoss = 0;
    
    // Berechne die Summe der Gewinne und Verluste für die erste Periode
    for (let i = 1; i <= this.period; i++) {
      const change = this.prices[i] - this.prices[i - 1];
      sumGain += change > 0 ? change : 0;
      sumLoss += change < 0 ? -change : 0;
    }
    
    // Berechne die durchschnittlichen Gewinne und Verluste
    this.prevGain = sumGain / this.period;
    this.prevLoss = sumLoss / this.period;
    
    // Berechne den RSI
    let rsi;
    if (this.prevLoss === 0) {
      rsi = 100;
    } else {
      const rs = this.prevGain / this.prevLoss;
      rsi = 100 - (100 / (1 + rs));
    }
    
    this.initialized = true;
    const result = { time: time, value: rsi };
    this.results.push(result);
    
    return result;
  }

  /**
   * Berechnet RSI für ein Array von Kerzen
   * @param {Array} candles - Array von Kerzen im Format [{time, close}, ...]
   * @returns {Array} Array von RSI-Werten im Format [{time, value}, ...]
   */
  calculate(candles) {
    // Reset
    this.prices = [];
    this.results = [];
    this.initialized = false;
    this.prevGain = 0;
    this.prevLoss = 0;
    
    const rsiData = [];
    
    candles.forEach((candle) => {
      const rsi = this.update(candle);
      if (rsi) {
        rsiData.push(rsi);
      }
    });
    
    return rsiData;
  }
}