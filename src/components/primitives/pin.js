// Semi-automatic pin object. For stretching things.

import Utils from '../../stuff/utils.js'

export default class Pin {

    // (Comp reference, a name in overlay settings,
    // pin parameters)
    constructor(comp, name, params = {}) {

        this.RADIUS = (comp.$props.config && comp.$props.config.PIN_RADIUS) || 5.5
        this.RADIUS_SQ = Math.pow(this.RADIUS + 7, 2)

        if (Utils.is_mobile) {
            this.RADIUS += 2
            this.RADIUS_SQ *= 2.5
        }

        this.COLOR_BACK = comp.$props.colors ? comp.$props.colors.back : '#fff'
        this.COLOR_BR = comp.$props.colors ? comp.$props.colors.text : '#000'

        this.comp = comp
        this.layout = comp.layout || {}
        this.name = name
        this.state = params.state || 'settled'
        this.hidden = params.hidden || false
        
        // Create mouse handlers if they don't exist
        this.setup_mouse(comp)
        
        this.mouse.on('mousemove', e => this.mousemove(e))
        this.mouse.on('mousedown', e => this.mousedown(e))
        this.mouse.on('mouseup', e => this.mouseup(e))
        
        console.log(`Pin ${name} created with state: ${this.state}`);

        // Initialize with settings or cursor
        if (comp.state === 'finished' && comp.$props.settings && comp.$props.settings[name]) {
            this.state = 'settled'
            this.update_from(comp.$props.settings[name])
        } else {
            this.update()
        }

        if (this.state !== 'settled') {
            this.comp.$emit('scroll-lock', true)
        }
        
        console.log(`Pin ${name} initialized`);
    }
    
