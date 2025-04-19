<script>
// Sets up all layers/overlays for the grid with 'grid_id'

import Grid from './js/grid.js'
import Canvas from '../mixins/canvas.js'
import UxList from '../mixins/uxlist.js'
import { h, defineComponent } from 'vue'
import Crosshair from './Crosshair.vue'
import KeyboardListener from './KeyboardListener.vue'
import UxLayer from './UxLayer.vue'

import Spline from "./overlays/Spline.vue"
import Splines from "./overlays/Splines.vue"
import Range from "./overlays/Range.vue"
import Trades from "./overlays/Trades.vue"
import Channel from "./overlays/Channel.vue"
import Segment from "./overlays/Segment.vue"
import Candles from "./overlays/Candles.vue"
import Volume from "./overlays/Volume.vue"
import Splitters from "./overlays/Splitters.vue"
import LineTool from "./overlays/LineTool.vue"
import RangeTool from "./overlays/RangeTool.vue"


export default defineComponent({
    name: 'Grid',
    props: [
        'sub', 'layout', 'range', 'interval', 'cursor', 'colors', 'overlays',
        'width', 'height', 'data', 'grid_id', 'y_transform', 'font', 'tv_id',
        'config', 'meta', 'shaders'
    ],
    mixins: [Canvas, UxList],
    components: { Crosshair, KeyboardListener },
    created() {
        // List of all possible overlays (builtin + custom)
        this._list = [
            Spline, Splines, Range, Trades, Channel, Segment,
            Candles, Volume, Splitters, LineTool, RangeTool
        ]
        .concat(this.$props.overlays)
        this._registry = {}

        // We need to know which components we will use.
        // Custom overlay components overwrite built-ins:
        var tools = []
        
        console.log('Registering tools from components:', this._list.map(x => x.name));
        
        // Make sure LineTool is included in the registry
        let hasLineTool = false;
        let manualTools = [];
        
        this._list.forEach((x, i) => {
            // Debug info to determine if methods are correctly defined
            let component_methods = x.methods || {};
            let has_use_for = typeof component_methods.use_for === 'function';
            let has_tool = typeof component_methods.tool === 'function';
            
            console.log(`Component ${x.name}: has use_for=${has_use_for}, has tool=${has_tool}`);
            
            // Some components might not have methods defined correctly
            let use_for = has_use_for ? component_methods.use_for() : [];
            
            // Check if this is a LineTool component
            if (x.name === 'LineTool') {
                hasLineTool = true;
                // Make sure LineTool is registered for different line types
                if (!use_for.includes('LineTool')) {
                    use_for.push('LineTool');
                }
                if (!use_for.includes('Segment')) {
                    use_for.push('Segment');
                }
                if (!use_for.includes('Ray')) {
                    use_for.push('Ray');
                }
                if (!use_for.includes('Extended')) {
                    use_for.push('Extended');
                }
            }
            
            if (has_tool) {
                let tool_info = component_methods.tool();
                console.log(`Tool info for ${x.name}:`, tool_info);
                tools.push({
                    use_for, info: tool_info
                });
                
                // Special case for LineTool
                if (x.name === 'LineTool') {
                    // Manually create tool registrations for Segment, Ray, and Extended
                    if (tool_info) {
                        // Segment tool
                        manualTools.push({
                            use_for: ['Segment'],
                            info: {
                                type: 'Segment',
                                name: 'Line Segment',
                                icon: tool_info.icon || tool_info.mods?.Segment?.icon,
                                group: 'Lines',
                                data: [],
                                settings: {}
                            }
                        });
                        
                        // Extended line tool
                        manualTools.push({
                            use_for: ['Extended'],
                            info: {
                                type: 'Extended',
                                name: 'Extended Line',
                                icon: tool_info.mods?.Extended?.icon,
                                group: 'Lines',
                                data: [],
                                settings: { extended: true }
                            }
                        });
                        
                        // Ray tool
                        manualTools.push({
                            use_for: ['Ray'],
                            info: {
                                type: 'Ray',
                                name: 'Ray',
                                icon: tool_info.mods?.Ray?.icon,
                                group: 'Lines',
                                data: [],
                                settings: { ray: true }
                            }
                        });
                    }
                }
            }
            
            use_for.forEach(indicator => {
                console.log(`Registering ${indicator} -> ${i}`);
                this._registry[indicator] = i;
            });
        });
        
        // Add the manual tools to the list
        tools = tools.concat(manualTools);
        
        // Make sure we manually add basic line drawing tools if they weren't registered
        if (!hasLineTool) {
            console.warn('LineTool component not found or not properly registered, adding manual registration');
            
            // Find LineTool index
            let lineToolIndex = this._list.findIndex(x => x.name === 'LineTool');
            if (lineToolIndex >= 0) {
                this._registry['LineTool'] = lineToolIndex;
                this._registry['Segment'] = lineToolIndex;
                this._registry['Extended'] = lineToolIndex;
                this._registry['Ray'] = lineToolIndex;
            }
        }
        
        console.log('Registering tools:', tools);
        this.$emit('custom-event', {
            event: 'register-tools', args: tools
        });
        
        // Init toolbar with basic tools
        this.$emit('custom-event', {
            event: 'init-toolbar-tools', 
            args: [
                { type: 'Segment', name: 'Line Segment', icon: 'segment.png' },
                { type: 'Extended', name: 'Extended Line', icon: 'extended.png', settings: { extended: true } },
                { type: 'Ray', name: 'Ray', icon: 'ray.png', settings: { ray: true } }
            ]
        });
        
        // Force a re-emit after a delay to ensure tools are registered
        setTimeout(() => {
            console.log('Re-emitting tools registration');
            this.$emit('custom-event', {
                event: 'register-tools', args: tools
            });
        }, 500);
        
        // Note: $on was removed in Vue 3, we'll use the onCustomEvent prop instead
    },
    beforeUnmount () {
        if (this.renderer && typeof this.renderer.destroy === 'function') {
            this.renderer.destroy()
        }
    },
    mounted() {
        // Initialize renderer once DOM is ready
        this.$nextTick(() => {
            if (this.$refs.canvas) {
                this.renderer = new Grid(this.$refs.canvas, this)
                this.setup()
                this.redraw()
                // Mark renderer as ready
                this.rendererReady = true
                // Process any pending layer operations
                this.processQueuedOperations()
            } else {
                console.error('Grid canvas ref not found')
            }
        })
    },
    // In Vue 3, we use this method to handle custom events instead of $on
    customEventHandler(e) {
        this.on_ux_event(e, 'grid')
    },
    render() {
        const id = this.$props.grid_id
        const layout = this.$props.layout.grids[id]
        return this.create_canvas(h, `grid-${id}`, {
            position: {
                x: 0,
                y: layout.offset || 0
            },
            attrs: {
                width: layout.width,
                height: layout.height,
                overflow: 'hidden'
            },
            style: {
                backgroundColor: this.$props.colors.back
            },
            hs: [
                h(Crosshair, {
                    cursor: this.$props.cursor,
                    colors: this.$props.colors,
                    layout: this.$props.layout.grids[this.$props.grid_id],
                    sub: this.$props.sub,
                    onNewGridLayer: this.layer_events['new-grid-layer'],
                    onDeleteGridLayer: this.layer_events['delete-grid-layer'],
                    onShowGridLayer: this.layer_events['show-grid-layer'],
                    onRedrawGrid: this.layer_events['redraw-grid'],
                    onLayerMetaProps: this.layer_events['layer-meta-props'],
                    onCustomEvent: this.layer_events['custom-event']
                }),
                h(KeyboardListener, {
                    onRegisterKbListener: this.keyboard_events['register-kb-listener'],
                    onRemoveKbListener: this.keyboard_events['remove-kb-listener'],
                    onKeyup: this.keyboard_events['keyup'],
                    onKeydown: this.keyboard_events['keydown'],
                    onKeypress: this.keyboard_events['keypress']
                }),
                h(UxLayer, {
                    id, 
                    tv_id: this.$props.tv_id,
                    uxs: this.uxs,
                    colors: this.$props.colors,
                    config: this.$props.config,
                    updater: Math.random(),
                    onCustomEvent: this.emit_ux_event
                })
            ].concat(this.get_overlays(h))
        })
    },
    methods: {
        new_layer(layer) {
            if (!this.rendererReady) {
                this.queueOperation('new_layer', layer)
                return
            }
            
            this.$nextTick(() => {
                if (this.renderer && typeof this.renderer.new_layer === 'function') {
                    this.renderer.new_layer(layer)
                } else {
                    console.warn('Grid renderer not ready or missing new_layer method')
                }
            })
        },
        del_layer(layer) {
            if (!this.rendererReady) {
                this.queueOperation('del_layer', layer)
                return
            }
            
            this.$nextTick(() => {
                if (this.renderer && typeof this.renderer.del_layer === 'function') {
                    this.renderer.del_layer(layer)
                } else {
                    console.warn('Grid renderer not ready or missing del_layer method')
                }
            })
            const grid_id = this.$props.grid_id
            this.$emit('custom-event', {
                event: 'remove-shaders',
                args: [grid_id, layer]
            })
            // TODO: close all interfaces
            this.$emit('custom-event', {
                event: 'remove-layer-meta',
                args: [grid_id, layer]
            })
            this.remove_all_ux(layer)
        },
        
        // Queue operations to be executed when renderer is ready
        queueOperation(type, data) {
            this.pendingOperations.push({ type, data })
        },
        
        // Process any operations that were queued before the renderer was ready
        processQueuedOperations() {
            if (!this.rendererReady || !this.renderer) return
            
            for (const op of this.pendingOperations) {
                if (op.type === 'new_layer' && typeof this.renderer.new_layer === 'function') {
                    this.renderer.new_layer(op.data)
                } else if (op.type === 'del_layer' && typeof this.renderer.del_layer === 'function') {
                    this.renderer.del_layer(op.data)
                } else if (op.type === 'show_hide_layer' && typeof this.renderer.show_hide_layer === 'function') {
                    this.renderer.show_hide_layer(op.data)
                }
            }
            
            // Clear the queue after processing
            this.pendingOperations = []
            
            // Make sure we redraw after applying all operations
            this.redraw()
        },
        get_overlays(h) {
            // Distributes overlay data & settings according
            // to this._registry; returns compo list
            let comp_list = [], count = {}

            for (var d of this.$props.data) {
                let comp = this._list[this._registry[d.type]]
                if (comp) {
                    if(comp.methods.calc) {
                        comp = this.inject_renderer(comp)
                    }
                    comp_list.push({
                        cls: comp,
                        type: d.type,
                        data: d.data,
                        settings: d.settings,
                        i0: d.i0,
                        tf: d.tf,
                        last: d.last
                    })
                    count[d.type] = 0
                }
            }
            return comp_list.map((x, i) => h(x.cls, {
                    onNewGridLayer: this.layer_events['new-grid-layer'],
                    onDeleteGridLayer: this.layer_events['delete-grid-layer'],
                    onShowGridLayer: this.layer_events['show-grid-layer'],
                    onRedrawGrid: this.layer_events['redraw-grid'],
                    onLayerMetaProps: this.layer_events['layer-meta-props'],
                    onCustomEvent: this.layer_events['custom-event'],
                    id: `${x.type}_${count[x.type]++}`,
                    type: x.type,
                    data: x.data,
                    settings: x.settings,
                    i0: x.i0,
                    tf: x.tf,
                    num: i,
                    grid_id: this.$props.grid_id,
                    meta: this.$props.meta,
                    last: x.last,
                    cursor: this.$props.cursor,
                    colors: this.$props.colors,
                    layout: this.$props.layout.grids[this.$props.grid_id],
                    interval: this.$props.interval,
                    sub: this.$props.sub,
                    font: this.$props.font,
                    config: this.$props.config
                })
            )
        },
        common_props() {
            return {
                cursor: this.$props.cursor,
                colors: this.$props.colors,
                layout: this.$props.layout.grids[this.$props.grid_id],
                interval: this.$props.interval,
                sub: this.$props.sub,
                font: this.$props.font,
                config: this.$props.config,
            }
        },
        emit_ux_event(e) {
            let e_pass = this.on_ux_event(e, 'grid')
            if (e_pass) this.$emit('custom-event', e)
        },
        // Replace the current comp with 'renderer'
        inject_renderer(comp) {
            let src = comp.methods.calc()
            if (!src.conf || !src.conf.renderer || comp.__renderer__) {
                return comp
            }

            // Search for an overlay with the target 'name'
            let f = this._list.find(x => x.name === src.conf.renderer)
            if (!f) return comp

            comp.mixins.push(f)
            comp.__renderer__ = src.conf.renderer

            return comp
        }
    },
    computed: {
        is_active() {
            return this.$props.cursor.t !== undefined &&
            this.$props.cursor.grid_id === this.$props.grid_id
        }
    },
    watch: {
        range: {
            handler: function() {
                // TODO: Left-side render lag fix:
                // Overlay data is updated one tick later than
                // the main sub. Fast fix is to delay redraw()
                // call. It will be a solution until a better
                // one comes by.
                this.$nextTick(() => this.redraw())
            },
            deep: true
        },
        cursor: {
            handler: function() {
                if (!this.$props.cursor.locked) this.redraw()
            },
            deep: true
        },
        overlays: {
            // Track changes in calc() functions
            handler: function(ovs) {
                for (var ov of ovs) {
                    for (var comp of this.$children) {
                        if (typeof comp.id !== 'string') continue
                        let tuple = comp.id.split('_')
                        tuple.pop()
                        if (tuple.join('_') === ov.name) {
                            comp.calc = ov.methods.calc
                            if (!comp.calc) continue
                            let calc = comp.calc.toString()
                            if (calc !== ov.__prevscript__) {
                                comp.exec_script()
                            }
                            ov.__prevscript__ = calc
                        }
                    }
                }
            },
            deep: true
        },
        // Redraw on the shader list change
        shaders(n, p) { this.redraw() }
    },
    data() {
        return {
            rendererReady: false,
            pendingOperations: [],
            layer_events: {
                'new-grid-layer': this.new_layer,
                'delete-grid-layer': this.del_layer,
                'show-grid-layer': d => {
                    if (!this.rendererReady) {
                        this.queueOperation('show_hide_layer', d)
                        return
                    }
                    if (this.renderer && typeof this.renderer.show_hide_layer === 'function') {
                        this.renderer.show_hide_layer(d)
                        this.redraw()
                    }
                },
                'redraw-grid': this.redraw,
                'layer-meta-props': d => this.$emit('layer-meta-props', d),
                'custom-event': d => this.$emit('custom-event', d)
            },
            keyboard_events: {
                'register-kb-listener': event => {
                    this.$emit('register-kb-listener', event)
                },
                'remove-kb-listener': event => {
                    this.$emit('remove-kb-listener', event)
                },
                'keyup': event => {
                    if (!this.is_active) return
                    if (!this.rendererReady) return
                    if (this.renderer && typeof this.renderer.propagate === 'function') {
                        this.renderer.propagate('keyup', event)
                    }
                },
                'keydown': event => {
                    if (!this.is_active) return // TODO: is this neeeded?
                    if (!this.rendererReady) return
                    if (this.renderer && typeof this.renderer.propagate === 'function') {
                        this.renderer.propagate('keydown', event)
                    }
                },
                'keypress': event => {
                    if (!this.is_active) return
                    if (!this.rendererReady) return
                    if (this.renderer && typeof this.renderer.propagate === 'function') {
                        this.renderer.propagate('keypress', event)
                    }
                },
            }
        }
    }
})

</script>
