
// DataCube event handlers

import Utils from '../stuff/utils.js'
import Icons from '../stuff/icons.json'
import WebWork from './script_ww_api.js'
import Dataset from './dataset.js'


export default class DCEvents {

    constructor() {

        this.ww = new WebWork(this)

        // Listen to the web-worker events
        this.ww.onevent = e => {
            for (var ctrl of this.tv.controllers) {
                if (ctrl.ww) ctrl.ww(e.data)
            }
            switch(e.data.type) {
                case 'request-data':
                    // TODO: DataTunnel class for smarter data transfer
                    if (this.ww._data_uploading) break
                    let data = Dataset.make_tx(this, e.data.data)
                    this.send_meta_2_ww()
                    this.ww.just('upload-data', data)
                    this.ww._data_uploading = true
                    break
                case 'overlay-data':
                    this.on_overlay_data(e.data.data)
                    break
                case 'overlay-update':
                    this.on_overlay_update(e.data.data)
                    break
                case 'data-uploaded':
                    this.ww._data_uploading = false
                    break
                case 'engine-state':
                    this.se_state = Object.assign(
                        this.se_state || {}, e.data.data)
                    break
                case 'modify-overlay':
                    this.modify_overlay(e.data.data)
                    break
                case 'script-signal':
                    this.tv.$emit('signal', e.data.data)
                    break
            }
            for (var ctrl of this.tv.controllers) {
                if (ctrl.post_ww) ctrl.post_ww(e.data)
            }
        }
    }

    // Called when overalay/tv emits 'custom-event'
    on_custom_event(event, args) {
        switch(event) {
            case 'register-tools': this.register_tools(args)
                break
            case 'init-toolbar-tools': this.init_toolbar_tools(args)
                break
            case 'exec-script': this.exec_script(args)
                break
            case 'exec-all-scripts': this.exec_all_scripts()
                break
            case 'data-len-changed': this.data_changed(args)
                break
            case 'tool-selected':
                if (!args[0]) break // TODO: Quick fix, investigate
                if (args[0].split(':')[0] === 'System') {
                    this.system_tool(args[0].split(':')[1])
                    break
                }
                this.data.tool = args[0]
                if (args[0] === 'Cursor') {
                    this.drawing_mode_off()
                }
                break
            case 'grid-mousedown': this.grid_mousedown(args)
                break
            case 'drawing-mode-off': this.drawing_mode_off()
                break
            case 'change-settings': this.change_settings(args)
                break
            case 'range-changed': this.scripts_onrange(...args)
                break
            case 'scroll-lock': this.on_scroll_lock(args[0])
                break
            case 'object-selected': this.object_selected(args)
                break
            case 'remove-tool': this.system_tool('Remove')
                break
            case 'before-destroy': this.before_destroy()
                break

        }

    }

    // Triggered when one or multiple settings are changed
    // We select only the changed ones & re-exec them on the
    // web worker
    on_settings(values, prev) {

        if (!this.sett.scripts) return

        let delta = {}
        let changed = false

        for (var i = 0; i < values.length; i++) {
            let n = values[i]
            let arr = prev.filter(x => x.v === n.v)
            if (!arr.length && n.p.settings.$props) {
                let id = n.p.settings.$uuid
                if (Utils.is_scr_props_upd(n, prev) &&
                    Utils.delayed_exec(n.p)) {
                    delta[id] = n.v
                    changed = true
                    n.p.loading = true
                }
            }
        }

        if (changed && Object.keys(delta).length) {
            let tf = this.tv.$refs.chart.interval_ms ||
                     this.data.chart.tf
            let range = this.tv.getRange()
            this.ww.just('update-ov-settings', {
                delta, tf, range
            })
        }

    }

    // When the set of $uuids is changed
    on_ids_changed(values, prev) {

        let rem = prev.filter(
            x => x !== undefined && !values.includes(x))

        if (rem.length) {
            this.ww.just('remove-scripts', rem)
        }
    }

