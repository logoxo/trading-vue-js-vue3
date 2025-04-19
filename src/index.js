import TradingVue from './TradingVue.vue'
import DataCube from './helpers/datacube.js'
import Overlay from './mixins/overlay.js'
import Tool from './mixins/tool.js'
import Interface from './mixins/interface.js'
import Utils from './stuff/utils.js'
import Constants from './stuff/constants.js'
import Candle from './components/primitives/candle.js'
import Volbar from './components/primitives/volbar.js'
import Line from './components/primitives/line.js'
import Pin from './components/primitives/pin.js'
import Price from './components/primitives/price.js'
import Ray from './components/primitives/ray.js'
import Seg from './components/primitives/seg.js'

import { layout_cnv, layout_vol } from
    './components/js/layout_cnv.js'

const primitives = {
    Candle, Volbar, Line, Pin, Price, Ray, Seg
}

// Vue 3 plugin installation
const TradingVuePlugin = {
  install: (app) => {
    app.component(TradingVue.name, TradingVue)
  }
}

// Expose library to window in browser environment
if (typeof window !== 'undefined') {
    window.TradingVueLib = {
        TradingVue, Overlay, Utils, Constants,
        Candle, Volbar, layout_cnv, layout_vol,
        DataCube, Tool, Interface, primitives
    }
}

export default TradingVue

export {
    TradingVuePlugin,
    TradingVue, Overlay, Utils, Constants,
    Candle, Volbar, layout_cnv, layout_vol,
    DataCube, Tool, Interface, primitives
}
