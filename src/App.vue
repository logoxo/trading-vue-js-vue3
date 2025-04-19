<template>
  <div class="app-container">
    <div class="chart-wrapper">
      <lightweight-chart 
        :candle-data="candleData"
        :indicators="indicators"
        :width="width"
        :height="height"
        :theme="chartTheme"
        ref="chart">
      </lightweight-chart>
    </div>
    
    <div v-if="loadingData" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">{{ loadingMessage }}</div>
    </div>
    
    <div class="data-controls">
      <div class="symbol-info" v-if="currentSymbol">
        {{ currentSymbol }} - {{ currentInterval }}
      </div>
      <div class="control-group">
        <label for="symbol">Symbol:</label>
        <select id="symbol" v-model="selectedSymbol" :disabled="loadingData || liveUpdatesActive">
          <option value="SOLUSDC">SOL/USDC</option>
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
          <option value="BNBUSDT">BNB/USDT</option>
          <option value="ADAUSDT">ADA/USDT</option>
        </select>
      </div>
      <div class="control-group">
        <label for="timeframe">Zeitrahmen:</label>
        <select id="timeframe" v-model="selectedInterval" :disabled="loadingData || liveUpdatesActive">
          <option value="1m">1 Minute</option>
          <option value="5m">5 Minuten</option>
          <option value="15m">15 Minuten</option>
          <option value="1h">1 Stunde</option>
          <option value="4h">4 Stunden</option>
          <option value="1d">1 Tag</option>
        </select>
      </div>
      <button @click="fetchBinanceData" :disabled="loadingData">
        {{ loadingData ? 'Lädt...' : 'Daten laden' }}
      </button>
      <button @click="toggleLiveUpdates" :disabled="loadingData || !currentSymbol">
        {{ liveUpdatesActive ? 'Live-Updates stoppen' : 'Live-Updates starten' }}
      </button>
      <button @click="refreshData" :disabled="loadingData || !currentSymbol">
        <i class="refresh-icon">↻</i> Aktualisieren
      </button>
      <div class="indicator-controls">
        <div class="indicator-toggle">
          <input type="checkbox" id="show-rsi" v-model="showRSI">
          <label for="show-rsi">RSI anzeigen</label>
        </div>
        <div class="indicator-toggle">
          <input type="checkbox" id="show-matrix" v-model="showMatrix">
          <label for="show-matrix">Matrix Series anzeigen</label>
        </div>
      </div>
      <div class="update-info" v-if="lastUpdateTime">
        Letztes Update: {{ formatUpdateTime() }}
      </div>
      <div class="update-info" v-if="liveUpdatesActive">
        Nächstes Update in {{ nextUpdateIn }} Sekunden
      </div>
    </div>
  </div>
</template>

<script>
import { createApp } from 'vue'
import LightweightChart from './helpers/LightweightChart.vue'
import RSIIndicator from './helpers/RSIIndicator.js'
import MatrixSeries from './helpers/MatrixSeries.js'

