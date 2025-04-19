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
            console.log('LineTool mounted, waiting for cursor data');
            // We need to ensure the component is fully mounted
            // before initializing the pins
            this.$nextTick(() => {
                // After mounting, wait a bit more to ensure all other components
                // (particularly Grid.vue) have completed their initialization
                setTimeout(() => {
                    this.init_tool(); // Init the base tool functionality first
                    this.init(); // Then init the pins
                }, 100);
            });
        },
        // Called after overlay mounted
        init() {
            console.log('LineTool init called with settings:', this.$props.settings, 'cursor:', this.$props.cursor);
            
            // Set up core variables
            this.pins = [];
            this.collisions = [];
            this.show_pins = false;
            this.drag = null;
            
            // Get current cursor position or use defaults
            const cursor = this.$props.cursor || {};
            const defaultX = this.$props.layout ? this.$props.layout.width / 2 : 100;
            const defaultY = this.$props.layout ? this.$props.layout.height / 2 : 100;
            
            // Initialize mouse controller with improved tracking
            this.mouse = {
                x: cursor.x || defaultX,
                y: cursor.y || defaultY,
                listeners: {},
                on: (event, handler) => {
                    if (!this.mouse.listeners[event]) {
                        this.mouse.listeners[event] = [];
                    }
                    this.mouse.listeners[event].push(handler);
                },
                emit: (event, data) => {
                    console.log(`Mouse event emitted: ${event}`, data);
                    if (this.mouse.listeners[event]) {
                        this.mouse.listeners[event].forEach(h => h(data));
                    }
                }
            };
            
            // Add direct event listener to the main canvas element
            this.setupCanvasEventListeners();
            
            // Make sure tool is initialized
            try {
                // Initialize settings for pins if they don't exist
                if (!this.$props.settings.p1) {
                    // Create default positions for pins
                    const midX = this.$props.layout ? this.$props.layout.width / 2 : 100;
                    const midY = this.$props.layout ? this.$props.layout.height / 2 : 100;
                    
                    // Set initial positions via settings to ensure reactivity
                    this.$emit('change-settings', {
                        p1: [
                            this.$props.layout ? this.layout.screen2t(midX - 50) : Date.now() - 3600000,
                            this.$props.layout ? this.layout.screen2$(midY - 20) : 0
                        ],
                        p2: [
                            this.$props.layout ? this.layout.screen2t(midX + 50) : Date.now(),
                            this.$props.layout ? this.layout.screen2$(midY + 20) : 0
                        ]
                    });
                    
                    console.log('Created default pin positions');
                }
                
                // First pin is settled at the first position
                this.pins.push(new Pin(this, 'p1'));
                
                // Second one follows mouse until clicked
                this.pins.push(new Pin(this, 'p2', {
                    state: 'tracking'
                }));
                
                console.log('LineTool pins created:', this.pins);
                
                this.pins[1].on('settled', () => {
                    // Call when current tool drawing is finished
                    console.log('Pin settled, finishing drawing');
                    this.set_state('finished');
                    this.$emit('drawing-mode-off');
                    
                    // Force a redraw
                    this.$emit('redraw-grid');
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
        
        // Add direct event listeners to the canvas
        setupCanvasEventListeners() {
            try {
                // Find the grid canvas element
                const gridId = this.$props.grid_id || 0;
                const canvasSelector = `#trading-vue-js-grid-${gridId}-canvas`;
                
                this.$nextTick(() => {
                    const canvas = document.querySelector(canvasSelector);
                    if (canvas) {
                        console.log('Found canvas element, attaching direct event listeners');
                        
                        canvas.addEventListener('mousemove', (e) => {
                            // Update our internal mouse tracker
                            this.mouse.x = e.offsetX;
                            this.mouse.y = e.offsetY;
                            
                            // Manually emit to our mouse handlers
                            this.mouse.emit('mousemove', {
                                layerX: e.offsetX,
                                layerY: e.offsetY,
                                preventDefault: () => e.preventDefault()
                            });
                        });
                        
                        canvas.addEventListener('mousedown', (e) => {
                            // Manually emit to our mouse handlers
                            this.mouse.emit('mousedown', {
                                layerX: e.offsetX,
                                layerY: e.offsetY,
                                preventDefault: () => e.preventDefault()
                            });
                        });
                        
                        canvas.addEventListener('mouseup', (e) => {
                            // Manually emit to our mouse handlers
                            this.mouse.emit('mouseup', {
                                layerX: e.offsetX,
                                layerY: e.offsetY,
                                preventDefault: () => e.preventDefault()
                            });
                        });
                        
                        console.log('Canvas event listeners attached');
                    } else {
                        console.error(`Canvas element not found: ${canvasSelector}`);
                    }
                });
            } catch (e) {
                console.error('Error setting up canvas event listeners:', e);
            }
        },
        draw(ctx) {
            try {
                // Make sure we have valid pin data before drawing
                if (!this.p1 || !this.p2) {
                    console.debug('LineTool draw: missing pin data, p1:', this.p1, 'p2:', this.p2);
                    if (this.$props.settings && this.$props.settings.p1 && this.$props.settings.p2) {
                        console.debug('Using settings data for pins');
                    } else {
                        return; // Can't draw without valid pin data
                    }
                }
                
                // Apply drawing styles
                ctx.lineWidth = this.line_width;
                ctx.strokeStyle = this.color;
                ctx.beginPath();
                
                // Determine which type of line to draw based on settings
                try {
                    if (this.sett.ray) {
                        new Ray(this, ctx).draw(this.p1, this.p2);
                    } else if (this.sett.extended) {
                        new Line(this, ctx).draw(this.p1, this.p2);
                    } else {
                        new Seg(this, ctx).draw(this.p1, this.p2);
                    }
                    
                    ctx.stroke();
                } catch (e) {
                    console.error('Error drawing line segment:', e);
                }
                
                // Draw the pin handles
                this.render_pins(ctx);
                
            } catch (e) {
                console.error('Error in LineTool.draw:', e);
            }
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