    // Initialize basic toolbar tools when none are available
    init_toolbar_tools(tools) {
        console.log('Initializing toolbar tools', tools);
        
        // Always initialize tools even if some already exist
        // This ensures we have drawing tools available
        if (!this.data.tools) this.data.tools = [];
        
        // Add tools if they don't already exist
        for (const tool of tools || []) {
            if (!this.data.tools.find(t => t.type === tool.type)) {
                this.data.tools.push(tool);
            }
        }
        
        // Make sure we have at least the basic drawing tools
        let hasLineTool = this.data.tools.some(t => 
            t.type === 'Segment' || t.type === 'LineTool:Segment');
            
        // Register line tool manually if it doesn't exist
        if (!hasLineTool) {
            console.log('Manually registering LineTool since it was not found');
            try {
                const Icons = require('../stuff/icons.json');
                
                // Add the segment tool
                if (Icons['segment.png']) {
                    this.data.tools.push({
                        type: 'Segment',
                        icon: Icons['segment.png'],
                        name: 'Line Segment'
                    });
                }
                
                // Add extended line tool
                if (Icons['extended.png']) {
                    this.data.tools.push({
                        type: 'Extended',
                        icon: Icons['extended.png'],
                        name: 'Extended Line',
                        settings: { extended: true }
                    });
                }
                
                // Add ray tool
                if (Icons['ray.png']) {
                    this.data.tools.push({
                        type: 'Ray',
                        icon: Icons['ray.png'],
                        name: 'Ray',
                        settings: { ray: true }
                    });
                }
            } catch (e) {
                console.error('Failed to manually register line tools:', e);
            }
        }
        
        // Make sure default tool is set
        if (!this.data.tool) this.data.tool = 'Cursor';
        
        console.log('Tools after initialization:', this.data.tools.map(t => t.type));
    }
    
    // Combine all tools and their mods
    register_tools(tools) {
        console.log('Registering tools:', tools);
        
        let preset = {}
        for (var tool of this.data.tools || []) {
             preset[tool.type] = tool
             delete tool.type
        }
        
        this.data.tools = []
        let list = [{
            type: 'Cursor', icon: Icons['cursor.png']
        }]
        
        // Manually add line tools to make sure they're available
        // even if the component registration fails
        this.add_basic_drawing_tools(list);
        
        // Process tools received from components
        for (var tool of tools) {
            if (!tool.info) {
                console.error('Tool missing info:', tool);
                continue;
            }
            
            var proto = Object.assign({}, tool.info)
            let type = tool.info.type || 'Default'
            proto.type = `${tool.use_for}:${type}`
            this.merge_presets(proto, preset[tool.use_for])
            this.merge_presets(proto, preset[proto.type])
            delete proto.mods
            
            // Check if this tool already exists in the list
            if (!list.find(t => t.type === proto.type)) {
                list.push(proto)
            }
            
            // Process tool modifications
            if (tool.info.mods) {
                for (var mod in tool.info.mods) {
                    var mp = Object.assign({}, proto)
                    mp = Object.assign(mp, tool.info.mods[mod])
                    mp.type = `${tool.use_for}:${mod}`
                    this.merge_presets(mp, preset[tool.use_for])
                    this.merge_presets(mp, preset[mp.type])
                    
                    // Check if this tool already exists in the list
                    if (!list.find(t => t.type === mp.type)) {
                        list.push(mp)
                    }
                }
            }
        }
        
        this.data.tools = list
        this.data.tool = 'Cursor'
        
        console.log('Registered tools:', this.data.tools.map(t => t.type));
    }
    
    // Add basic drawing tools to ensure they're always available
    add_basic_drawing_tools(list) {
        // Line segment tool
        if (Icons['segment.png'] && !list.find(t => t.type === 'Segment')) {
            list.push({
                type: 'Segment',
                name: 'Line Segment',
                icon: Icons['segment.png'],
                group: 'Lines'
            });
        }
        
        // Extended line tool
        if (Icons['extended.png'] && !list.find(t => t.type === 'Extended')) {
            list.push({
                type: 'Extended',
                name: 'Extended Line',
                icon: Icons['extended.png'],
                group: 'Lines',
                settings: { extended: true }
            });
        }
        
        // Ray tool
        if (Icons['ray.png'] && !list.find(t => t.type === 'Ray')) {
            list.push({
                type: 'Ray',
                name: 'Ray',
                icon: Icons['ray.png'],
                group: 'Lines',
                settings: { ray: true }
            });
        }
    }