export default {
  name: 'app',
  components: {
    LightweightChart
  },
  methods: {
    onResize() {
      this.width = window.innerWidth
      this.height = window.innerHeight - 50
    },
    
    formatUpdateTime() {
      if (!this.lastUpdateTime) return '';
      
      const now = new Date();
      const diff = Math.floor((now - this.lastUpdateTime) / 1000); // Differenz in Sekunden
      
      if (diff < 60) {
        return `vor ${diff} Sekunden`;
      } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        return `vor ${minutes} Minuten`;
      } else {
        const hours = Math.floor(diff / 3600);
        return `vor ${hours} Stunden`;
      }
    },
    
    async fetchBinanceData() {
      this.loadingData = true;
      this.loadingMessage = `Lade ${this.selectedSymbol} Daten von Binance...`;
      
      try {
        // Verwende den Binance-API-Endpunkt
        const symbol = this.selectedSymbol;
        const interval = this.selectedInterval;
        const limit = 200; // Anzahl der Kerzen
        
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Konvertiere die Daten ins Lightweight-Charts-Format (Unix-Zeitstempel in Sekunden)
        const convertedData = data.map(candle => ({
          time: Math.floor(parseInt(candle[0]) / 1000), // Zeit in Sekunden
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5])
        }));
        
        // Speichere die Kerzen-Daten
        this.candleData = convertedData;
        
        // Aktualisiere die aktuellen Symbol- und Intervall-Informationen
        this.currentSymbol = symbol;
        this.currentInterval = interval;
        
        // Berechne RSI und Matrix Series Indikatoren
        this.updateIndicators();
        
        // Setze den Zeitstempel der letzten Aktualisierung
        this.lastUpdateTime = new Date();
        
        console.log(`Loaded ${convertedData.length} candles for ${symbol} (${interval})`);
        
      } catch (error) {
        console.error("Error fetching Binance data:", error);
        this.loadingMessage = `Fehler beim Laden der Daten: ${error.message}`;
      } finally {
        this.loadingData = false;
      }
    },
    
    // Aktualisiert alle Indikatoren basierend auf den aktuellen Kerzen-Daten
    updateIndicators() {
      // RSI berechnen
      const rsiData = this.showRSI 
        ? this.rsiIndicator.calculate(this.candleData)
        : [];
      
      // Matrix Series berechnen
      let matrixResult = null;
      if (this.showMatrix && this.candleData.length) {
        matrixResult = this.matrixIndicator.calculate(this.candleData);
      }
      
      // Setze die berechneten Indikatordaten
      this.indicators = [];
      
      // RSI zum Chart hinzufügen
      if (this.showRSI && rsiData.length) {
        this.indicators.push({
          name: 'RSI',
          data: rsiData,
          options: {
            color: '#85c',
            lineWidth: 2,
            priceScaleId: 'rsi',
            priceFormat: {
              type: 'custom',
              formatter: value => value.toFixed(2),
              minMove: 0.01,
            },
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          }
        });
        
        // Horizontal Lines bei 30 und 70
        this.indicators.push({
          name: 'RSI-70',
          data: rsiData.map(point => ({ time: point.time, value: 70 })),
          options: {
            color: 'rgba(255, 82, 82, 0.7)',
            lineWidth: 1,
            lineStyle: 1, // dashed
            priceScaleId: 'rsi',
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          }
        });
        
        this.indicators.push({
          name: 'RSI-30',
          data: rsiData.map(point => ({ time: point.time, value: 30 })),
          options: {
            color: 'rgba(76, 175, 80, 0.7)',
            lineWidth: 1,
            lineStyle: 1, // dashed
            priceScaleId: 'rsi',
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          }
        });
      }
      
      // Matrix Series zum Chart hinzufügen
      if (this.showMatrix && matrixResult) {
        // Up-Linie
        this.indicators.push({
          name: 'Matrix-Up',
          data: matrixResult.upLine,
          options: {
            color: '#4CAF50',
            lineWidth: 2,
            priceScaleId: 'matrix',
            scaleMargins: {
              top: 0.6,
              bottom: 0.1,
            },
          }
        });
        
        // Down-Linie
        this.indicators.push({
          name: 'Matrix-Down',
          data: matrixResult.downLine,
          options: {
            color: '#FF5252',
            lineWidth: 2,
            priceScaleId: 'matrix',
            scaleMargins: {
              top: 0.6,
              bottom: 0.1,
            },
          }
        });
      }
    },
    
    async refreshData() {
      if (!this.currentSymbol || this.loadingData) return;
      
      try {
        // Hole nur die neueste Kerze
        const symbol = this.currentSymbol;
        const interval = this.currentInterval;
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (!data || !data.length) return;
        
        const latestCandle = data[0];
        const time = Math.floor(parseInt(latestCandle[0]) / 1000);
        
        // Konvertiere die neueste Kerze
        const newCandle = {
          time: time,
          open: parseFloat(latestCandle[1]),
          high: parseFloat(latestCandle[2]),
          low: parseFloat(latestCandle[3]),
          close: parseFloat(latestCandle[4]),
          volume: parseFloat(latestCandle[5])
        };
        
        // Überprüfe, ob wir bereits eine Kerze mit dieser Zeit haben
        const lastCandleIndex = this.candleData.length - 1;
        
        if (lastCandleIndex >= 0 && this.candleData[lastCandleIndex].time === time) {
          // Ersetze die letzte Kerze
          this.candleData[lastCandleIndex] = newCandle;
          console.log(`Updated last candle: ${new Date(time * 1000).toLocaleTimeString()}`);
        } else {
          // Füge eine neue Kerze hinzu
          this.candleData.push(newCandle);
          console.log(`Added new candle: ${new Date(time * 1000).toLocaleTimeString()}`);
          
          // Entferne die älteste Kerze, wenn zu viele vorhanden sind
          if (this.candleData.length > 200) {
            this.candleData.shift();
          }
        }
        
        // Aktualisiere die Indikatoren
        this.updateIndicators();
        this.lastUpdateTime = new Date();
        
      } catch (error) {
        console.error("Error updating chart data:", error);
      }
    },
    
    toggleLiveUpdates() {
      if (this.liveUpdatesActive) {
        this.stopLiveUpdates();
      } else {
        this.startLiveUpdates();
      }
    },
    
    startLiveUpdates() {
      if (this.updateInterval) return;
      
      this.liveUpdatesActive = true;
      this.nextUpdateIn = 15;
      console.log("Starting live updates");
      
      // Countdown-Timer für nächstes Update
      this.countdownInterval = setInterval(() => {
        this.nextUpdateIn--;
        if (this.nextUpdateIn <= 0) {
          this.nextUpdateIn = 15;
        }
      }, 1000);
      
      // Aktualisiere alle 15 Sekunden
      this.updateInterval = setInterval(() => {
        this.refreshData();
      }, 15000); // 15 Sekunden
    },
    
    stopLiveUpdates() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
      
      this.liveUpdatesActive = false;
      console.log("Live updates stopped");
    }
  },
  
  watch: {
    showRSI() {
      this.updateIndicators();
    },
    showMatrix() {
      this.updateIndicators();
    }
  },
  
  mounted() {
    window.addEventListener('resize', this.onResize);
    this.onResize();
    
    // Lade die Daten beim Starten
    this.fetchBinanceData();
  },
  
  beforeUnmount() {
    window.removeEventListener('resize', this.onResize);
    this.stopLiveUpdates();
    
    // Bereinige verbleibende Intervalle
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  },
  
  data() {
    return {
      candleData: [],
      indicators: [],
      width: window.innerWidth,
      height: window.innerHeight - 50,
      chartTheme: 'dark',
      loadingData: false,
      loadingMessage: "",
      currentSymbol: null,
      currentInterval: null,
      selectedSymbol: "BTCUSDT", // Default symbol
      selectedInterval: "15m", // Default interval
      lastUpdateTime: null,
      updateInterval: null,
      liveUpdatesActive: false,
      nextUpdateIn: 15,
      countdownInterval: null,
      showRSI: true,
      showMatrix: true,
      // Instanzen der Indikatoren
      rsiIndicator: new RSIIndicator(14),
      matrixIndicator: new MatrixSeries()
    };
  }
};
</script>

