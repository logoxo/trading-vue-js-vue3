<template>
  <div class="chart-container">
    <div ref="chartContainer" class="tv-lightweight-chart"></div>
  </div>
</template>

<script>
import { createChart } from 'lightweight-charts';

export default {
  name: 'LightweightChart',
  props: {
    // Candlestick data in format [{time, open, high, low, close}, ...]
    candleData: {
      type: Array,
      required: true
    },
    // Volume data in format [{time, value}, ...]
    volumeData: {
      type: Array,
      default: () => []
    },
    // Array of indicator data [{name, data, options}, ...]
    // Where data is in format [{time, value}, ...]
    indicators: {
      type: Array,
      default: () => []
    },
    width: {
      type: Number,
      default: 800
    },
    height: {
      type: Number,
      default: 500
    },
    // Theme: 'light' or 'dark'
    theme: {
      type: String,
      default: 'dark'
    },
    // Options to customize chart appearance
    options: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      chart: null,
      candleSeries: null,
      volumeSeries: null,
      indicatorSeries: {},
      resizeObserver: null
    };
  },
  mounted() {
    this.initChart();
    
    // Handle resize events
    this.resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (this.chart) {
        this.chart.resize(width, height);
      }
    });
    this.resizeObserver.observe(this.$refs.chartContainer);
  },
  beforeUnmount() {
    // Clean up
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.chart) {
      this.chart.remove();
    }
  },
  watch: {
    candleData: {
      handler(newData) {
        if (this.candleSeries && newData.length) {
          this.candleSeries.setData(newData);
        }
      },
      deep: true
    },
    volumeData: {
      handler(newData) {
        if (this.volumeSeries && newData.length) {
          this.volumeSeries.setData(newData);
        }
      },
      deep: true
    },
    indicators: {
      handler(newIndicators) {
        this.updateIndicators(newIndicators);
      },
      deep: true
    },
    width(newWidth) {
      if (this.chart) {
        this.chart.resize(newWidth, this.height);
      }
    },
    height(newHeight) {
      if (this.chart) {
        this.chart.resize(this.width, newHeight);
      }
    },
    theme(newTheme) {
      this.updateChartOptions({ layout: { 
        background: { color: newTheme === 'dark' ? '#191919' : '#ffffff' },
        textColor: newTheme === 'dark' ? '#D9D9D9' : '#191919'
      }});
    },
    options: {
      handler(newOptions) {
        this.updateChartOptions(newOptions);
      },
      deep: true
    }
  },
  methods: {
    initChart() {
      const isLight = this.theme === 'light';
      
      // Create chart with default options
      this.chart = createChart(this.$refs.chartContainer, {
        width: this.width,
        height: this.height,
        layout: {
          background: { color: isLight ? '#ffffff' : '#191919' },
          textColor: isLight ? '#191919' : '#D9D9D9',
        },
        grid: {
          vertLines: { color: isLight ? '#E6E6E6' : '#292929' },
          horzLines: { color: isLight ? '#E6E6E6' : '#292929' },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            width: 1,
            color: '#999',
            style: 0,
          },
          horzLine: {
            width: 1,
            color: '#999',
            style: 0,
          },
        },
        timeScale: {
          borderColor: isLight ? '#E6E6E6' : '#292929',
          timeVisible: true,
          secondsVisible: false,
          tickMarkFormatter: (time) => {
            const date = new Date(time * 1000);
            return date.getHours().toString().padStart(2, '0') + ':' + 
                   date.getMinutes().toString().padStart(2, '0');
          },
        },
        ...this.options
      });
      
      // Create candlestick series
      this.candleSeries = this.chart.addCandlestickSeries({
        upColor: '#4CAF50',
        downColor: '#FF5252',
        borderVisible: false,
        wickUpColor: '#4CAF50',
        wickDownColor: '#FF5252',
      });
      
      // Add candlestick data
      if (this.candleData.length) {
        this.candleSeries.setData(this.candleData);
      }
      
      // Add volume if provided
      if (this.volumeData.length) {
        this.addVolume();
      }
      
      // Add indicators if provided
      if (this.indicators.length) {
        this.updateIndicators(this.indicators);
      }
      
      // Apply custom options
      if (Object.keys(this.options).length) {
        this.updateChartOptions(this.options);
      }
    },
    
    addVolume() {
      // Create volume series
      this.volumeSeries = this.chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
      
      // Set data
      this.volumeSeries.setData(this.volumeData);
    },
    
    updateIndicators(indicators) {
      // Get current indicator IDs
      const currentIds = Object.keys(this.indicatorSeries);
      
      // Get new indicator IDs
      const newIds = indicators.map(ind => ind.name);
      
      // Remove indicators that are no longer needed
      currentIds.forEach(id => {
        if (!newIds.includes(id)) {
          this.chart.removeSeries(this.indicatorSeries[id]);
          delete this.indicatorSeries[id];
        }
      });
      
      // Add or update indicators
      indicators.forEach(indicator => {
        if (currentIds.includes(indicator.name)) {
          // Update existing indicator
          this.indicatorSeries[indicator.name].setData(indicator.data);
        } else {
          // Add new indicator
          const defaultOptions = {
            lineWidth: 2,
            color: '#2196F3',
            priceScaleId: 'right',
            lastValueVisible: true,
            priceLineVisible: true,
          };
          
          const series = this.chart.addLineSeries({
            ...defaultOptions,
            ...indicator.options
          });
          series.setData(indicator.data);
          this.indicatorSeries[indicator.name] = series;
        }
      });
    },
    
    updateChartOptions(options) {
      if (!this.chart) return;
      this.chart.applyOptions(options);
    },
    
    // Public method to add markers
    addMarkers(markers) {
      if (!this.candleSeries) return;
      this.candleSeries.setMarkers(markers);
    },
    
    // Public method to fit content
    fitContent() {
      if (!this.chart) return;
      this.chart.timeScale().fitContent();
    }
  }
}
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
}
.tv-lightweight-chart {
  width: 100%;
  height: 100%;
}
</style>