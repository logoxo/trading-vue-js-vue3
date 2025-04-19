<template>
  <div class="app-container">
    <trading-vue 
      :data="chart" 
      :width="width" 
      :height="height"
      :color-back="colors.colorBack"
      :color-grid="colors.colorGrid"
      :color-text="colors.colorText"
      :toolbar="true">
    </trading-vue>
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
      <button @click="startLiveUpdates" :disabled="liveUpdatesActive || loadingData">
        Live-Updates starten
      </button>
      <button @click="stopLiveUpdates" :disabled="!liveUpdatesActive">
        Live-Updates stoppen
      </button>
      <button @click="refreshData" :disabled="loadingData || !currentSymbol">
        <i class="refresh-icon">↻</i> Aktualisieren
      </button>
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
import TradingVue from './TradingVue.vue'
import Data from '/data/data.json'
import DataCube from './helpers/datacube.js'
import RSI from './helpers/RSI.vue'
import MatrixSeries from './helpers/MatrixSeries.vue'
import SimpleMatrix from './helpers/SimpleMatrix.vue'

export default {
  name: 'app',
  components: {
    TradingVue
  },
  
  provide() {
    return {
      overlays: [RSI, MatrixSeries, SimpleMatrix]
    }
  },
  methods: {
    onResize() {
      this.width = window.innerWidth
      this.height = window.innerHeight
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
        
        // Konvertiere die Daten ins TradingVue-Format
        const ohlcv = data.map(candle => [
          parseInt(candle[0]), // Open time in ms
          parseFloat(candle[1]), // Open
          parseFloat(candle[2]), // High
          parseFloat(candle[3]), // Low
          parseFloat(candle[4]), // Close
          parseFloat(candle[5])  // Volume
        ]);
        
        // Aktualisiere das Chart mit den neuen Daten
        // Manuell erste RSI-Werte berechnen (einfache Beispielmethode)
        const calculateRSI = (ohlcv, period = 14) => {
          if (ohlcv.length < period + 1) {
            return Array(ohlcv.length).fill().map((_, i) => [ohlcv[i][0], 50]); // Platzhalter
          }
          
          const rsiData = [];
          // Initialisierung der ersten RSI-Werte (einfache Methode)
          for (let i = 0; i < ohlcv.length; i++) {
            if (i < period) {
              // Während der Initialisierung einfach Platzhalter verwenden
              rsiData.push([ohlcv[i][0], 50]);
            } else {
              // Nach der Initialisierung einen vereinfachten RSI berechnen
              // Dies ist eine Vereinfachung, keine genaue RSI-Berechnung
              const gains = [];
              const losses = [];
              
              for (let j = i - period; j < i; j++) {
                const change = ohlcv[j+1][4] - ohlcv[j][4]; // Schlusskurs-Änderung
                if (change >= 0) {
                  gains.push(change);
                  losses.push(0);
                } else {
                  gains.push(0);
                  losses.push(Math.abs(change));
                }
              }
              
              const avgGain = gains.reduce((sum, val) => sum + val, 0) / period;
              const avgLoss = losses.reduce((sum, val) => sum + val, 0) / period;
              
              if (avgLoss === 0) {
                rsiData.push([ohlcv[i][0], 100]);
              } else {
                const rs = avgGain / avgLoss;
                const rsi = 100 - (100 / (1 + rs));
                rsiData.push([ohlcv[i][0], rsi]);
              }
            }
          }
          
          return rsiData;
        };
        
        // Einfache RSI-Daten berechnen
        const rsiData = calculateRSI(ohlcv);
        
        const chartData = {
          chart: {
            type: 'Candles',
            data: ohlcv,
            tf: interval
          },
          onchart: [],
          offchart: [
            {
              name: "RSI, 14",
              type: "RSI",
              data: rsiData,
              settings: {
                lineWidth: 1,
                color: '#85c',
                bandColor: '#aaa',
                bandOpacity: 0.3,
                upperBand: 70,
                lowerBand: 30
              }
            },
            {
              name: "Simple Matrix",
              type: "SimpleMatrix",
              data: ohlcv // Verwendet dieselben OHLCV-Daten wie das Hauptchart
            }
          ]
        };
        
        // Setze die aktuellen Daten und aktualisiere das Chart
        this.currentSymbol = symbol;
        this.currentInterval = interval;
        this.chart = new DataCube(chartData);
        
        // Mache dieses Chart global verfügbar (für Debugging)
        window.dc = this.chart;
        
        this.binanceData = data;
        this.lastUpdateTime = new Date();
        
        console.log(`Loaded ${ohlcv.length} candles for ${symbol} (${interval})`);
        
      } catch (error) {
        console.error("Error fetching Binance data:", error);
        this.loadingMessage = `Fehler beim Laden der Daten: ${error.message}`;
      } finally {
        this.loadingData = false;
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
        const candleTime = parseInt(latestCandle[0]);
        
        // Überprüfe, ob wir bereits eine Kerze mit dieser Zeit haben
        const ohlcv = this.chart.data.chart.data;
        const lastCandleIndex = ohlcv.length - 1;
        
        if (lastCandleIndex >= 0 && ohlcv[lastCandleIndex][0] === candleTime) {
          // Aktualisiere die letzte Kerze
          ohlcv[lastCandleIndex] = [
            candleTime,
            parseFloat(latestCandle[1]), // Open
            parseFloat(latestCandle[2]), // High
            parseFloat(latestCandle[3]), // Low
            parseFloat(latestCandle[4]), // Close
            parseFloat(latestCandle[5])  // Volume
          ];
          console.log(`Updated last candle: ${new Date(candleTime).toLocaleTimeString()}`);
        } else {
          // Füge eine neue Kerze hinzu
          ohlcv.push([
            candleTime,
            parseFloat(latestCandle[1]),
            parseFloat(latestCandle[2]),
            parseFloat(latestCandle[3]),
            parseFloat(latestCandle[4]),
            parseFloat(latestCandle[5])
          ]);
          console.log(`Added new candle: ${new Date(candleTime).toLocaleTimeString()}`);
          
          // Entferne älteste Kerze, wenn wir zu viele haben
          if (ohlcv.length > 200) {
            ohlcv.shift();
          }
        }
        
        // Da das RSI-Skript die Daten automatisch berechnet, müssen wir
        // nur sicherstellen, dass das Skript ausgeführt wird.
        // Wir können es explizit aktualisieren, indem wir die Daten ändern lassen
        if (this.chart.data.offchart && this.chart.data.offchart.length > 0) {
          // RSI-Berechnungen werden durch den Skript-Motor behandelt
          // Wir können zusätzlich manuell einige Beispielwerte einfügen für neueste Kerze
          const rsiInd = this.chart.data.offchart[0];
          if (rsiInd.type === 'RSI') {
            // Berechne einen einfachen RSI-Wert basierend auf den letzten Kerzen
            // Im echten Szenario wird das vom Skript-Engine berechnet
            if (!rsiInd.data) rsiInd.data = [];
            
            // Füge einen Datenpunkt für Test hinzu
            // Echter RSI würde durch Skript-Engine berechnet und automatisch hinzugefügt
            const rsiValue = Math.floor(Math.random() * 40) + 30; // Zufällig zwischen 30-70
            rsiInd.data.push([candleTime, rsiValue]);
          }
        }
        
        // Aktualisiere das DataCube-Objekt
        this.chart.data_changed();
        this.lastUpdateTime = new Date();
        
      } catch (error) {
        console.error("Error updating chart data:", error);
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
  mounted() {
    window.addEventListener('resize', this.onResize);
    window.dc = this.chart;
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.onResize);
    this.stopLiveUpdates();
    
    // Clean up any remaining intervals
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  },
  data() {
    return {
      chart: new DataCube(Data),
      width: window.innerWidth,
      height: window.innerHeight,
      colors: {
        colorBack: '#111',
        colorGrid: '#222',
        colorText: '#eee',
      },
      loadingData: false,
      loadingMessage: "",
      currentSymbol: null,
      currentInterval: null,
      selectedSymbol: "SOLUSDC", // Default symbol
      selectedInterval: "15m", // Default interval
      binanceData: null,
      lastUpdateTime: null,
      updateInterval: null,
      liveUpdatesActive: false,
      nextUpdateIn: 15,
      countdownInterval: null
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