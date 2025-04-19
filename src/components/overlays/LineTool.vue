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
            
            // In Vue 3, we need to make sure the component is fully mounted
            this.$nextTick(() => {
                console.log('LineTool in $nextTick, initializing...');
                
                try {
                    // First initialize the base tool functionality
                    if (typeof this.init_tool === 'function') {
                        this.init_tool();
                    } else {
                        console.warn('init_tool is not a function, might be a mixin issue');
                    }
                    
                    // After a slight delay to ensure other components are ready
                    setTimeout(() => {
                        // Initialize the pins and drawing functionality
                        this.init();
                        
                        // After init, force a redraw to make sure everything is visible
                        setTimeout(() => {
                            this.$emit('redraw-grid');
                        }, 200);
                    }, 100);
                } catch (e) {
                    console.error('Error during LineTool mounting:', e);
                }
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
                // Find the grid canvas element - in Vue 3 refs approach is preferred
                // but we'll use querySelector as a fallback
                const gridId = this.$props.grid_id || 0;
                
                // Try multiple selectors to find the canvas reliably
                const possibleSelectors = [
                    `#trading-vue-js-grid-${gridId}-canvas`,
                    `#grid-${gridId}-canvas`,
                    `.trading-vue-chart canvas`
                ];
                
                // Wait for DOM to be ready and try to find canvas
                setTimeout(() => {
                    let canvas = null;
                    
                    // Try each selector
                    for (const selector of possibleSelectors) {
                        canvas = document.querySelector(selector);
                        if (canvas) {
                            console.log(`Found canvas element with selector: ${selector}`);
                            break;
                        }
                    }
                    
                    if (canvas) {
                        console.log('Attaching direct event listeners to canvas');
                        
                        // Store handlers so we can remove them later if needed
                        this._eventHandlers = {
                            mousemove: (e) => {
                                // Update our internal mouse tracker
                                this.mouse.x = e.offsetX;
                                this.mouse.y = e.offsetY;
                                
                                // Manually emit to our mouse handlers
                                this.mouse.emit('mousemove', {
                                    layerX: e.offsetX,
                                    layerY: e.offsetY,
                                    preventDefault: () => e.preventDefault()
                                });
                            },
                            mousedown: (e) => {
                                console.log('Canvas mousedown event', e.offsetX, e.offsetY);
                                // Update position first
                                this.mouse.x = e.offsetX;
                                this.mouse.y = e.offsetY;
                                
                                // Manually emit to our mouse handlers
                                this.mouse.emit('mousedown', {
                                    layerX: e.offsetX,
                                    layerY: e.offsetY,
                                    preventDefault: () => e.preventDefault()
                                });
                            },
                            mouseup: (e) => {
                                // Update position first
                                this.mouse.x = e.offsetX;
                                this.mouse.y = e.offsetY;
                                
                                // Manually emit to our mouse handlers
                                this.mouse.emit('mouseup', {
                                    layerX: e.offsetX,
                                    layerY: e.offsetY,
                                    preventDefault: () => e.preventDefault()
                                });
                            }
                        };
                        
                        // Attach all event listeners
                        canvas.addEventListener('mousemove', this._eventHandlers.mousemove);
                        canvas.addEventListener('mousedown', this._eventHandlers.mousedown);
                        canvas.addEventListener('mouseup', this._eventHandlers.mouseup);
                        
                        console.log('Canvas event listeners successfully attached');
                        
                        // Store reference to canvas
                        this._canvasElement = canvas;
                    } else {
                        console.error(`Canvas element not found with any selector: ${possibleSelectors.join(', ')}`);
                        
                        // Fallback: try to get canvas through refs in the component tree
                        if (this.$parent && this.$parent.$refs && this.$parent.$refs.canvas) {
                            console.log('Found canvas through parent refs');
                            this._canvasElement = this.$parent.$refs.canvas;
                            // Add event listeners as above...
                        }
                    }
                }, 200);
            } catch (e) {
                console.error('Error setting up canvas event listeners:', e);
            }
        },
        
        // Clean up event listeners when component is destroyed
        beforeUnmount() {
            try {
                console.log('LineTool being unmounted, cleaning up event listeners');
                if (this._canvasElement && this._eventHandlers) {
                    // Remove all event listeners
                    this._canvasElement.removeEventListener('mousemove', this._eventHandlers.mousemove);
                    this._canvasElement.removeEventListener('mousedown', this._eventHandlers.mousedown);
                    this._canvasElement.removeEventListener('mouseup', this._eventHandlers.mouseup);
                }
            } catch (e) {
                console.error('Error cleaning up LineTool:', e);
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