    exec_script(args) {
        if (args.length && this.sett.scripts) {
            let obj = this.get_overlay(args[0])
            if (!obj || obj.scripts === false) return
            if (obj.script && obj.script.src) {
                args[0].src = obj.script.src // opt, override the src
            }
            // Parse script props & get the values from the ov
            // TODO: remove unnecessary script initializations
            let s = obj.settings
            let props = args[0].src.props || {}
            if (!s.$uuid) s.$uuid = `${obj.type}-${Utils.uuid2()}`
            args[0].uuid = s.$uuid
            args[0].sett = s
            for (var k in props || {}) {
                let proto = props[k]
                if (s[k] !== undefined) {
                    proto.val = s[k] // use the existing val
                    continue
                }
                if (proto.def === undefined) {
                    // TODO: add support of info / errors to the legend
                    console.error(
                        `Overlay ${obj.id}: script prop '${k}' ` +
                        `doesn't have a default value`)
                    return
                }
                s[k] = proto.val = proto.def // set the default
            }
            // Remove old props (dropped by the current exec)
            if (s.$props) {
                for (var k in s) {
                    if (s.$props.includes(k) && !(k in props)) {
                        delete s[k]
                    }
                }
            }
            s.$props = Object.keys(args[0].src.props || {})
            obj.loading = true
            let tf = this.tv.$refs.chart.interval_ms ||
                     this.data.chart.tf
            let range = this.tv.getRange()
            if (obj.script && obj.script.output != null) {
                args[0].output = obj.script.output
            }
            this.ww.just('exec-script', {
                s: args[0], tf, range
            })
        }
    }

    exec_all_scripts() {
        if (!this.sett.scripts) return
        this.set_loading(true)
        let tf = this.tv.$refs.chart.interval_ms ||
                 this.data.chart.tf
        let range = this.tv.getRange()
        this.ww.just('exec-all-scripts', { tf, range })
    }

    scripts_onrange(r) {
        if (!this.sett.scripts) return
        let delta = {}

        this.get('.').forEach(v => {
            if (v.script && v.script.execOnRange &&
                v.settings.$uuid) {
                // TODO: execInterrupt flag?
                if (Utils.delayed_exec(v)) {
                    delta[v.settings.$uuid] = v.settings
                }
            }
        })

        if (Object.keys(delta).length) {
            let tf = this.tv.$refs.chart.interval_ms ||
                     this.data.chart.tf
            let range = this.tv.getRange()
            this.ww.just('update-ov-settings', {
                delta, tf, range
            })
        }
    }

    // Overlay modification from WW
    modify_overlay(upd) {
        let obj = this.get_overlay(upd)
        if (obj) {
            for (var k in upd.fields || {}) {
                if (typeof obj[k] === 'object') {
                    this.merge(`${upd.uuid}.${k}`, upd.fields[k])
                } else {
                    obj[k] = upd.fields[k]
                }
            }
        }
    }

    data_changed(args) {
        if (!this.sett.scripts) return
        if (this.sett.data_change_exec === false) return
        let main = this.data.chart.data
        if (this.ww._data_uploading) return
        if (!this.se_state.scripts) return
        this.send_meta_2_ww()
        this.ww.just('upload-data', { ohlcv: main })
        this.ww._data_uploading = true
        this.set_loading(true)
    }

    set_loading(flag) {
        let skrr = this.get('.').filter(x => x.settings.$props)
        for (var s of skrr) {
            this.merge(`${s.id}`, { loading: flag })
        }
    }

    send_meta_2_ww() {
        let tf = this.tv.$refs.chart.interval_ms ||
                 this.data.chart.tf
        let range = this.tv.getRange()
        this.ww.just('send-meta-info', { tf, range })
    }

    merge_presets(proto, preset) {
        if (!preset) return
        for (var k in preset) {
            if (k === 'settings') {
                Object.assign(proto[k], preset[k])
            } else {
                proto[k] = preset[k]
            }
        }
    }

