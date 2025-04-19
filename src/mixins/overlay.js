
// Usuful stuff for creating overlays. Include as mixin

import Mouse from '../stuff/mouse.js'
import { h } from 'vue'

export default {
    props: [
        'id', 'num', 'interval', 'cursor', 'colors',
        'layout', 'sub', 'data', 'settings', 'grid_id',
        'font', 'config', 'meta', 'tf', 'i0', 'last'
    ],
    mounted() {
        // TODO(1): when hot reloading, dynamicaly changed mixins
        // dissapear (cuz it's a hack), the only way for now
        // is to reload the browser
        if (!this.draw) {
            this.draw = ctx => {
                let text = 'EARLY ADOPTER BUG: reload the browser & enjoy'
                console.warn(text)
            }
        }
        // Main chart?
        let main = this.$props.sub === this.$props.data

        this.meta_info()

        // Support both Vue 2 and Vue 3 emit patterns
        try {
            this.setupEmit()
            
            // Using helper function to emit events safely
            const emitEvent = (event, data) => {
                if (this.safeEmit) {
                    this.safeEmit(event, data)
                } else if (this._$emit) {
                    this._$emit(event, data)
                } else {
                    this.$emit(event, data)
                }
            }
            
            emitEvent('new-grid-layer', {
                name: this.$options.name,
                id: this.$props.id,
                renderer: this,
                display: 'display' in this.$props.settings ?
                   this.$props.settings['display'] : true,
                z: this.$props.settings['z-index'] ||
                   this.$props.settings['zIndex'] || (main ? 0 : -1),
            })
    
            // Overlay meta-props (adjusting behaviour)
            emitEvent('layer-meta-props', {
                grid_id: this.$props.grid_id,
                layer_id: this.$props.id,
                legend: this.legend,
                data_colors: this.data_colors,
                y_range: this.y_range
            })
        } catch (e) {
            console.error("Error in overlay setup:", e)
        }
        this.exec_script()
        this.mouse = new Mouse(this)
        if (this.init_tool) this.init_tool()
        if (this.init) this.init()
    },
    beforeUnmount() {
        if (this.destroy) this.destroy()
        // Safe emit with fallback
        try {
            if (this.safeEmit) {
                this.safeEmit('delete-grid-layer', this.$props.id)
            } else if (this._$emit) {
                this._$emit('delete-grid-layer', this.$props.id)
            } else {
                this.$emit('delete-grid-layer', this.$props.id)
            }
        } catch (e) {
            console.error("Error in overlay beforeUnmount:", e)
        }
    },
    methods: {
        // Setup emission pattern based on Vue version
        setupEmit() {
            // Try to determine Vue version and set up appropriate emit method
            try {
                new Function('return ' + this.$emit)()
                this._$emit = this.$emit
                this.$emit = this.custom_event
            } catch(e) {
                // In Vue 3, we can't override $emit directly
                // We'll use our safeEmit method instead
            }
        },
        
        // Safely emit events in both Vue 2 and Vue 3
        safeEmit(event, ...args) {
            console.log(`[overlay] safeEmit: ${event}`, args);
            try {
                if (this._$emit) {
                    // Vue 2 pattern
                    this._$emit(event, ...args);
                } else {
                    // Vue 3 pattern
                    this.$emit(event, ...args);
                }
                
                // Additional fallback for custom-event
                if (event !== 'custom-event' && this.$parent && event !== 'layer-meta-props') {
                    this.$emit('custom-event', {
                        event: event,
                        args: args
                    });
                }
            } catch (e) {
                console.error(`Error in safeEmit (${event}):`, e);
            }
        },
        
        use_for() {
            /* override it (mandatory) */
            console.warn('use_for() should be implemented')
            console.warn(
            `Format: use_for() {
                  return ['type1', 'type2', ...]
            }`)
        },
        meta_info() {
            /* override it (optional) */
            let id = this.$props.id
            console.warn(
                `${id} meta_info() is req. for publishing`)
            console.warn(
            `Format: meta_info() {
                author: 'Satoshi Smith',
                version: '1.0.0',
                contact (opt) '<email>'
                github: (opt) '<GitHub Page>',
            }`)
        },
        custom_event(event, ...args) {
            if (event.split(':')[0] === 'hook') return
            if (event === 'change-settings' ||
                event === 'object-selected' ||
                event === 'new-shader' ||
                event === 'new-interface' ||
                event === 'remove-tool') {
                args.push(this.grid_id, this.id)
                if (this.$props.settings.$uuid) {
                    args.push(this.$props.settings.$uuid)
                }
            }
            if (event === 'new-interface') {
                args[0].overlay = this
                args[0].uuid = this.last_ux_id =
                    `${this.grid_id}-${this.id}-${this.uxs_count++}`
            }
            // TODO: add a namespace to the event name
            // TODO(2): this prevents call overflow, but
            // the root of evil is in (1)
            if (event === 'custom-event') return
            try {
                if (this.safeEmit) {
                    this.safeEmit('custom-event', {event, args})
                } else if (this._$emit) {
                    this._$emit('custom-event', {event, args})
                } else {
                    this.$emit('custom-event', {event, args})
                }
            } catch (e) {
                console.error("Error in custom_event:", e)
            }
        },
        // TODO: the event is not firing when the same
        // overlay type is added to the offchart[]
        exec_script() {
            if (this.calc) this.$emit('exec-script', {
                grid_id: this.$props.grid_id,
                layer_id: this.$props.id,
                src: this.calc(),
                use_for: this.use_for()
            })
        }
    },
    watch: {
        settings: {
            handler: function(n, p) {
                if (this.watch_uuid) this.watch_uuid(n, p)
                try {
                    if (this.safeEmit) {
                        this.safeEmit('show-grid-layer', {
                            id: this.$props.id,
                            display: 'display' in this.$props.settings ?
                                this.$props.settings['display'] : true,
                        })
                    } else if (this._$emit) {
                        this._$emit('show-grid-layer', {
                            id: this.$props.id,
                            display: 'display' in this.$props.settings ?
                                this.$props.settings['display'] : true,
                        })
                    } else {
                        this.$emit('show-grid-layer', {
                            id: this.$props.id,
                            display: 'display' in this.$props.settings ?
                                this.$props.settings['display'] : true,
                        })
                    }
                } catch (e) {
                    console.error("Error in settings watcher:", e)
                }
            },
            deep: true
        }
    },
    data() { return { uxs_count: 0, last_ux_id: null } },
    render() { 
        // Return an empty div as overlays don't need to render HTML elements
        return h('div', { style: { display: 'none' } }) 
    }
}
