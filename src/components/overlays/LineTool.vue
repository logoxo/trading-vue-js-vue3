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
            console.log('LineTool mounted, initializing with settings:', this.$props.settings);
            
            // In Vue 3, we need a different approach to initialization
            this.$nextTick(() => {
                console.log('LineTool in $nextTick, checking DOM readiness');
                
                try {
                    // Initialize component in phases to ensure proper setup
                    this.initPhase1();
                } catch (e) {
                    console.error('Error during LineTool mounting phase 1:', e);
                }
            });
        },
        
        // Phase 1: Basic initialization and tool setup
        initPhase1() {
            // First, initialize the base tool functionality
            if (typeof this.init_tool === 'function') {
                console.log('Initializing basic tool functionality');
                this.init_tool();
            } else {
                console.warn('init_tool is not a function, might be a mixin issue');
                
                // Fallback initialization for critical properties
                this.collisions = [];
                this.pins = [];
                this.show_pins = false;
                this.drag = null;
            }
            
            // After a slight delay, proceed to phase 2
            setTimeout(() => {
                this.initPhase2();
            }, 50);
        },
        
        // Phase 2: Pin initialization and tool setup
        initPhase2() {
            try {
                console.log('LineTool initialization phase 2');
                
                // Initialize the pins and drawing functionality
                this.init();
                
                // Force a redraw to make sure everything is visible
                this.safeEmit('redraw-grid');
                
                // Also register for direct mouse events if needed
                setTimeout(() => {
                    console.log('Setting up direct canvas bindings');
                    this.setupCanvasEventListeners();
                    
                    // Final redraw after everything is set up
                    setTimeout(() => {
                        this.safeEmit('redraw-grid');
                    }, 100);
                }, 50);
            } catch (e) {
                console.error('Error during LineTool initialization phase 2:', e);
            }
        },
        // Called after overlay mounted
        init() {
            console.log('LineTool init called with settings:', this.$props.settings, 'cursor:', this.$props.cursor);
            
            // Make sure core variables are set up
            if (!Array.isArray(this.pins)) {
                this.pins = [];
            }
            if (!Array.isArray(this.collisions)) {
                this.collisions = [];
            }
            
            // Reset any tracking state
            this.show_pins = false;
            this.drag = null;
            
            // Get current cursor position or use defaults
            const cursor = this.$props.cursor || {};
            const defaultX = this.$props.layout ? this.$props.layout.width / 2 : 100;
            const defaultY = this.$props.layout ? this.$props.layout.height / 2 : 100;
            
            // Initialize or update mouse controller with improved tracking
            if (!this.mouse) {
                this.mouse = {
                    x: cursor.x !== undefined ? cursor.x : defaultX,
                    y: cursor.y !== undefined ? cursor.y : defaultY,
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
            } else {
                // Update existing mouse object coordinates
                this.mouse.x = cursor.x !== undefined ? cursor.x : defaultX;
                this.mouse.y = cursor.y !== undefined ? cursor.y : defaultY;
            }
            
            // Initialize pin positions if needed
            const settings = this.$props.settings || {};
            
            // Only initialize pin positions if they don't exist
            if (!settings.p1 || !settings.p2) {
                try {
                    console.log('Creating pin positions directly');
                    
                    // Get chart layout information
                    const layout = this.$props.layout;
                    
                    // Calculate sensible default positions
                    let defaultPositions;
                    
                    if (layout && layout.width && layout.height) {
                        // Use layout dimensions
                        const midX = layout.width / 2;
                        const midY = layout.height / 2;
                        
                        // Create reasonable default pin positions
                        if (typeof layout.screen2t === 'function' && typeof layout.screen2$ === 'function') {
                            // Convert screen coordinates to time-price coordinates
                            defaultPositions = {
                                p1: [layout.screen2t(midX - 50), layout.screen2$(midY - 20)],
                                p2: [layout.screen2t(midX + 50), layout.screen2$(midY + 20)]
                            };
                        } else {
                            // Fallback to time-based values if conversion isn't available
                            const now = Date.now();
                            const timeRange = 3600000; // 1 hour
                            
                            defaultPositions = {
                                p1: [now - timeRange, 0],
                                p2: [now, 0]
                            };
                        }
                    } else {
                        // No layout information, use time-based defaults
                        const now = Date.now();
                        const timeRange = 3600000; // 1 hour
                        
                        defaultPositions = {
                            p1: [now - timeRange, 0],
                            p2: [now, 0]
                        };
                    }
                    
                    // Update settings with defaults where needed
                    const newSettings = {};
                    
                    if (!settings.p1) {
                        newSettings.p1 = defaultPositions.p1;
                    }
                    
                    if (!settings.p2) {
                        newSettings.p2 = defaultPositions.p2;
                    }
                    
                    // Use safeEmit for more consistent event emission
                    if (Object.keys(newSettings).length > 0) {
                        console.log('Updating pin positions via settings:', newSettings);
                        this.safeEmit('change-settings', newSettings);
                    }
                    
                    // Wait for settings to be updated before creating pins
                    setTimeout(() => {
                        this.createPins();
                    }, 50);
                } catch (e) {
                    console.error('Error setting default pin positions:', e);
                    this.createPins(); // Create pins anyway
                }
            } else {
                // Pin positions already exist in settings, create pins directly
                this.createPins();
            }
        },
        
        // Create pins based on current settings
        createPins() {
            try {
                console.log('Creating pins with settings:', this.$props.settings);
                
                // Clear existing pins
                this.pins = [];
                
                // Create the first pin (start point)
                this.pins.push(new Pin(this, 'p1'));
                
                // Create the second pin (end point)
                // If in drawing mode, make it track the mouse
                const isDrawing = this.$props.settings.$state === 'wip';
                const trackingState = isDrawing ? 'tracking' : 'settled';
                
                this.pins.push(new Pin(this, 'p2', {
                    state: trackingState
                }));
                
                console.log('Pins created:', this.pins.map(p => p.name + ':' + p.state));
                
                // Set up the settled callback for the second pin
                this.pins[1].on('settled', () => {
                    console.log('Pin p2 settled, finishing drawing');
                    this.set_state('finished');
                    this.safeEmit('drawing-mode-off');
                    this.safeEmit('redraw-grid');
                });
                
                // Notify that the tool is initialized and ready
                this.safeEmit('custom-event', {
                    event: 'tool-initialized',
                    args: [this.$options.name]
                });
                
                // Force a redraw to show the tool
                this.safeEmit('redraw-grid');
                
                console.log('LineTool initialization complete');
            } catch (e) {
                console.error('Error creating pins:', e);
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
                console.log('LineTool.draw called', { settings: this.$props.settings });
                
                // CRITICAL: Clear any previous path
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                
                // Ensure collisions array is initialized
                this.collisions = this.collisions || [];
                
                // Get coordinates from either pins or settings
                const settings = this.$props.settings || {};
                let p1 = this.p1 || settings.p1;
                let p2 = this.p2 || settings.p2;
                
                // Debug info
                console.log('Points from settings', { 
                    p1: settings.p1,
                    p2: settings.p2,
                    computedP1: this.p1,
                    computedP2: this.p2
                });
                
                // Validate we have both points
                if (!p1 || !p2 || !Array.isArray(p1) || !Array.isArray(p2)) {
                    console.error('LineTool.draw: Invalid points', { p1, p2 });
                    return;
                }
                
                // Get layout for coordinate conversion
                const layout = this.$props.layout;
                if (!layout) {
                    console.error('LineTool.draw: No layout available');
                    return;
                }
                
                // Check if the necessary conversion functions exist
                if (typeof layout.t2screen !== 'function' || typeof layout.$2screen !== 'function') {
                    console.error('LineTool.draw: Missing conversion functions');
                    return;
                }
                
                // Convert time-price coordinates to screen coordinates
                try {
                    var x1 = layout.t2screen(p1[0]);
                    var y1 = layout.$2screen(p1[1]);
                    var x2 = layout.t2screen(p2[0]);
                    var y2 = layout.$2screen(p2[1]);
                } catch (e) {
                    console.error('Coordinate conversion error:', e);
                    return;
                }
                
                console.log('Drawing line with coords:', {
                    from: { x: x1, y: y1 },
                    to: { x: x2, y: y2 },
                    rawFrom: p1,
                    rawTo: p2
                });
                
                // Set line style
                ctx.lineWidth = this.line_width;
                ctx.strokeStyle = this.color;
                
                // START FRESH PATH
                ctx.beginPath();
                
                // Basic segment drawing with verification
                try {
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    
                    // Debugging: Draw a small circle at each point
                    ctx.fillStyle = 'red';
                    ctx.arc(x1, y1, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(x2, y2, 3, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Go back to line drawing
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                } catch (e) {
                    console.error('Error drawing basic line:', e);
                    return;
                }
                
                // Handle extensions and rays
                try {
                    if (settings.extended || settings.ray) {
                        const w = layout.width;
                        const h = layout.height;
                        
                        // Calculate line slope
                        const dx = x2 - x1;
                        const dy = y2 - y1;
                        const slope = dy / dx;
                        
                        // Direction of the line
                        const s = Math.sign(dx || dy);
                        
                        // Extension length
                        const extX = w * s * 2;
                        let extY = extX * slope;
                        
                        // Handle vertical lines
                        if (!isFinite(extY)) {
                            extY = h * s;
                        }
                        
                        // Draw forward extension
                        ctx.moveTo(x2, y2);
                        ctx.lineTo(x2 + extX, y2 + extY);
                        
                        // Draw backward extension if it's not a ray
                        if (settings.extended && !settings.ray) {
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x1 - extX, y1 - extY);
                        }
                    }
                } catch (e) {
                    console.error('Error drawing extensions:', e);
                }
                
                // ACTUALLY DRAW THE STROKE - separate try/catch
                try {
                    ctx.stroke();
                } catch (e) {
                    console.error('Error during stroke:', e);
                }
                
                // Create collision detection
                try {
                    this.collisions = [];
                    this.collisions.push((x, y) => {
                        const distance = this.pointToLineDistance([x, y], [x1, y1], [x2, y2]);
                        const threshold = 5; // Detection threshold
                        return distance < threshold;
                    });
                } catch (e) {
                    console.error('Error setting up collision detection:', e);
                }
                
                // Draw the pin handles
                try {
                    this.render_pins(ctx);
                } catch (e) {
                    console.error('Error rendering pins:', e);
                }
                
                console.log('LineTool draw completed successfully');
            } catch (e) {
                console.error('Fatal error in LineTool.draw:', e);
            }
        },
        
        // Helper to calculate distance from point to line segment
        pointToLineDistance(point, lineStart, lineEnd) {
            const x = point[0], y = point[1];
            const x1 = lineStart[0], y1 = lineStart[1];
            const x2 = lineEnd[0], y2 = lineEnd[1];
            
            const A = x - x1;
            const B = y - y1;
            const C = x2 - x1;
            const D = y2 - y1;
            
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            
            if (lenSq !== 0) {
                param = dot / lenSq;
            }
            
            let xx, yy;
            
            if (param < 0) {
                xx = x1;
                yy = y1;
            } else if (param > 1) {
                xx = x2;
                yy = y2;
            } else {
                xx = x1 + param * C;
                yy = y1 + param * D;
            }
            
            const dx = x - xx;
            const dy = y - yy;
            
            return Math.sqrt(dx * dx + dy * dy);
        },
        use_for() { return ['LineTool'] },
        data_colors() { return [this.color] }
    },
    // Define internal setting & constants here
    computed: {
        sett() {
            return this.$props.settings || {};
        },
        p1() {
            // Use settings.p1 if available, otherwise return undefined
            if (this.$props.settings && Array.isArray(this.$props.settings.p1)) {
                return this.$props.settings.p1;
            }
            return undefined;
        },
        p2() {
            // Use settings.p2 if available, otherwise return undefined
            if (this.$props.settings && Array.isArray(this.$props.settings.p2)) {
                return this.$props.settings.p2;
            }
            return undefined;
        },
        line_width() {
            // Default line width with fallback
            if (this.sett && this.sett.lineWidth !== undefined) {
                return this.sett.lineWidth;
            }
            return 0.9;
        },
        color() {
            // Default color with fallback
            if (this.sett && this.sett.color) {
                return this.sett.color;
            }
            return '#42b28a';
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