    grid_mousedown(args) {
        // TODO: tool state finished?
        this.object_selected([])
        // Remove the previous RangeTool
        let rem = () => this.get('RangeTool')
            .filter(x => x.settings && x.settings.shiftMode)
            .forEach(x => this.del(x.id))
        
        // First do some debug logging to help identify issues
        console.log('Grid mousedown', {
            grid_id: args[0],
            tool: this.data.tool,
            drawingMode: this.data.drawingMode,
            event: args[1] ? {
                type: args[1].type,
                x: args[1].layerX,
                y: args[1].layerY
            } : 'unknown',
            hasTools: this.data.tools && this.data.tools.length > 0,
            availableTools: this.data.tools ? this.data.tools.map(t => t.type) : []
        });
        
        // Force drawing mode to start with whatever tool is selected
        if (this.data.tool && this.data.tool !== 'Cursor') {
            console.log('Starting drawing mode with tool:', this.data.tool);
            
            try {
                // Start drawing mode - critical that this is true
                this.data.drawingMode = true;
                
                // Ensure the tool isn't already active to avoid duplication
                const existingTool = this.find_tool_by_type(this.data.tool);
                if (existingTool) {
                    console.log('Tool already exists, setting it to active', existingTool);
                    // Set it to active state instead of creating a new one
                    this.merge(`${existingTool.id}.settings`, {
                        $selected: true,
                        $state: 'wip'
                    });
                    this.data.selected = `${existingTool.id}-${Utils.now()}`;
                } else {
                    // Create a new tool
                    console.log('Building new tool instance');
                    this.build_tool(args[0]);
                }
                
                console.log('Drawing mode enabled:', 
                    this.data.drawingMode, 
                    'Current tool:', 
                    this.data.tool);
                
                // Force update to chart data to ensure the tool is rendered
                this.tv.$set(this.data, 'drawingMode', true);
                
                // Ensure cursor does not move back to Cursor automatically
                if (this.data.tool !== 'Cursor') {
                    this.tv.$set(this.data, 'tool', this.data.tool);
                }
                
                // Emit a custom event so any components watching can respond
                this.tv.$emit('custom-event', {
                    event: 'drawing-started',
                    args: [this.data.tool, args[0]]
                });
                
                // Force a data update to ensure all components react
                if (this.tv.$refs.chart) {
                    this.tv.$refs.chart.update();
                }
            } catch (e) {
                console.error('Error starting drawing mode:', e);
            }
        } else if (this.sett.shift_measure && args[1] && args[1].shiftKey) {
            rem();
            
            // Build directly instead of using nextTick
            try {
                this.build_tool(args[0], 'RangeTool:ShiftMode');
            } catch (e) {
                console.error('Error building RangeTool:', e);
            }
        } else {
            rem();
        }
    }
    
    // Helper method to find existing tools by type
    find_tool_by_type(toolType) {
        // Look in onchart overlays
        for (const ov of this.data.onchart || []) {
            if (ov.type === 'LineTool' && 
                ((ov.name && ov.name.includes(toolType)) || 
                 (ov.settings && ov.settings.lineType === toolType))) {
                return ov;
            }
        }
        
        // Look in offchart overlays
        for (const ov of this.data.offchart || []) {
            if (ov.type === 'LineTool' && 
                ((ov.name && ov.name.includes(toolType)) || 
                 (ov.settings && ov.settings.lineType === toolType))) {
                return ov;
            }
        }
        
        return null;
    }

    drawing_mode_off() {
        console.log('Turning drawing mode off');
        this.data.drawingMode = false;
        this.data.tool = 'Cursor';
    }