    // Ensure mouse controller is set up
    setup_mouse(comp) {
        // If mouse already exists
        if (comp.mouse && typeof comp.mouse.on === 'function') {
            this.mouse = comp.mouse;
            return;
        }
        
        console.log('Creating new mouse controller for pin');
        
        // Create a mouse object 
        this.mouse = {
            x: comp.$props.cursor ? comp.$props.cursor.x : 0,
            y: comp.$props.cursor ? comp.$props.cursor.y : 0,
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
        
        // Add mouse object to comp if it doesn't exist
        if (!comp.mouse) {
            comp.mouse = this.mouse;
        }
    }

    re_init() {
        this.update_from(
            this.comp.$props.settings[this.name]
        )
    }

    draw(ctx) {
        if (this.hidden) return
        switch (this.state) {
            case 'tracking':
                break
            case 'dragging':
                if (!this.moved) this.draw_circle(ctx)
                break
            case 'settled':
                this.draw_circle(ctx)
                break
        }
    }

    draw_circle(ctx) {

        this.layout = this.comp.layout
        if (this.comp.selected) {
            var r = this.RADIUS, lw = 1.5
        } else {
            var r = this.RADIUS * 0.95, lw = 1
        }

        ctx.lineWidth = lw
        ctx.strokeStyle = this.COLOR_BR
        ctx.fillStyle = this.COLOR_BACK
        ctx.beginPath()
        ctx.arc(
            this.x = this.layout.t2screen(this.t),
            this.y = this.layout.$2screen(this.y$),
            r + 0.5, 0, Math.PI * 2, true)
        ctx.fill()
        ctx.stroke()
    }

    update() {
        try {
            const cursor = this.comp.$props.cursor || {};
            
            // For Vue 3 compatibility, ensure cursor properties exist
            if (!cursor) {
                console.warn('Pin update called with no cursor data, using mouse coordinates');
                
                // Fall back to the mouse object if available
                if (this.mouse) {
                    const layout = this.comp.layout || {};
                    
                    // Convert screen coordinates to chart coordinates
                    if (layout.t2screen && layout.$2screen && 
                        typeof layout.screen2t === 'function' && 
                        typeof layout.screen2$ === 'function') {
                        
                        this.t = layout.screen2t(this.mouse.x);
                        this.y$ = layout.screen2$(this.mouse.y);
                        this.x = this.mouse.x;
                        this.y = this.mouse.y;
                        
                    } else {
                        // Fallback to mouse coordinates directly
                        this.x = this.mouse.x;
                        this.y = this.mouse.y;
                        this.t = Date.now(); // Use current timestamp
                        this.y$ = 0; // Default value
                    }
                } else {
                    return; // Can't update without cursor or mouse
                }
            } else {
                // Normal case - use cursor data
                this.y$ = cursor.y$ !== undefined ? cursor.y$ : 0;
                this.y = cursor.y !== undefined ? cursor.y : 0;
                this.t = cursor.t !== undefined ? cursor.t : Date.now();
                this.x = cursor.x !== undefined ? cursor.x : 0;
            }
            
            console.log(`Pin ${this.name} updated to position:`, { x: this.x, y: this.y, t: this.t, y$: this.y$ });
    
            // Update the settings to reflect the new position
            if (this.comp && typeof this.comp.$emit === 'function') {
                this.comp.$emit('change-settings', {
                    [this.name]: [this.t, this.y$]
                });
            } else {
                console.warn(`Cannot emit change-settings for pin ${this.name}, comp.$emit is not a function`);
            }
        } catch (e) {
            console.error(`Error updating pin ${this.name}:`, e);
        }
    }

    update_from(data, emit = false) {

        if (!data) return
        this.layout = this.comp.layout

        this.y$ = data[1]
        this.y = this.layout.$2screen(this.y$)
        this.t = data[0]
        this.x = this.layout.t2screen(this.t)

        // TODO: Save pin as time in IB mode
        //if (this.layout.ti_map.ib) {
        //    this.t = this.layout.ti_map.i2t(this.t )
        //}

        if (emit) this.comp.$emit('change-settings', {
             [this.name]: [this.t, this.y$]
        })

    }

    rec_position() {
        this.t1 = this.t
        this.y$1 = this.y$
    }

    mousemove(event) {

        switch(this.state) {
            case 'tracking':
            case 'dragging':
                this.moved = true
                this.update()
                break
        }


    }

    mousedown(event, force = false) {
        try {
            console.log(`Pin ${this.name} mousedown, state: ${this.state}, forced: ${force}`);
            
            // Skip if event is already handled (unless forced)
            if (!force && event && Utils.default_prevented(event)) {
                console.log(`Pin ${this.name} mousedown: event already handled`);
                return;
            }
            
            // Handle different pin states
            switch (this.state) {
                case 'tracking':
                    // When in tracking state, mousedown settles the pin
                    console.log(`Pin ${this.name} tracking -> settled`);
                    this.state = 'settled';
                    
                    // Get current position from the cursor if available
                    if (this.comp.$props.cursor) {
                        this.update();
                    }
                    
                    // Call the settled callback if it exists
                    if (this.on_settled) {
                        console.log(`Pin ${this.name} calling on_settled`);
                        this.on_settled();
                    }
                    
                    // Release scroll lock
                    if (this.comp && typeof this.comp.$emit === 'function') {
                        this.comp.$emit('scroll-lock', false);
                    }
                    break;
                    
                case 'settled':
                    // When settled, mousedown only works if it's on the pin
                    if (this.hidden) {
                        console.log(`Pin ${this.name} is hidden, ignoring mousedown`);
                        return;
                    }
                    
                    // Check if the mouse is over this pin
                    const isHovered = this.hover();
                    console.log(`Pin ${this.name} hover check: ${isHovered}`);
                    
                    if (isHovered) {
                        console.log(`Pin ${this.name} settled -> dragging`);
                        this.state = 'dragging';
                        this.moved = false;
                        
                        // Lock scrolling and notify that an object is selected
                        if (this.comp && typeof this.comp.$emit === 'function') {
                            this.comp.$emit('scroll-lock', true);
                            this.comp.$emit('object-selected');
                        }
                    }
                    break;
            }
            
            // Prevent default if mouse is over pin
            if (event && this.hover()) {
                event.preventDefault();
                console.log(`Pin ${this.name} prevented default on mousedown`);
            }
        } catch (e) {
            console.error(`Error in Pin ${this.name} mousedown:`, e);
        }
    }

    mouseup(event) {
        try {
            console.log(`Pin ${this.name} mouseup, state: ${this.state}`);
            
            switch (this.state) {
                case 'dragging':
                    console.log(`Pin ${this.name} dragging -> settled`);
                    this.state = 'settled';
                    
                    // Call the settled callback if it exists
                    if (this.on_settled) {
                        console.log(`Pin ${this.name} calling on_settled`);
                        this.on_settled();
                    }
                    
                    // Release scroll lock
                    if (this.comp && typeof this.comp.$emit === 'function') {
                        this.comp.$emit('scroll-lock', false);
                    }
                    
                    // Force a redraw to update the pin's appearance
                    if (this.comp && typeof this.comp.$emit === 'function') {
                        this.comp.$emit('redraw-grid');
                    }
                    break;
            }
        } catch (e) {
            console.error(`Error in Pin ${this.name} mouseup:`, e);
        }
    }

    on(name, handler) {
        switch (name) {
            case 'settled':
                this.on_settled = handler
                break
        }
    }

    hover() {
        let x = this.x
        let y = this.y
        return (
            (x - this.mouse.x) * (x - this.mouse.x) +
            (y - this.mouse.y) * (y - this.mouse.y)
        ) < this.RADIUS_SQ
    }

}
