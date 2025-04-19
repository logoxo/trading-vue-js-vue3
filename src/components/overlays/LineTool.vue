<script>
// Line drawing tool
// TODO: make an angle-snap when "Shift" is pressed

import Overlay from '../../mixins/overlay.js'
import { h, defineComponent } from 'vue'
import Tool from '../../mixins/tool.js'
import Icons from '../../stuff/icons.json'
import Pin from '../primitives/pin.js'
import Seg from '../primitives/seg.js'
import Line from '../primitives/line.js'
import Ray from '../primitives/ray.js'

export default defineComponent({
    name: 'LineTool',
    mixins: [Overlay, Tool],
    methods: {
        meta_info() {
            return { author: 'C451', version: '1.1.0' }
        },
        tool() {
            return {
                // Descriptor for the tool
                group: 'Lines', icon: Icons['segment.png'],
                type: 'Segment',
                hint: 'This hint will be shown on hover',
                data: [],     // Default data
                settings: {}, // Default settings
                // Modifications
                mods: {
                    'Extended': {
                        // Rewrites the default setting fields
                        settings: { extended: true },
                        icon: Icons['extended.png']
                    },
                    'Ray': {
                        // Rewrites the default setting fields
                        settings: { ray: true },
                        icon: Icons['ray.png']
                    }
                }
            }
        },
        // Called when component is mounted
        mounted() {
            console.log('LineTool mounted');
            this.$nextTick(() => {
                this.init();
            });
        },
        // Called after overlay mounted
        init() {
            console.log('LineTool init called with settings:', this.$props.settings);
            
            // Set up core variables
            this.pins = [];
            this.collisions = [];
            this.show_pins = false;
            this.drag = null;
            
            // Initialize mouse controller if needed
            if (!this.mouse) {
                console.log('Creating mouse handlers using cursor prop');
                this.mouse = {
                    x: this.$props.cursor ? this.$props.cursor.x : 0,
                    y: this.$props.cursor ? this.$props.cursor.y : 0,
                    listeners: {},
                    on: (event, handler) => {
                        if (!this.mouse.listeners[event]) {
                            this.mouse.listeners[event] = [];
                        }
                        this.mouse.listeners[event].push(handler);
                    },
                    emit: (event, data) => {
                        if (this.mouse.listeners[event]) {
                            this.mouse.listeners[event].forEach(h => h(data));
                        }
                    }
                };
            }
            
            // Make sure tool is initialized
            try {
                // First pin is settled at the mouse position
                this.pins.push(new Pin(this, 'p1'));
                
                // Second one is following mouse until it clicks
                this.pins.push(new Pin(this, 'p2', {
                    state: 'tracking'
                }));
                
                console.log('LineTool pins created:', this.pins);
                
                this.pins[1].on('settled', () => {
                    // Call when current tool drawing is finished
                    // (Optionally) reset the mode back to 'Cursor'
                    console.log('Pin settled, finishing drawing');
                    this.set_state('finished');
                    this.$emit('drawing-mode-off');
                });
                
                // Emit event to notify that tool is ready
                this.$emit('custom-event', {
                    event: 'tool-initialized',
                    args: [this.$options.name]
                });
                
                console.log('LineTool initialization complete');
            } catch (e) {
                console.error('Error initializing LineTool:', e);
            }
        },
        draw(ctx) {
            if (!this.p1 || !this.p2) return

            ctx.lineWidth = this.line_width
            ctx.strokeStyle = this.color
            ctx.beginPath()

            if (this.sett.ray) {
                new Ray(this, ctx).draw(this.p1, this.p2)
            } else if (this.sett.extended) {
                new Line(this, ctx).draw(this.p1, this.p2)
            } else {
                new Seg(this, ctx).draw(this.p1, this.p2)
            }

            ctx.stroke()
            this.render_pins(ctx)

        },
        use_for() { return ['LineTool'] },
        data_colors() { return [this.color] }
    },
    // Define internal setting & constants here
    computed: {
        sett() {
            return this.$props.settings
        },
        p1() {
            return this.$props.settings.p1
        },
        p2() {
            return this.$props.settings.p2
        },
        line_width() {
            return this.sett.lineWidth || 0.9
        },
        color() {
            return this.sett.color || '#42b28a'
        }
    },
    data() {
        return {}
    },
    render() { 
        // Custom empty render function that returns actual element
        return h('div', { style: { display: 'none' } })
    }
})
</script>