    // Place a new tool
    build_tool(grid_id, type) {
        // Add debug info to help diagnose issues
        console.log('Building tool', { 
            grid_id, 
            type: type || this.data.tool,
            availableTools: this.data.tools ? this.data.tools.map(t => t.type) : []
        });
        
        let list = this.data.tools || []
        type = type || this.data.tool
        
        if (!type) {
            console.error('No tool type specified');
            return;
        }
        
        // Special case for segment tool which might be registered differently
        if (type === 'LineTool:Segment') {
            type = 'Segment';
        } else if (type === 'LineTool:Extended') {
            type = 'Extended';
        } else if (type === 'LineTool:Ray') {
            type = 'Ray';
        }
        
        let proto = list.find(x => x.type === type)
        
        // If we can't find the tool in the list, check for tools without full type name (missing colon)
        if (!proto && type.indexOf(':') > 0) {
            const baseType = type.split(':')[0];
            proto = list.find(x => x.type === baseType);
        }
        
        // If still not found, check for LineTool
        if (!proto && (type === 'Segment' || type === 'Extended' || type === 'Ray')) {
            proto = list.find(x => x.type === 'LineTool');
        }
        
        // If still not found, manually create a prototype
        if (!proto && (type === 'Segment' || type === 'Extended' || type === 'Ray')) {
            console.log('Creating manual prototype for:', type);
            
            // Create a basic tool prototype
            proto = {
                type: type,
                name: type,
                settings: {}
            };
            
            if (type === 'Extended') {
                proto.settings.extended = true;
            } else if (type === 'Ray') {
                proto.settings.ray = true;
            }
            
            // Add to tools list for future use
            if (!this.data.tools) this.data.tools = [];
            this.data.tools.push(proto);
        }
        
        if (!proto) {
            console.error(`Could not find tool of type: ${type}`);
            return;
        }
        
        console.log('Found prototype for tool:', proto);
        
        let sett = Object.assign({}, proto.settings || {})
        let data = (proto.data || []).slice()

        if(!('legend' in sett)) sett.legend = false
        if(!('z-index' in sett)) sett['z-index'] = 100
        sett.$selected = true
        sett.$state = 'wip'
        
        // Store the original tool type for later reference
        sett.lineType = type;

        let side = grid_id ? 'offchart' : 'onchart'
        
        // Make tool type parsing more robust
        const toolType = type.indexOf(':') > 0 ? type.split(':')[0] : type;
        
        // If using the Segment tool, make sure we set the correct type
        // For segment, ray, and extended lines, we need to use LineTool
        let finalType;
        if (toolType === 'Segment' || toolType === 'Extended' || toolType === 'Ray' ||
            type === 'Segment' || type === 'Extended' || type === 'Ray') {
            finalType = 'LineTool';
            console.log('Setting final type to LineTool for line drawing');
            
            // Make sure we store the correct settings for this line type
            if (type === 'Extended' || toolType === 'Extended') {
                sett.extended = true;
                sett.ray = false;
            } else if (type === 'Ray' || toolType === 'Ray') {
                sett.ray = true;
                sett.extended = false;
            } else {
                // Regular segment (default)
                sett.ray = false;
                sett.extended = false;
            }
        } else {
            finalType = toolType;
        }
            
        console.log('Adding tool with type:', finalType, 'settings:', sett);
        
        // Make sure the tool has a recognizable name
        const displayName = proto.name || 
            (finalType === 'LineTool' ? (type === 'Segment' ? 'Line Segment' : type) : toolType);
        
        // Create default pin positions if needed for line tools
        if (finalType === 'LineTool' && !sett.p1) {
            // Get chart dimensions from the layout if available
            let width = 0, height = 0;
            if (this.tv && this.tv.$refs.chart && this.tv.$refs.chart._layout) {
                const layout = this.tv.$refs.chart._layout;
                const grid = layout.grids[grid_id || 0];
                width = grid ? grid.width : 800;
                height = grid ? grid.height : 400;
            } else {
                // Default dimensions
                width = 800;
                height = 400;
            }
            
            // Calculate mid point and offsets
            const midX = width / 2;
            const midY = height / 2;
            
            // Get timestamp for positions if available
            let now = Date.now();
            let chartData = this.tv.$refs.chart ? this.tv.$refs.chart.ohlcv : [];
            let timeRange = 3600000; // 1 hour default
            
            if (chartData && chartData.length) {
                // Use actual chart time range if available
                timeRange = (chartData[chartData.length - 1][0] - chartData[0][0]) / 10;
            }
            
            // Create pin positions (default or calculated)
            sett.p1 = [now - timeRange, midY - 20];
            sett.p2 = [now, midY + 20];
            
            console.log('Created default pin positions for line tool:', sett.p1, sett.p2);
        }
        
        let id = this.add(side, {
            name: displayName,
            type: finalType,
            settings: sett,
            data: data,
            grid: { id: grid_id }
        });

        sett.$uuid = `${id}-${Utils.now()}`
        this.data.selected = sett.$uuid
        
        console.log('Tool added with ID:', id);
        
        // Ensure drawing mode is enabled
        this.data.drawingMode = true;
        
        // Force reactive update using Vue.set for critical properties
        if (this.tv && this.tv.$set) {
            this.tv.$set(this.data, 'tool', this.data.tool);
            this.tv.$set(this.data, 'drawingMode', true);
            this.tv.$set(this.data, 'selected', sett.$uuid);
        }
        
        this.add_trash_icon();
        
        // Return the ID for further reference
        return id;
    }