<style>
html,
body {
  background-color: #000;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.app-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.chart-wrapper {
  width: 100%;
  height: 100%;
}

.data-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 4px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
}

.data-controls button {
  background-color: #2c3e50;
  color: white;
  border: none;
  border-radius: 3px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.data-controls button:hover:not(:disabled) {
  background-color: #34495e;
}

.data-controls button:disabled {
  background-color: #666;
  cursor: not-allowed;
  opacity: 0.7;
}

.indicator-controls {
  margin-top: 10px;
  border-top: 1px solid #444;
  padding-top: 10px;
}

.indicator-toggle {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.indicator-toggle label {
  color: white;
  margin-left: 5px;
  font-size: 14px;
}

.symbol-info {
  color: #42b983;
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
  text-align: center;
}

.control-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
}

.control-group label {
  color: white;
  margin-right: 10px;
  font-size: 14px;
}

.control-group select {
  flex: 1;
  background-color: #2c3e50;
  color: white;
  border: none;
  border-radius: 3px;
  padding: 6px 8px;
  font-size: 14px;
  cursor: pointer;
}

.control-group select:disabled {
  background-color: #666;
  cursor: not-allowed;
  opacity: 0.7;
}

.update-info {
  color: #888;
  font-size: 12px;
  margin-top: 8px;
  text-align: center;
}

.refresh-icon {
  display: inline-block;
  font-style: normal;
  font-size: 16px;
  margin-right: 4px;
  font-weight: bold;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-spinner {
  border: 6px solid rgba(255, 255, 255, 0.1);
  border-top: 6px solid #42b983;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.loading-text {
  color: white;
  font-size: 18px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>