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
                // SUPER DEBUG MODE: Draw simple red line regardless of settings
                console.log('SUPER DEBUG: Drawing test red line');
                
                // Test if ctx is valid
                if (!ctx) {
                    console.error('SUPER DEBUG: ctx is null!');
                    return;
                }
                
                // Debug info about the context
                console.log('SUPER DEBUG: ctx type =', typeof ctx);
                console.log('SUPER DEBUG: ctx methods =', Object.keys(ctx).filter(k => typeof ctx[k] === 'function'));
                console.log('SUPER DEBUG: ctx properties =', Object.keys(ctx).filter(k => typeof ctx[k] !== 'function'));
                
                // CRITICAL: Reset transformations
                try {
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                } catch (e) {
                    console.error('SUPER DEBUG: setTransform error', e);
                }
                
                // Get any information about the canvas size
                const layout = this.$props.layout || {};
                const width = layout.width || 800;
                const height = layout.height || 400;
                
                console.log('SUPER DEBUG: Canvas size', width, height);
                
                // Hard-coded test drawing across the entire canvas
                try {
                    // Set strong visible style
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#FF0000';
                    ctx.fillStyle = '#FF0000';
                    
                    // START NEW PATH
                    ctx.beginPath();
                    
                    // Draw diagonal line across the canvas
                    ctx.moveTo(0, 0);
                    ctx.lineTo(width, height);
                    
                    // Draw a simple square in the middle
                    const midX = width / 2;
                    const midY = height / 2;
                    ctx.rect(midX - 25, midY - 25, 50, 50);
                    
                    // Actually apply the stroke
                    ctx.stroke();
                    
                    // Draw filled circle at each corner for visibility
                    ctx.beginPath();
                    ctx.arc(0, 0, 5, 0, Math.PI * 2);
                    ctx.arc(width, height, 5, 0, Math.PI * 2);
                    ctx.fill();
                    
                    console.log('SUPER DEBUG: Test drawing completed');
                } catch (e) {
                    console.error('SUPER DEBUG: Error during test drawing', e);
                }
                
                // Attempt to draw based on settings if available
                try {
                    const settings = this.$props.settings || {};
                    let p1 = this.p1 || settings.p1;
                    let p2 = this.p2 || settings.p2;
                    
                    console.log('SUPER DEBUG: Settings pins', { p1, p2, settings });
                    
                    // Only try to draw if we have valid points
                    if (p1 && p2 && Array.isArray(p1) && Array.isArray(p2) && 
                        layout && typeof layout.t2screen === 'function' && typeof layout.$2screen === 'function') {
                        
                        // Convert coordinates
                        const x1 = layout.t2screen(p1[0]);
                        const y1 = layout.$2screen(p1[1]);
                        const x2 = layout.t2screen(p2[0]);
                        const y2 = layout.$2screen(p2[1]);
                        
                        console.log('SUPER DEBUG: Converted coords', { x1, y1, x2, y2 });
                        
                        // Draw green line between actual points
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = '#00FF00';
                        ctx.fillStyle = '#00FF00';
                        
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                        
                        // Draw circles at points
                        ctx.beginPath();
                        ctx.arc(x1, y1, 6, 0, Math.PI * 2);
                        ctx.arc(x2, y2, 6, 0, Math.PI * 2);
                        ctx.fill();
                        
                        console.log('SUPER DEBUG: Drew actual line');
                    }
                } catch (e) {
                    console.error('SUPER DEBUG: Error drawing actual line', e);
                }
                
                // Try to access and use the parent canvas directly as last resort
                try {
                    if (this.$parent && this.$parent.$refs && this.$parent.$refs.canvas) {
                        const parentCanvas = this.$parent.$refs.canvas;
                        const parentCtx = parentCanvas.getContext('2d');
                        
                        if (parentCtx) {
                            console.log('SUPER DEBUG: Accessed parent canvas directly!');
                            
                            // Draw blue X across the canvas
                            parentCtx.lineWidth = 4;
                            parentCtx.strokeStyle = '#0000FF';
                            
                            parentCtx.beginPath();
                            parentCtx.moveTo(0, 0);
                            parentCtx.lineTo(parentCanvas.width, parentCanvas.height);
                            parentCtx.moveTo(parentCanvas.width, 0);
                            parentCtx.lineTo(0, parentCanvas.height);
                            parentCtx.stroke();
                            
                            console.log('SUPER DEBUG: Drew blue X on parent canvas');
                        }
                    }
                } catch (e) {
                    console.error('SUPER DEBUG: Error accessing parent canvas', e);
                }
                
                console.log('SUPER DEBUG: draw method finished');
            } catch (e) {
                console.error('SUPER DEBUG: Fatal error in draw', e);
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
        return h('div', {
            class: 'line-tool-wrapper',
            style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1000
            },
            onMounted: () => {
                console.log('Line tool wrapper mounted');
                this.$nextTick(() => {
                    // After mounted, try to find canvas and draw directly
                    this.findCanvasAndDraw();
                });
            }
        });
    },
    
    beforeUnmount() {
        // Clean up our direct drawing if needed
        this.cleanupDirectDrawing();
    },
    
    // New methods for direct canvas access
    methods: {
        findCanvasAndDraw() {
            try {
                console.log('Attempting to find canvas for direct drawing');
                
                // First try to find by grid id
                const gridId = this.$props.grid_id || 0;
                let canvas = document.querySelector(`#trading-vue-js-grid-${gridId}-canvas`);
                
                if (!canvas) {
                    // Try more general selectors
                    canvas = document.querySelector('.trading-vue-chart canvas');
                }
                
                if (!canvas) {
                    // Try any canvas on the page
                    canvas = document.querySelector('canvas');
                }
                
                if (canvas) {
                    console.log('Found canvas for direct drawing!', canvas);
                    this.directCanvas = canvas;
                    this.directCtx = canvas.getContext('2d');
                    
                    // Set up a MutationObserver to watch for chart updates
                    this.setupMutationObserver(canvas);
                    
                    // Draw immediately
                    this.drawDirectly();
                    
                    // Also set up interval for periodic redraw
                    this.directDrawInterval = setInterval(() => {
                        this.drawDirectly();
                    }, 1000); // Redraw every second
                } else {
                    console.error('Could not find any canvas for direct drawing');
                }
            } catch (e) {
                console.error('Error in findCanvasAndDraw:', e);
            }
        },
        
        setupMutationObserver(canvas) {
            try {
                // Watch for any changes to the chart that might require redrawing
                this.observer = new MutationObserver((mutations) => {
                    // When any changes occur, redraw
                    this.drawDirectly();
                });
                
                // Watch the parent element for any changes
                if (canvas.parentElement) {
                    this.observer.observe(canvas.parentElement, {
                        childList: true,
                        attributes: true,
                        subtree: true
                    });
                    console.log('MutationObserver set up on canvas parent');
                }
            } catch (e) {
                console.error('Error setting up MutationObserver:', e);
            }
        },
        
        drawDirectly() {
            try {
                if (!this.directCtx || !this.directCanvas) {
                    console.error('No direct canvas context available');
                    return;
                }
                
                const settings = this.$props.settings || {};
                const layout = this.$props.layout;
                
                if (!layout) {
                    console.error('No layout available for coordinate conversion');
                    return;
                }
                
                // Draw directly on the canvas
                const ctx = this.directCtx;
                const width = this.directCanvas.width;
                const height = this.directCanvas.height;
                
                // Save current state
                ctx.save();
                
                // Draw red diagonal line for visibility test
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#FF0000';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(width, height);
                ctx.stroke();
                
                // Try to draw actual line if we have pin positions
                let p1 = this.p1 || settings.p1;
                let p2 = this.p2 || settings.p2;
                
                if (p1 && p2 && Array.isArray(p1) && Array.isArray(p2) && 
                    typeof layout.t2screen === 'function' && typeof layout.$2screen === 'function') {
                    
                    // Convert coordinates
                    const x1 = layout.t2screen(p1[0]);
                    const y1 = layout.$2screen(p1[1]);
                    const x2 = layout.t2screen(p2[0]);
                    const y2 = layout.$2screen(p2[1]);
                    
                    // Draw actual line in green
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#00FF00';
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    
                    // Draw pin handles
                    ctx.fillStyle = '#0088FF';
                    ctx.beginPath();
                    ctx.arc(x1, y1, 5, 0, Math.PI * 2);
                    ctx.arc(x2, y2, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Restore state
                ctx.restore();
                
                console.log('Direct drawing completed');
            } catch (e) {
                console.error('Error in direct drawing:', e);
            }
        },
        
        cleanupDirectDrawing() {
            console.log('Cleaning up direct drawing resources');
            
            // Clear the redraw interval
            if (this.directDrawInterval) {
                clearInterval(this.directDrawInterval);
                this.directDrawInterval = null;
            }
            
            // Disconnect the observer
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            
            // Clean up references
            this.directCanvas = null;
            this.directCtx = null;
        }
    }
})
</script>