    // Remove selected / Remove all, etc
    system_tool(type) {
        switch (type) {
            case 'Remove':
                if (this.data.selected) {
                    this.del(this.data.selected)
                    this.remove_trash_icon()
                    this.drawing_mode_off()
                    this.on_scroll_lock(false)
                }
                break
        }
    }

    // Apply new overlay settings
    change_settings(args) {
        let settings = args[0]
        delete settings.id
        let grid_id = args[1]
        this.merge(`${args[3]}.settings`, settings)
    }

    // Lock the scrolling mechanism
    on_scroll_lock(flag) {
        this.data.scrollLock = flag
    }

    // When new object is selected / unselected
    object_selected(args) {
        var q = this.data.selected
        if (q) {
            // Check if current drawing is finished
            //let res = this.get_one(`${q}.settings`)
            //if (res && res.$state !== 'finished') return
            this.merge(`${q}.settings`, {
                $selected: false
            })
            this.remove_trash_icon()
        }
        this.data.selected = null

        if (!args.length) return

        this.data.selected = args[2]
        this.merge(`${args[2]}.settings`, {
            $selected: true
        })

        this.add_trash_icon()
    }

    add_trash_icon() {
        const type = 'System:Remove'
        if (this.data.tools.find(x => x.type === type)) {
            return
        }
        this.data.tools.push({
            type, icon: Icons['trash.png']
        })
    }

    remove_trash_icon() {
        // TODO: Does not call Toolbar render (distr version)
        const type = 'System:Remove'
        Utils.overwrite(this.data.tools,
            this.data.tools.filter(x => x.type !== type)
        )
    }

    // Set overlay data from the web-worker
    on_overlay_data(data) {
        this.get('.').forEach(x => {
            if (x.settings.$synth) this.del(`${x.id}`)
        })
        for (var ov of data) {
            let obj = this.get_one(`${ov.id}`)
            if (obj) {
                this.tv.$set(obj, 'loading', false)
                if (!ov.data) continue
                obj.data = ov.data
            }
            if (!ov.new_ovs) continue
            for (var id in ov.new_ovs.onchart) {
                if (!this.get_one(`onchart.${id}`)) {
                    this.add('onchart', ov.new_ovs.onchart[id])
                }
            }
            for (var id in ov.new_ovs.offchart) {
                if (!this.get_one(`offchart.${id}`)) {
                    this.add('offchart', ov.new_ovs.offchart[id])
                }
            }
        }
    }

    // Push overlay updates from the web-worker
    on_overlay_update(data) {
        for (var ov of data) {
            if (!ov.data) continue
            let obj = this.get_one(`${ov.id}`)
            if (obj) {
                this.fast_merge(obj.data, ov.data, false)
            }
        }
    }

    // Clean-up unfinished business (tools)
    before_destroy() {
        let f = x => !x.settings.$state ||
            x.settings.$state === 'finished'
        this.data.onchart = this.data.onchart
            .filter(f)
        this.data.offchart = this.data.offchart
            .filter(f)
        this.drawing_mode_off()
        this.on_scroll_lock(false)
        this.object_selected([])
        this.ww.destroy()
    }

    // Get overlay by grid-layer id
    get_overlay(obj) {
        let id = obj.id || `g${obj.grid_id}_${obj.layer_id}`
        let dcid = obj.uuid || this.gldc[id]
        return this.get_one(`${dcid}`)
    }


}
