class _NoteTexture {
    constructor() {
        this.image = null;
        this.scale = 1;
        this.head_split = 0;
        this.tail_split = 0;
    }
};

class _LineHeadTexture {
    constructor() {
        this.image = null;
        this.scale = 1;
        this.connect_point = 0;
    }
}

class _SeedBaseRandom {
    constructor() {
        this._map = new Map();
    }

    rand(seed) {
        if (this._map.has(seed)) {
            return this._map.get(seed);
        }

        const r = Math.random();
        this._map.set(seed, r);
        return r;
    }
}

class _ShaderTextureGenerator {
    constructor() {
        this._cv = document.createElement("canvas");
        this._gl = this._cv.getContext("webgl") || this._cv.getContext("experimental-webgl");

        this._gl.enable(this._gl.BLEND);

        const tex = this._gl.createTexture();
        this._gl.bindTexture(this._gl.TEXTURE_2D, tex);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
        this._gl.clearColor(0, 0, 0, 0);

        this._seted_locations = new Map();
    }

    create_prog(fs_s) {
        const vs_s = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 uv;

            void main() {
                gl_Position = vec4(a_position, 0, 1);
                uv = a_texCoord;
            }
        `;
        
        const positions = [
            -1, 1,
            1, 1,
            -1, -1,
            1, -1,
        ];

        const texCoords = [
            0, 1,
            1, 1,
            0, 0,
            1, 0,
        ];

        const vs = this._gl.createShader(this._gl.VERTEX_SHADER);
        this._gl.shaderSource(vs, vs_s);
        this._gl.compileShader(vs);

        const fs = this._gl.createShader(this._gl.FRAGMENT_SHADER);
        this._gl.shaderSource(fs, fs_s);
        this._gl.compileShader(fs);

        const prog = this._gl.createProgram();
        if (!this._gl.getShaderParameter(vs, this._gl.COMPILE_STATUS)) {
            console.error("Error compiling vertex shader:", this._gl.getShaderInfoLog(vs));
            return null;
        }

        this._gl.attachShader(prog, vs);
        this._gl.attachShader(prog, fs);
        this._gl.linkProgram(prog);
        this._gl.useProgram(prog);

        const positionBuffer = this._gl.createBuffer();
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, positionBuffer);
        this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(positions), this._gl.STATIC_DRAW);
        const posAttrLocation = this._gl.getAttribLocation(prog, "a_position");
        this._gl.vertexAttribPointer(posAttrLocation, 2, this._gl.FLOAT, false, 0, 0);
        this._gl.enableVertexAttribArray(posAttrLocation);

        const texCoordBuffer = this._gl.createBuffer();
        this._gl.bindBuffer(this._gl.ARRAY_BUFFER, texCoordBuffer);
        this._gl.bufferData(this._gl.ARRAY_BUFFER, new Float32Array(texCoords), this._gl.STATIC_DRAW);
        const texCoordAttrLocation = this._gl.getAttribLocation(prog, "a_texCoord");
        this._gl.vertexAttribPointer(texCoordAttrLocation, 2, this._gl.FLOAT, false, 0, 0);
        this._gl.enableVertexAttribArray(texCoordAttrLocation);

        const texLocation = this._gl.getUniformLocation(prog, "screenTexture");
        this._gl.uniform1i(texLocation, 0);

        return prog;
    }

    #set_location(loc, val) {
        if (typeof val == "boolean") {
            this._gl.uniform1i(loc, val ? 1 : 0);
        } else {
            this._gl[`uniform${val.length}fv`](loc, val);
        }

        this._seted_locations.set(loc, val);
    }

    #reset_locations() {
        this._seted_locations.forEach((val, loc) => {
            if (typeof val == "boolean") {
                this._gl.uniform1i(loc, 0);
            } else {
                this._gl[`uniform${val.length}fv`](loc, new Array(val.length).fill(0));
            }
        })
        this._seted_locations.clear();
    }

    draw(prog, img, uniforms) {
        if (uniforms.__enableAlpha) {
            this._gl.blendFunc(this._gl.SRC_ALPHA, this._gl.ONE_MINUS_SRC_ALPHA);
        } else {
            this._gl.blendFunc(this._gl.ONE, this._gl.ONE_MINUS_SRC_ALPHA);
        }

        this._gl.useProgram(prog);

        for (const key in uniforms) {
            let val = uniforms[key];
            if (typeof val == "number") val = [val];
            if (!prog[`${key}_loc`]) prog[`${key}_loc`] = this._gl.getUniformLocation(prog, key);
            const loc = prog[`${key}_loc`];
            this.#set_location(loc, val);
        }

        this._cv.width = img.width;
        this._cv.height = img.height;
        this._gl.viewport(0, 0, this._cv.width, this._cv.height);
        this._gl.clear(this._gl.COLOR_BUFFER_BIT);
        this._gl.texImage2D(this._gl.TEXTURE_2D, 0, this._gl.RGBA, this._gl.RGBA, this._gl.UNSIGNED_BYTE, img);
        this._gl.drawArrays(this._gl.TRIANGLE_STRIP, 0, 4);

        this.#reset_locations();

        const newcv = document.createElement("canvas");
        newcv.width = img.width;
        newcv.height = img.height;
        _warp_ctx2d(newcv.getContext("2d")).drawImage(this._cv, 0, 0);
        return newcv;
    }
}

function _warp_ctx2d(raw) {
    return new Proxy(raw, {
        get: function(target, prop, receiver) {
            if (prop == "drawImage") {
                return (...args) => {
                    if (!args[0].width || !args[0].height) {
                        return;
                    }

                    return raw.drawImage(...args);
                };
            }

            const value = target[prop];
            
            if (typeof value === "function") {
                return value.bind(target);
            }
            
            return value;
        },
        set: function(target, prop, value) {
            target[prop] = value;
            return true;
        }
    });
}

function _solve_wasm_path(dir) {
    return new URL(
        `${dir}/millune_h5bind_wasm.js`, 
        document.baseURI || window.location.href
    ).href;
}

async function _normToUint8Array(input) {
    if (input instanceof Uint8Array) {
        return input;
    }

    if (input instanceof Uint8ClampedArray) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }

    if (input instanceof ArrayBuffer) {
        return new Uint8Array(input);
    }

    if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }

    if (input instanceof Blob) {
        return await _normToUint8Array(await input.arrayBuffer());
    }

    throw new Error("Unsupported input type: " + Object.prototype.toString.call(input));
}

class MilLunePlayer {
    constructor(options) {
        options = options || {};

        if (!options.buildDirectory) {
            throw new Error("No buildDirectory specified");
        }

        if (!options.canvas) {
            throw new Error("No canvas specified");
        }

        if (!options.resourcePackPath) {
            throw new Error("No resourcePackPath specified");
        }

        if (!options.canvas.getContext("2d")) {
            throw new Error("Canvas does not support 2d context");
        }

        if (!options.chartPath) {
            throw new Error("No chartPath specified");
        }

        if (!options.audioPath) {
            throw new Error("No audioPath specified");
        }

        if (!options.illuPath) {
            throw new Error("No illuPath specified");
        }

        if (!options.fontFam) {
            throw new Error("No fontFam specified");
        }

        if (!options.pauseBtnPath) {
            throw new Error("No pauseBtnPath specified");
        }

        if (!options.storyboardTextureLoader) {
            throw new Error("No storyboardTextureLoader specified");
        }

        if (options.isAutoplay === void 0) {
            throw new Error("No isAutoplay specified");
        }

        this._buildDirectory = options.buildDirectory;
        this._resourcePackPath = options.resourcePackPath;
        this._hitsoundPath = options.hitsoundPath || "./resources/StreamingAssets";
        this._canvas = options.canvas;
        this._chartPath = options.chartPath;
        this._audioPath = options.audioPath;
        this._illuPath = options.illuPath;
        this._fontFam = options.fontFam;
        this._pauseBtnPath = options.pauseBtnPath;
        this._storyboardTextureLoader = options.storyboardTextureLoader;
        this._isAutoplay = options.isAutoplay;
        this._completionStats = null; // 存储结算数据
        this._searchEngine = null;     // 反向搜索引擎 WASM（用于反推判定）
    }

    /**
     * 加载 score_search_engine.wasm（计分搜索引擎）
     * 用于从目标分数+物量精确反推判定序列
     */
    async #initSearchEngine() {
        if (this._searchEngine) return this._searchEngine;
        try {
            // 使用 score_engine.js 提供的封装（与 mil/ 目录下的实现一致）
            // 尝试多种路径解析策略
            let engineUrl;
            if (typeof import.meta !== 'undefined' && import.meta.url) {
                // 我们是一个ES模块，基于当前模块位置解析路径
                engineUrl = new URL('../mil/score_engine.js', import.meta.url).href;

            } else {
                // 回退到基于文档基础URL的路径
                engineUrl = new URL('../mil/score_engine.js', document.baseURI || window.location.href).href;

            }

            
            const module = await import(engineUrl);

            const { calculateScore, createSearcher } = await module.createScoreEngine();
            
            this._searchEngine = {
                calculateScore,
                createSearcher
            };

            return this._searchEngine;
        } catch (err) {
            this._searchEngine = null;
            return null;
        }
    }

    async init() {

        this._rand = new _SeedBaseRandom();

        const module = await import(_solve_wasm_path(this._buildDirectory));
        this._instance = await module.default();

        this._ctx = this.#call_wasm("h5bind_create_context");

        this.#set_rendering_func("drawBackground", this._instance.addFunction(this.#drawBackground.bind(this), "v"));
        this.#set_rendering_func("drawMilLineHead", this._instance.addFunction(this.#drawMilLineHead.bind(this), "vdddi"));
        this.#set_rendering_func("drawLine", this._instance.addFunction(this.#drawLine.bind(this), "vdddddi"));
        this.#set_rendering_func("drawPointNote", this._instance.addFunction(this.#drawPointNote.bind(this), "vidddddi"));
        this.#set_rendering_func("drawHold", this._instance.addFunction(this.#drawHold.bind(this), "vidddddddi"));
        this.#set_rendering_func("getTextureSize", this._instance.addFunction(this.#getTextureSize.bind(this), "viii"));
        this.#set_rendering_func("getScreenSize", this._instance.addFunction(this.#getScreenSize.bind(this), "vii"));
        this.#set_rendering_func("playClicksound", this._instance.addFunction(this.#playClicksound.bind(this), "vi"));
        this.#set_rendering_func("getDuration", this._instance.addFunction(this.#getDuration.bind(this), "vi"));
        this.#set_rendering_func("drawPauseBtn", this._instance.addFunction(this.#drawPauseBtn.bind(this), "vddddd"));
        this.#set_rendering_func("drawProgressBar", this._instance.addFunction(this.#drawProgressBar.bind(this), "vdd"));
        this.#set_rendering_func("drawText", this._instance.addFunction(this.#drawText.bind(this), "vijdddiiii"));
        this.#set_rendering_func("loadStoryboardTexture", this._instance.addFunction(this.#loadStoryboardTexture.bind(this), "vijiii"));
        this.#set_rendering_func("drawStoryboardText", this._instance.addFunction(this.#drawStoryboardText.bind(this), "vijddddddi"));
        this.#set_rendering_func("drawStoryboardPicture", this._instance.addFunction(this.#drawStoryboardPicture.bind(this), "vjdddddddi"));
        this.#set_rendering_func("releaseStoryboardTexture", this._instance.addFunction(this.#releaseStoryboardTexture.bind(this), "vj"));
        this.#set_rendering_func("createClickEffectTexture", this._instance.addFunction(this.#createClickEffectTexture.bind(this), "vjdiii"));
        this.#set_rendering_func("drawClickEffectTexture", this._instance.addFunction(this.#drawClickEffectTexture.bind(this), "vjidddd"));
        this.#set_rendering_func("releaseClickEffectTexture", this._instance.addFunction(this.#releaseClickEffectTexture.bind(this), "vj"));
        this.#set_rendering_func("drawEllipse", this._instance.addFunction(this.#drawEllipse.bind(this), "vdddddi"));
        this.#set_rendering_func("getResourcePackNoteScale", this._instance.addFunction(this.#getResourcePackNoteScale.bind(this), "vii"));
        this.#set_rendering_func("getResourcePackLineHeadScale", this._instance.addFunction(this.#getResourcePackLineHeadScale.bind(this), "vi"));
        this.#set_rendering_func("getResourcePackLineHeadConnectPoint", this._instance.addFunction(this.#getResourcePackLineHeadConnectPoint.bind(this), "vi"));
        this.#set_rendering_func("drawRect", this._instance.addFunction(this.#drawRect.bind(this), "vddddi"));
        this.#set_rendering_func("drawCompletionStatus", this._instance.addFunction(this.#drawCompletionStatus.bind(this), "vijiiiijd"));

        const resourcePackData = await fetch(this._resourcePackPath).then(response => response.arrayBuffer());
        const resourcePackDataPtr = this.#malloc_array_buffer(resourcePackData);
        this._resourcePack = this.#call_wasm("h5bind_create_resource_pack", resourcePackDataPtr, BigInt(resourcePackData.byteLength));
        this.#free(resourcePackDataPtr);

        this._image_resizeopt_factor = this.#is_mobile() ? 0.5 : 1.0;

        this._all_note_keys = [
            "tap", "tap_double", "extap", "extap_double",
            "hold", "hold_double", "exhold", "exhold_double",
            "drag", "drag_double", "exdrag", "exdrag_double"
        ];

        this._note_texture_map = new Map();

        for (const key of this._all_note_keys) {
            const texture = this.#get_note_texture(key);
            this._note_texture_map.set(key, texture);
        }

        this._line_head_texture = this.#get_line_head_texture();

        for (const tex of this._note_texture_map.values()) {
            tex.image = await tex.image;
        }

        this._line_head_texture.image = await this._line_head_texture.image;

        this._audioCtx = new AudioContext({
            latencyHint: "interactive"
        });

        this._hitsound_map = new Map();


        for (const key of this._all_note_keys) {

            const hitsound = this.#get_hitsound(key);
            this._hitsound_map.set(key, hitsound);
        }

        for (const key of this._hitsound_map.keys()) {
            this._hitsound_map.set(key, await this._hitsound_map.get(key));
        }

        const audioData = await fetch(this._audioPath).then(response => response.arrayBuffer());
        this._audioClip = await this._audioCtx.decodeAudioData(audioData);
        this._currentAudioSource = null;
        this._audioTime = 0;

        this._texIdBase = 0;
        this._stgen = new _ShaderTextureGenerator();
        this._clickEffectProg = this._stgen.create_prog(`
precision highp float;
varying lowp vec2 uv;

uniform float p;
uniform float seed;
uniform float innerCircRadius;
uniform vec3 color;

float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    
    float a = rand(ip);
    float b = rand(ip + vec2(1.0, 0.0));
    float c = rand(ip + vec2(0.0, 1.0));
    float d = rand(ip + vec2(1.0, 1.0));
    
    vec2 u = fp * fp * (3.0 - 2.0 * fp);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float circularNoise(vec2 uv, float density, float seed) {
    vec2 center = uv - 0.5;
    float radius = length(center) * density;
    float angle = abs(atan(center.y, center.x));

    if (uv.y > 0.5) {
        angle += sin(angle) * 2.;
    }

    vec2 seedOffset = vec2(seed * 100.0, seed * 100.0);
    vec2 polarCoord = vec2(radius, angle) + seedOffset;
    
    float n = 0.0;
    n += noise(polarCoord) * 0.7;
    n += noise(polarCoord * 2.0) * 0.3;
    n += noise(polarCoord * 4.0) * 0.1;
    
    return n;
}

void main() {
    gl_FragColor.rgb = color;
    gl_FragColor.a = 1.0;
    float l = length(uv - 0.5);

    if (innerCircRadius <= l && l <= 0.5) {
        float n = circularNoise(uv, 50.0, seed);
        gl_FragColor.a *= (n < p) ? 0.0 : 1.0;
    } else {
        gl_FragColor.a = 0.0;
    }
}
`);

        this._clickEffectMap = new Map();
        this._storyboardTextureMap = new Map();

        this.#call_wasm("h5bind_init_context", this._ctx);

        for (const key of this._clickEffectMap.keys()) {
            const pair = this._clickEffectMap.get(key);
            this._clickEffectMap.set(key, await Promise.all(pair));
        }

        const chartData = await fetch(this._chartPath).then(response => response.arrayBuffer());
        const chartDataPtr = this.#malloc_array_buffer(chartData);
        this.#call_wasm("h5bind_load_chart", this._ctx, chartDataPtr, BigInt(chartData.byteLength));
        this.#free(chartDataPtr);

        if (!this._isAutoplay) {
            this.#call_wasm("h5bind_disable_autoplay", this._ctx);
        }

        this._illuImage = await this.#load_image_from_path(this._illuPath);
        this._pauseBtnImage = await this.#load_image_from_path(this._pauseBtnPath);

        this._cvctx = _warp_ctx2d(this._canvas.getContext("2d"));

        if (this.#is_mobile()) {
            this._cvctx.imageSmoothingEnabled = false;
        }

        this._holdcv = document.createElement("canvas");
        this._applycolorcv = document.createElement("canvas");

        this._canvas.setAttribute("tabindex", "0");
        this._canvas.focus();

        let isTouchDevice = false;

        this._canvas.addEventListener("keydown", e => {
            if (!this._currentAudioSource) return;
            if (e.repeat) return;
            const t = this.get_chart_time();
            this.#call_wasm("h5bind_judgement_keydown", this._ctx, t, BigInt(1000 + e.keyCode));
        });

        this._canvas.addEventListener("keyup", e => {
            if (!this._currentAudioSource) return;
            const t = this.get_chart_time();
            this.#call_wasm("h5bind_judgement_keyup", this._ctx, t, BigInt(1000 + e.keyCode));
        });

        this._canvas.addEventListener("touchstart", e => {
            isTouchDevice = true;
            if (!this._currentAudioSource) return;
            const t = this.get_chart_time();
            const touch = e.changedTouches[0];
            this.#call_wasm("h5bind_judgement_touchstart", this._ctx, t, BigInt(touch.identifier), touch.clientX, touch.clientY);
        });

        this._canvas.addEventListener("touchmove", e => {
            isTouchDevice = true;
            if (!this._currentAudioSource) return;
            const t = this.get_chart_time();
            const touch = e.changedTouches[0];
            this.#call_wasm("h5bind_judgement_touchmove", this._ctx, t, BigInt(touch.identifier), touch.clientX, touch.clientY);
        });

        this._canvas.addEventListener("touchend", e => {
            isTouchDevice = true;
            if (!this._currentAudioSource) return;
            const t = this.get_chart_time();
            const touch = e.changedTouches[0];
            this.#call_wasm("h5bind_judgement_touchend", this._ctx, t, BigInt(touch.identifier));
        });

        this._canvas.addEventListener("mousedown", e => {
            if (!this._currentAudioSource) return;
            if (isTouchDevice) return;
            const t = this.get_chart_time();
            this.#call_wasm("h5bind_judgement_touchstart", this._ctx, t, BigInt(2000 + e.button), e.clientX, e.clientY);
        });

        this._canvas.addEventListener("mousemove", e => {
            if (!this._currentAudioSource) return;
            if (isTouchDevice) return;
            if (e.buttons <= 0) return;
            const t = this.get_chart_time();
            this.#call_wasm("h5bind_judgement_touchmove", this._ctx, t, BigInt(2000 + e.button), e.clientX, e.clientY);
        });

        this._canvas.addEventListener("mouseup", e => {
            if (!this._currentAudioSource) return;
            if (isTouchDevice) return;
            const t = this.get_chart_time();
            this.#call_wasm("h5bind_judgement_touchend", this._ctx, t, BigInt(2000 + e.button));
        });

        // 加载反向搜索 WASM 引擎（用于结算时反推判定）
        await this.#initSearchEngine();
    }

    #call_wasm(func, ...args) {
        return this._instance["_" + func](...args);
    }

    #malloc_string(str) {
        const len = this._instance.lengthBytesUTF8(str);
        const ptr = this.#call_wasm("malloc", len + 1);
        this._instance.stringToUTF8(str, ptr, len + 1);
        return ptr;
    }

    #malloc_array_buffer(buffer) {
        const ptr = this.#call_wasm("malloc", buffer.byteLength);
        new Uint8Array(this._instance.HEAPU8.buffer, ptr, buffer.byteLength).set(new Uint8Array(buffer));
        return ptr;
    }

    #free(ptr) {
        this.#call_wasm("free", ptr);
    }

    #read_string(ptr) {
        return this._instance.UTF8ToString(ptr);
    }

    #read_string_with_size(ptr, size) {
        const new_ptr = this.#call_wasm("malloc", size + 1);
        new Uint8Array(this._instance.HEAPU8.buffer, new_ptr, size).set(new Uint8Array(this._instance.HEAPU8.buffer, ptr, size));
        this._instance.HEAPU8[new_ptr + size] = 0;
        const result = this.#read_string(new_ptr);
        this.#free(new_ptr);
        return result;
    }

    #read_string_and_free(ptr) {
        const str = this.#read_string(ptr);
        this.#free(ptr);
        return str;
    }

    #set_rendering_func(name, func) {
        const sptr = this.#malloc_string(name);
        this.#call_wasm("h5bind_context_set_rendering_func", this._ctx, sptr, func);
        this.#free(sptr);
    }

    #get_note_key(type) {
        const ptr = this.#call_wasm("h5bind_mil_get_note_key", type);
        return this.#read_string_and_free(ptr);
    }

    #read_f64(ptr) {
        const view = new DataView(this._instance.HEAPU8.buffer);
        const result = view.getFloat64(ptr, true);
        return result;
    }

    #read_u64(ptr) {
        const view = new DataView(this._instance.HEAPU8.buffer);
        const result = view.getBigUint64(ptr, true);
        return result;
    }

    #set_f64(ptr, value) {
        const view = new DataView(this._instance.HEAPU8.buffer);
        view.setFloat64(ptr, value, true);
    }

    #set_u64(ptr, value) {
        const view = new DataView(this._instance.HEAPU8.buffer);
        view.setBigUint64(ptr, BigInt(value), true);
    }

    #get_note_texture(key) {
        const info_size = 8 * 6;
        const info_ptr = this.#call_wasm("malloc", info_size);
        const key_ptr = this.#malloc_string(key);
        const tex_ptr = this.#call_wasm(
            "h5bind_get_note_texture",
            this._resourcePack,
            key_ptr,
            info_ptr,
            info_ptr + 8,
            info_ptr + 16,
            info_ptr + 24,
            info_ptr + 32,
            info_ptr + 40,
        );
        const scale = this.#read_f64(info_ptr);
        const head_split = parseInt(this.#read_u64(info_ptr + 8));
        const tail_split = parseInt(this.#read_u64(info_ptr + 16));
        const output_width = parseInt(this.#read_u64(info_ptr + 24));
        const output_height = parseInt(this.#read_u64(info_ptr + 32));
        const output_size = parseInt(this.#read_u64(info_ptr + 40));
        const rgba_data = new Uint8ClampedArray(this._instance.HEAPU8.buffer, tex_ptr, output_size).slice();
        this.#free(key_ptr);
        this.#free(info_ptr);
        this.#free(tex_ptr);

        const result = new _NoteTexture();
        result.image = this.#create_image_bitmap(new ImageData(
            rgba_data, output_width, output_height
        ));
        result.scale = scale;
        result.head_split = head_split * this._image_resizeopt_factor;
        result.tail_split = tail_split * this._image_resizeopt_factor;

        return result;
    }

    #get_line_head_texture() {
        const info_size = 8 * 5;
        const info_ptr = this.#call_wasm("malloc", info_size);
        const tex_ptr = this.#call_wasm(
            "h5bind_get_line_head_texture",
            this._resourcePack,
            info_ptr,
            info_ptr + 8,
            info_ptr + 16,
            info_ptr + 24,
            info_ptr + 32,
        );
        const scale = this.#read_f64(info_ptr);
        const connect_point = this.#read_f64(info_ptr + 8);
        const output_width = parseInt(this.#read_u64(info_ptr + 16));
        const output_height = parseInt(this.#read_u64(info_ptr + 24));
        const output_size = parseInt(this.#read_u64(info_ptr + 32));
        const rgba_data = new Uint8ClampedArray(this._instance.HEAPU8.buffer, tex_ptr, output_size).slice();
        this.#free(info_ptr);
        this.#free(tex_ptr);

        const result = new _LineHeadTexture();
        result.image = this.#create_image_bitmap(new ImageData(
            rgba_data, output_width, output_height
        ));
        result.scale = scale;
        result.connect_point = connect_point * this._image_resizeopt_factor;

        return result;
    }

    async #get_hitsound(key) {
        // === 外部打击音加载（优先） ===
        // 从 StreamingAssets 目录读取 OGG 格式打击音
        // 命名规则：hit.ogg = 普通点击(tap/hold等)，drag.OGG = 拖拽(drag/exdrag等)
        try {
            const isDrag = key.includes("drag");
            const fileName = isDrag ? "drag.OGG" : "hit.ogg";
            const externalUrl = this._hitsoundPath + "/" + fileName;
            

            const response = await fetch(externalUrl);
            
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const clip = await this._audioCtx.decodeAudioData(arrayBuffer);
                return clip;
            } else {
            }
        } catch (e) {
        }

        // === 回退到 .mrp 资源包 ===
        const info_size = 8;
        const info_ptr = this.#call_wasm("malloc", info_size);
        const key_ptr = this.#malloc_string(key);
        const audio_ptr = this.#call_wasm(
            "h5bind_get_hitsound",
            this._resourcePack,
            key_ptr,
            info_ptr,
        );
        const output_size = parseInt(this.#read_u64(info_ptr));
        const encoded_audio = new Uint8Array(this._instance.HEAPU8.buffer, audio_ptr, output_size).slice();
        this.#free(key_ptr);
        this.#free(info_ptr);
        this.#free(audio_ptr);

        const clip = await this._audioCtx.decodeAudioData(encoded_audio.buffer);
        return clip;
    }

    #create_audio_buffer_source(clip) {
        const source = this._audioCtx.createBufferSource();
        source.buffer = clip;
        source.connect(this._audioCtx.destination);
        return source;
    }

    #parse_color(color) {
        return [
            ((color >> 24) & 0xff) / 0xff,
            ((color >> 16) & 0xff) / 0xff,
            ((color >> 8) & 0xff) / 0xff,
            (color & 0xff) / 0xff
        ];
    }

    #get_text_align(align) {
        if (align == 0) return "left";
        if (align == 1) return "center";
        if (align == 2) return "right";
        return "left";
    }

    #get_text_baseline(baseline) {
        if (baseline == 0) return "top";
        if (baseline == 1) return "middle";
        if (baseline == 2) return "bottom";
        return "top";
    }

    #load_image_from_path(path) {
        const img = new Image();
        return new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = path;
        }).then(this.#create_image_bitmap.bind(this));
    }

    #create_click_effect_texture_item(rand, p, color) {
        const cv = document.createElement("canvas");
        cv.width = cv.height = 256;
        return this.#create_image_bitmap(this._stgen.draw(this._clickEffectProg, cv, {
            __enableAlpha: true,
            p: p,
            seed: rand,
            innerCircRadius: 465 / 1080,
            color: this.#parse_color(color).slice(0, 3)
        }));
    }

    #apply_color_at_image(img, color) {
        if (Math.abs(color[0] - 1) + Math.abs(color[1] - 1) + Math.abs(color[2] - 1) < 0.0001) return img;
        
        const ctx = _warp_ctx2d(this._applycolorcv.getContext("2d"));
        this._applycolorcv.width = img.width;
        this._applycolorcv.height = img.height;
        
        ctx.save();
        ctx.fillStyle = `rgb(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255})`;
        ctx.fillRect(0, 0, this._applycolorcv.width, this._applycolorcv.height);
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(img, 0, 0);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(img, 0, 0);
        ctx.restore();

        return this._applycolorcv;
    }

    #is_mobile() {
        if (navigator.userAgentData?.mobile) return true;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    async #create_image_bitmap(img) {
        return await createImageBitmap(img, this._image_resizeopt_factor === 1 ? (void 0) : {
            resizeWidth: Math.max(1, parseInt(img.width * this._image_resizeopt_factor)),
            resizeHeight: Math.max(1, parseInt(img.height * this._image_resizeopt_factor))
        });
    }

    #drawBackground() {
        this._cvctx.save();
        this._cvctx.beginPath();
        this._cvctx.rect(0, 0, this._canvas.width, this._canvas.height);
        this._cvctx.clip();

        const r = this._illuImage.width / this._illuImage.height;
        const sr = this._canvas.width / this._canvas.height;
        let width, height;

        if (r > sr) {
            height = this._canvas.height;
            width = height * r;
        } else {
            width = this._canvas.width;
            height = width / r;
        }

        const x = (this._canvas.width - width) / 2;
        const y = (this._canvas.height - height) / 2;

        this._cvctx.drawImage(this._illuImage, x, y, width, height);
        this._cvctx.restore();

        this._cvctx.save();
        this._cvctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        this._cvctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
        this._cvctx.restore();

        const grd = this._cvctx.createLinearGradient(0, this._canvas.height * 0.6, 0, this._canvas.height);
        const n = 6;
        for (let i = 0; i < n; i++) {
            const p = i / (n - 1);
            const a = Math.pow(p, 2.2);
            grd.addColorStop(p, `rgba(0, 0, 0, ${a})`);
        }

        this._cvctx.save();
        this._cvctx.fillStyle = grd;
        this._cvctx.fillRect(0, this._canvas.height * 0.6, this._canvas.width, this._canvas.height);
        this._cvctx.restore();
    }

    #drawMilLineHead(x, y, size, color) {
        color = this.#parse_color(color);
        this._cvctx.save();
        this._cvctx.translate(x, y);
        this._cvctx.globalAlpha = color[3];
        this._cvctx.drawImage(this.#apply_color_at_image(this._line_head_texture.image, color), -size / 2, -size / 2, size, size);
        this._cvctx.restore();
    }

    #drawLine(x0, y0, x1, y1, width, color) {
        color = this.#parse_color(color);
        this._cvctx.save();
        this._cvctx.beginPath();
        this._cvctx.moveTo(x0, y0);
        this._cvctx.lineTo(x1, y1);
        this._cvctx.lineWidth = width;
        this._cvctx.strokeStyle = `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`;
        this._cvctx.stroke();
        this._cvctx.restore();
    }

    #drawPointNote(type, x, y, width, height, rotate, color) {
        color = this.#parse_color(color);
        this._cvctx.save();
        this._cvctx.translate(x, y);
        this._cvctx.rotate(rotate * Math.PI / 180);
        const texture = this._note_texture_map.get(this.#get_note_key(type));
        this._cvctx.globalAlpha = color[3];
        this._cvctx.drawImage(this.#apply_color_at_image(texture.image, color), -width / 2, -height / 2, width, height);
        this._cvctx.restore();
    }

    #drawHold(type, x, y, head, body, tail, height, rotate, color) {
        color = this.#parse_color(color);
        const holdctx = _warp_ctx2d(this._holdcv.getContext("2d"));
        const texture = this._note_texture_map.get(this.#get_note_key(type));
        
        head = parseInt(head);
        body = parseInt(body);
        tail = parseInt(tail);
        height = parseInt(height);

        this._holdcv.width = head + body + tail;
        this._holdcv.height = height;
        holdctx.clearRect(0, 0, this._holdcv.width, this._holdcv.height);

        holdctx.drawImage(
            texture.image,
            0, 0, texture.head_split, texture.image.height,
            0, 0, head, height
        );

        holdctx.drawImage(
            texture.image,
            texture.head_split, 0, texture.image.width - texture.head_split - texture.tail_split, texture.image.height,
            head, 0, body, height
        );

        holdctx.drawImage(
            texture.image,
            texture.image.width - texture.tail_split, 0, texture.tail_split, texture.image.height,
            head + body, 0, tail, height
        );

        this._cvctx.save();
        this._cvctx.translate(x, y);
        this._cvctx.rotate(rotate * Math.PI / 180);
        this._cvctx.globalAlpha = color[3];
        this._cvctx.drawImage(this.#apply_color_at_image(this._holdcv, color), -head, -height / 2);
        this._cvctx.restore();
    }

    #getTextureSize(type, width, height) {
        const key = this.#get_note_key(type);
        const texture = this._note_texture_map.get(key);
        this.#set_f64(width, texture.image.width);
        this.#set_f64(height, texture.image.height);
    }

    #getScreenSize(width, height) {
        this.#set_f64(width, this._canvas.width);
        this.#set_f64(height, this._canvas.height);
    }

    #playClicksound(type) {
        const key = this.#get_note_key(type);
        const clip = this._hitsound_map.get(key);
        if (!clip) {
            return;
        }
        try {
            const source = this._audioCtx.createBufferSource();
            source.buffer = clip;
            // drag 音效原始音量极低（-25.7dB），需要增益放大到与 hit（-13.7dB）相当
            if (key.includes("drag")) {
                // 确保音频上下文已恢复
                if (this._audioCtx.state === 'suspended') {
                    this._audioCtx.resume().then(() => {
                    }).catch(e => {
                    });
                }
                const gainNode = this._audioCtx.createGain();
                // 计算: 目标补偿 12dB (-25.7dB → -13.7dB), 增益倍数 = 10^(12/20) ≈ 3.98
                // 原值 3.5 ≈ +10.9dB 补偿，可能仍偏小；调整为 4.5 ≈ +13.1dB 补偿
                gainNode.gain.value = 4.5; // ≈ +13.1dB 补偿
                source.connect(gainNode);
                gainNode.connect(this._audioCtx.destination);
            } else {
                source.connect(this._audioCtx.destination);
            }
            source.start(0);
        } catch (e) {
            console.error(`[Hitsound] ❌ 播放失败: key=${key}, error=${e.message}`);
        }
    }

    #getDuration(duration) {
        this.#set_f64(duration, this._audioClip.duration);
    }

    #drawPauseBtn(x, y, width, height, alpha) {
        this._cvctx.save();
        this._cvctx.globalAlpha = alpha;
        this._cvctx.drawImage(this._pauseBtnImage, x, y, width, height);
        this._cvctx.restore();
    }

    #drawProgressBar(p, alpha) {
        const grd = this._cvctx.createLinearGradient(0, 0, this._canvas.width * p, 0);
        const n = 30;
        for (let i = 0; i < n; i++) {
            const p = i / (n - 1);
            const a = Math.pow(p, 2.2);
            grd.addColorStop(p, `rgba(255, 255, 255, ${a})`);
        }

        this._cvctx.save();
        this._cvctx.globalAlpha = alpha;
        this._cvctx.fillStyle = grd;
        this._cvctx.fillRect(0, 0, this._canvas.width * p, this._canvas.height * 9 / 1080);
        this._cvctx.restore();
    }

    #drawText(data, size, x, y, fontsize, bold, align, baseline, color) {
        const string = this.#read_string_with_size(data, parseInt(size));
        
        // 截获结算画面的文本数据
        if (this._completionMode) {
            const text = string.trim();
            if (text.length > 0 && text.length < 100) {
                this._completionTexts.push({ text, x, y, fontsize });
            }
        }
        
        color = this.#parse_color(color);
        this._cvctx.save();
        this._cvctx.font = `${fontsize}px ${this._fontFam}`;
        this._cvctx.textAlign = this.#get_text_align(align);
        this._cvctx.textBaseline = this.#get_text_baseline(baseline);
        this._cvctx.fillStyle = `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`;
        this._cvctx.fillText(string, x, y);
        this._cvctx.restore();
    }

    #loadStoryboardTexture(data, size, texIdP, width, height) {
        const key = this.#read_string_with_size(data, parseInt(size));
        const image = this._storyboardTextureLoader(key);
        const texId = this._texIdBase++;
        this.#set_u64(texIdP, texId);

        if (image) {
            this.#set_u64(width, image.width);
            this.#set_u64(height, image.height);
            this._storyboardTextureMap.set(texId, image);
        }
    }

    #drawStoryboardText(data, size, x, y, sx, sy, rotate, fontsize, color) {
        const s = this.#read_string_with_size(data, parseInt(size));
        color = this.#parse_color(color);
        
        this._cvctx.save();
        this._cvctx.translate(x, y);
        this._cvctx.rotate(rotate * Math.PI / 180);
        this._cvctx.scale(sx, sy);
        this._cvctx.font = `${fontsize}px ${this._fontFam}`;
        this._cvctx.textAlign = "center";
        this._cvctx.textBaseline = "middle";
        this._cvctx.fillStyle = `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`;
        this._cvctx.fillText(s, 0, 0);
        this._cvctx.restore();
    }

    #drawStoryboardPicture(texId, x, y, width, height, sx, sy, rotate, color) {
        if (!this._storyboardTextureMap.has(texId)) return;

        color = this.#parse_color(color);
        this._cvctx.save();
        this._cvctx.translate(x, y);
        this._cvctx.rotate(rotate * Math.PI / 180);
        this._cvctx.scale(sx, sy);
        this._cvctx.globalAlpha = color[3];
        this._cvctx.drawImage(this.#apply_color_at_image(this._storyboardTextureMap.get(texId), color), -width / 2, -height / 2, width, height);
        this._cvctx.restore();
    }

    #releaseStoryboardTexture(texId) {
        if (!this._storyboardTextureMap.has(texId)) return;
        this._storyboardTextureMap.delete(texId);
    }

    #createClickEffectTexture(groupId, p, perfectColor, goodColor, texIdP) {
        const rand = this._rand.rand(groupId);
        const texId = this._texIdBase++;
        this.#set_u64(texIdP, texId);

        const ptex = this.#create_click_effect_texture_item(rand, p, perfectColor);
        const gtex = this.#create_click_effect_texture_item(rand, p, goodColor);

        this._clickEffectMap.set(texId, [ptex, gtex]);
    }

    #drawClickEffectTexture(texId, isPerfect, x, y, size, rotate) {
        const pair = this._clickEffectMap.get(parseInt(texId));
        const tex = isPerfect ? pair[0] : pair[1];
        
        this._cvctx.save();
        this._cvctx.translate(x, y);
        this._cvctx.rotate(rotate * Math.PI / 180);
        this._cvctx.drawImage(tex, -size / 2, -size / 2, size, size);
        this._cvctx.restore();
    }

    #releaseClickEffectTexture(texId) {
        this._clickEffectMap.delete(texId);
    }

    #drawEllipse(x, y, rx, ry, rotate, color) {
        color = this.#parse_color(color);
        this._cvctx.save();
        this._cvctx.translate(x, y);
        this._cvctx.rotate(rotate);
        this._cvctx.fillStyle = `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`;
        this._cvctx.beginPath();
        this._cvctx.ellipse(0, 0, rx, ry, 0, 0, 2 * Math.PI);
        this._cvctx.fill();
        this._cvctx.restore();
    }

    #getResourcePackNoteScale(type, scale) {
        const key = this.#get_note_key(type);
        const texture = this._note_texture_map.get(key);
        this.#set_f64(scale, texture.scale);
    }

    #getResourcePackLineHeadScale(scale) {
        this.#set_f64(scale, this._line_head_texture.scale);
    }

    #getResourcePackLineHeadConnectPoint(point) {
        this.#set_f64(point, this._line_head_texture.connect_point / (this._line_head_texture.image.height / 2));
    }

    #drawRect(x, y, width, height, color) {
        color = this.#parse_color(color);
        this._cvctx.save();
        this._cvctx.fillStyle = `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})`;
        this._cvctx.fillRect(x, y, width, height);
        this._cvctx.restore();
    }

    #drawCompletionStatus(data, size, grd_progress, grd_reds, grd_greens, grd_blues, grd_step_count, scale) {
        // 标记进入结算模式，后续 drawText 调用会被截获
        this._completionMode = true;
        this._completionTexts = [];
        
        data = Number(data);
        size = Number(size);
        grd_progress = Number(grd_progress);
        grd_reds = Number(grd_reds);
        grd_greens = Number(grd_greens);
        grd_blues = Number(grd_blues);
        grd_step_count = Number(grd_step_count);
        scale = Number(scale);
        
        const heap = this._instance.HEAPU8;
        const heap32 = new Int32Array(heap.buffer);
        
        // 解析 data 指针（已知是字符串，如 "CRASH"）
        const rawStatus = (data && size > 0) ? new TextDecoder().decode(heap.slice(data, data + size)) : null;
        
        // 读取 Vec 元素数量（不读取元素内容，仅计数）
        // Vec struct layout: +16=elemSize, +20=elemCount, +24=dataPtr, +28=endPtr
        const readVecCount = (ptr) => {
            const elemSize = heap32[(ptr >> 2) + 4];
            const elemCount = heap32[(ptr >> 2) + 5];
            return { elemSize, elemCount };
        };
        
        const vProgress = readVecCount(grd_progress);
        const vReds = readVecCount(grd_reds);
        const vGreens = readVecCount(grd_greens);
        const vBlues = readVecCount(grd_blues);
        
        
        const stats = {
            raw: rawStatus,
            grd_step_count,
            scale,
            progress_count: vProgress.elemCount,
            reds_count: vReds.elemCount,
            greens_count: vGreens.elemCount,
            blues_count: vBlues.elemCount,
        };
        
        this._completionStats = stats;
        if (window.state) {
            window.state.completionStats = stats;
        }
        // 延迟触发事件，让 WASM 在后续 render 帧中通过 drawText 传递分数等数据
        // 收集完毕后再关闭结算模式并更新 stats
        setTimeout(() => {
            this._completionMode = false;
            // 从截获的文本中提取数据
            if (this._completionTexts && this._completionTexts.length > 0) {
                stats.texts = this._completionTexts.map(t => t.text);
                stats._textsFull = this._completionTexts.map(t => ({ text: t.text, x: t.x, y: t.y, fontsize: t.fontsize }));
                this.#parseCompletionTexts(stats);
            }
            this._completionStats = stats;
            if (window.state) {
                window.state.completionStats = stats;
            }
            const event = new CustomEvent('completionStats', { detail: stats });
            this._canvas.dispatchEvent(event);
        }, 500);
    }

    #parseCompletionTexts(stats) {
        const texts = stats._textsFull || [];
        let numericValues = [];
        for (const item of texts) {
            const text = item.text;
            // 提取百分号数据（准确率）
            const pctMatch = text.match(/^([\d.]+)%$/);
            if (pctMatch) {
                stats._accuracyFromText = parseFloat(pctMatch[1]);
                continue;
            }
            // 尝试解析为数值（包括带前导零的分数文本如 "0950666"）
            const cleaned = text.replace(/,/g, '');
            const num = parseInt(cleaned);
            if (!isNaN(num) && num > 0) {
                numericValues.push({ value: num, text, x: item.x, y: item.y, fontsize: item.fontsize });
            }
        }
        // 分数是最大的纯数值（通常在 100000-2000000 范围）
        if (numericValues.length > 0) {
            const maxEntry = numericValues.reduce((a, b) => a.value > b.value ? a : b);
            if (maxEntry.value >= 10000 && maxEntry.value <= 2000000) {
                stats.score = maxEntry.value;
            } else if (stats.raw === 'CRASH') {
                // CRASH 状态时，即使分数显示为0，也设置 score=0
                stats.score = 0;
            }
        } else if (stats.raw === 'CRASH') {
            // 没有数值文本，但状态是 CRASH，设置默认值
            stats.score = 0;
        }
        // COMBO 是最大纯数值文本和准确率之间的那个数值
        // 排除最大值（分数）后，剩余纯数值中最大的就是 COMBO
        if (numericValues.length > 1) {
            const sorted = [...numericValues].sort((a, b) => b.value - a.value);
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].value < 10000) { // COMBO 通常小于 10000
                    stats._maxCombo = sorted[i].value;
                    break;
                }
            }
        } else if (stats.raw === 'CRASH') {
            // CRASH 状态时，设置 _maxCombo 为0或基于 reds_count 的默认值
            stats._maxCombo = 0;
        }
        
        // 调整 maxCombo 使其不超过总物量（reds+greens+blues）
        const totalNotes = (stats.reds_count || 0) + (stats.greens_count || 0) + (stats.blues_count || 0);
        if (stats._maxCombo > totalNotes && totalNotes > 0) {
            stats._maxCombo = totalNotes;
        }
        // 从 score + accuracy + maxCombo 反推判定分布
        this.#estimateJudgeCounts(stats);
    }

    /**
     * 从已知 score/accuracy/maxCombo 反推判定分布
     * 使用 mil/score_search_engine.wasm 反向搜索引擎（DFS + 剪枝）
     *
     * 计分公式（与 WASM 完全一致）：
     *   final = floor(accScore × (0.4 + 0.6×comboMult)) + floor(comboBonus) + apBonus
     *   accScore = totalAcc(百万分制) / N
     *   comboMult = comboSum / (N × bMax)
     *   comboBonus = 5000 × maxCombo / N
     *   bMax = min(192, max(N*12/50, 1))
     */
    #estimateJudgeCounts(stats) {
        const score = stats.score;
        const acc = stats._accuracyFromText; // 如 99.12 表示 99.12%
        const maxCombo = stats._maxCombo;
        const rawStatus = (stats.raw || '').toUpperCase();
        
        // CRASH 状态特殊处理：即使分数为0，也尝试提供判定详情
        if (rawStatus === 'CRASH') {
            // 使用 reds_count/greens_count/blues_count 直接提供判定详情
            const totalPerfect = stats.reds_count || 0;
            const totalGood = stats.greens_count || 0;
            const totalMiss = stats.blues_count || 0;
            const totalNotes = totalPerfect + totalGood + totalMiss;
            if (totalNotes > 0) {
                // 假设 Perfect 中 70% 为大P，30% 为小P
                const perfectLarge = Math.floor(totalPerfect * 0.7);
                const perfectSmall = totalPerfect - perfectLarge;
                stats.judgeCounts = {
                    perfectLarge,
                    perfectSmall,
                    good: totalGood,
                    bad: 0,
                    miss: totalMiss,
                    _noteCount: totalNotes,
                    _calcScore: 0,
                    _calcAcc: '0%'
                };
            } else {
            }
            return; // CRASH 状态不需要进行 WASM 搜索
        }
        
        // 正常状态检查
        if (!score || acc === undefined || !maxCombo || maxCombo < 1) return;

        // ========== 优先使用 WASM 搜索引擎 ==========
        if (this._searchEngine) {
            const result = this.#searchJudgeViaWASM(score, acc, maxCombo, rawStatus);
            if (result) {
                stats.judgeCounts = result;
                return;
            }
        }

        // ========== 回退：暴力枚举（旧逻辑）==========
        this.#fallbackJudgeEstimate(score, acc, maxCombo, rawStatus, stats);
        
        // 如果以上方法均未产生结果，使用简单估算
        if (!stats.judgeCounts) {
            // 基于 reds_count/greens_count/blues_count 的简单估算
            const totalPerfect = stats.reds_count || 0;
            const totalGood = stats.greens_count || 0;
            const totalMiss = stats.blues_count || 0;
            const totalNotes = totalPerfect + totalGood + totalMiss;
            if (totalNotes > 0) {
                // 假设 Perfect 中 70% 为大P，30% 为小P
                const perfectLarge = Math.floor(totalPerfect * 0.7);
                const perfectSmall = totalPerfect - perfectLarge;
                stats.judgeCounts = {
                    perfectLarge,
                    perfectSmall,
                    good: totalGood,
                    bad: 0,
                    miss: totalMiss,
                    _noteCount: totalNotes,
                    _calcScore: stats.score || 0,
                    _calcAcc: (stats._accuracyFromText || 0) + '%'
                };
            } else {
            }
        }
    }

    /**
     * 使用 WASM 搜索引擎精确反推判定分布
     * 核心思路：对每个可能的物量 N，用 DFS 搜索找到能产生目标分数的序列
     */
    #searchJudgeViaWASM(score, acc, maxCombo, rawStatus) {
        const engine = this._searchEngine;
        const isFC = rawStatus.includes('FULL COMBO');
        const MAX_SEARCH_TIME_MS = 3000; // 最大搜索时间 3 秒

        // 确定物量范围
        // FC: noteCount = maxCombo + n (n 不中断combo)，n ∈ [0, ~30]
        // COMPLETE: noteCount = maxCombo + n + b + m
        const noteCountMin = maxCombo;
        const noteCountMax = isFC ? maxCombo + 40 : maxCombo + 60;

        let bestResult = null;

        const tStart = performance.now();
        for (let N = noteCountMin; N <= noteCountMax; N++) {
            if (performance.now() - tStart > MAX_SEARCH_TIME_MS) break;

            // 初始化搜索器
            let searcher;
            try {
                searcher = engine.createSearcher(N, score);
            } catch (err) {
                continue;
            }

            let stepCount = 0;
            const maxSteps = 100000; // 单个 N 的最大步数限制

            while (stepCount < maxSteps) {
                if (performance.now() - tStart > MAX_SEARCH_TIME_MS) break;

                const batch = Math.min(16000, maxSteps - stepCount);
                const stepResult = searcher.step(batch);
                stepCount += batch;

                if (stepResult.status === 1) {
                    // 找到一个产生目标分数的序列！验证约束
                    const seq = stepResult.result; // result 字段是序列字符串
                    const counts = this.#countSequence(seq);

                    // 验证 maxCombo 约束
                    if (counts.maxCombo !== maxCombo && !(isFC && counts.maxCombo > maxCombo)) continue;

                    // 验证准确率约束（acc 截断到 2 位小数，允许 ±0.01 误差）
                    const calcAcc = (counts.totalAcc / N * 100).toFixed(2);
                    if (Math.abs(parseFloat(calcAcc) - acc) > 0.5) continue; // 准确率偏差太大

                    // 验证 FC/COMPLETE 约束
                    if (isFC && (counts.b > 0 || counts.m > 0)) continue; // FC 不应有 b/m


                    const judgeData = {
                        perfectLarge: counts.e,
                        perfectSmall: counts.p,
                        good: counts.g,
                        bad: counts.n,
                        miss: counts.m,
                        _noteCount: N,
                        _calcScore: score,
                        _calcAcc: calcAcc + '%'
                    };

                    // 选准确率最接近的
                    if (!bestResult || Math.abs(parseFloat(counts.calcAcc) - acc) < Math.abs(parseFloat(bestResult._calcAcc) - acc)) {
                        bestResult = judgeData;
                    }

                    // 精准匹配，直接返回
                    if (parseFloat(calcAcc) === acc && counts.maxCombo === maxCombo) {
                        return bestResult;
                    }
                }

                if (stepResult.done) break;
            }
        }

        return bestResult;
    }

    /**
     * 统计判定序列中各判定的数量
     */
    #countSequence(seq) {
        const counts = { e: 0, p: 0, g: 0, n: 0, b: 0, m: 0 };
        const scoreMap = { e: 1000000, p: 990000, g: 600000, n: 300000, b: 150000, m: 0 };
        let totalAcc = 0;
        let maxCombo = 0, currentCombo = 0;

        for (const c of seq) {
            counts[c] = (counts[c] || 0) + 1;
            totalAcc += scoreMap[c] || 0;

            if (c !== 'b' && c !== 'm') {
                currentCombo++;
                if (currentCombo > maxCombo) maxCombo = currentCombo;
            } else {
                currentCombo = 0;
            }
        }

        return { ...counts, totalAcc, maxCombo, calcAcc: (totalAcc / seq.length).toFixed(6) };
    }

    /**
     * 回退反推模式（旧逻辑，当 WASM 搜索不可用时使用）
     */
    #fallbackJudgeEstimate(score, acc, maxCombo, rawStatus, stats) {
        let maxMiss = 100;
        if (rawStatus.includes('FULL COMBO') || rawStatus.includes('ALL PERFECT')) {
            maxMiss = 0;
        } else if (rawStatus.includes('COMPLETE')) {
            maxMiss = Math.min(maxMiss, 50);
        }

        let bestResult = null;

        for (let missCount = 0; missCount <= maxMiss; missCount++) {
            const maxPossibleNoteCount = maxCombo + missCount;
            const maxPossibleAcc = 100 * maxCombo / maxPossibleNoteCount;
            const minPossibleAcc = 60 * maxCombo / maxPossibleNoteCount;
            if (acc > maxPossibleAcc + 0.01) break;
            if (acc < minPossibleAcc - 0.01) continue;

            for (let bCount = 0; bCount <= Math.min(missCount, 10); bCount++) {
                const mCount = missCount - bCount;
                const maxNCount = Math.min(30, maxCombo);
                for (let nCount = 0; nCount <= maxNCount; nCount++) {
                    const comboAccCount = maxCombo - nCount;
                    const noteCount = maxCombo + nCount + bCount + mCount;

                    const maxAccHere = (100 * comboAccCount + 30 * nCount + 15 * bCount) / noteCount;
                    if (acc > maxAccHere + 0.01) break;
                    const minAccHere = (60 * comboAccCount + 30 * nCount + 15 * bCount) / noteCount;
                    if (acc < minAccHere - 0.01) continue;

                    const accScoreLow = Math.floor(acc * noteCount);
                    const accScoreHigh = Math.ceil(acc * noteCount + 0.005);

                    for (const accScore of [accScoreLow, accScoreHigh]) {
                        const comboAccScore = accScore - 30 * nCount - 15 * bCount;
                        if (comboAccScore < 0) continue;
                        const comboBase = 99 * comboAccCount;
                        const diff = comboAccScore - comboBase;

                        let gMin, gMax;
                        if (diff >= 0) { gMin = 0; gMax = Math.min(Math.ceil(comboAccCount / 2), comboAccCount); }
                        else { gMin = Math.max(0, Math.ceil(-diff / 39)); gMax = Math.min(Math.ceil(-diff / 39) + 2, comboAccCount); }

                        for (let g = gMin; g <= gMax; g++) {
                            const e = diff + 39 * g;
                            if (e < -2 || e > comboAccCount - g + 2) continue;
                            const p = comboAccCount - e - g;
                            if (p < 0) continue;

                            const calcScore = this.#calculateWasmScore(
                                { perfectLarge: e, perfectSmall: p, good: g, bad: nCount, miss: mCount, bMiss: bCount },
                                noteCount
                            );
                            if (calcScore === score) {
                                const totalAccScore = 100 * e + 99 * p + 60 * g + 30 * nCount + 15 * bCount;
                                const calcAcc = totalAccScore / noteCount;
                                if (!bestResult || bestResult._calcAcc < calcAcc) {
                                    bestResult = { perfectLarge: e, perfectSmall: p, good: g, bad: nCount + bCount, miss: mCount, _noteCount: noteCount, _calcScore: calcScore, _calcAcc: calcAcc.toFixed(2) + '%' };
                                }
                            }
                        }
                    }
                }
            }
            if (bestResult) break;
        }

        if (bestResult) {
            stats.judgeCounts = bestResult;
        }
    }

    /**
     * WASM 内置计分公式（从二进制逆向提取的完整实现）
     */
    #calculateWasmScore(judges, noteCount) {
        const input = 'e'.repeat(judges.perfectLarge || 0)
            + 'p'.repeat(judges.perfectSmall || 0)
            + 'g'.repeat(judges.good || 0)
            + 'n'.repeat(judges.bad || 0)
            + 'b'.repeat(judges.miss || 0);

        if (!input.length) return 0;
        const raw_input_length = input.length;
        let fullInput = input;
        fullInput += 'm'.repeat(Math.max(0, noteCount - input.length));
        const N = fullInput.length;
        const bMax = Math.min(192, Math.max(Math.floor(N * 12 / 50), 1));
        const params = {
            e: { a: 2, b: bMax },
            p: { a: 1, b: bMax },
            g: { a: 0, b: Math.min(128, Math.max(Math.floor(N * 8 / 50), 1)) },
            n: { a: 0, b: Math.min(96, Math.max(Math.floor(N * 6 / 50), 1)) },
            b: { a: 0, b: Math.min(64, Math.max(Math.floor(N * 4 / 50), 1)) },
            m: { a: 0, b: Math.min(64, Math.max(Math.floor(N * 4 / 50), 1)) }
        };
        const scoreMap = { e: 100, p: 99, g: 60, n: 30, b: 15, m: 0 };
        let totalAccScore = 0, totalComboScore = 0, maxCombo = 0, currentCombo = 0;
        let currentComboScore = bMax;

        for (let i = 0; i < N; i++) {
            const judge = fullInput[i];
            totalAccScore += scoreMap[judge];
            if (judge !== 'b' && judge !== 'm') currentCombo++;
            maxCombo = Math.max(maxCombo, currentCombo);
            const { a, b } = params[judge];
            currentComboScore = Math.max(Math.min(currentComboScore + a, b), 0);
            totalComboScore += currentComboScore;
        }
        if (currentComboScore < bMax) {
            totalComboScore = Math.max(totalComboScore + (1 - (bMax - currentComboScore - 1) ** 2) / 4, 0);
        }
        const apBonus = /^[ep]+$/i.test(fullInput) ? 5000 : 0;
        const accScore = totalAccScore * 10000 / N;
        const comboMult = totalComboScore / N / bMax;
        const comboBonus = 5000 * maxCombo / N;
        const finalScore = Math.floor(accScore * (0.4 + 0.6 * comboMult)) + Math.floor(comboBonus) + apBonus;
        return finalScore;
    }

    start(t = 0) {
        if (this._currentAudioSource) {
            this._currentAudioSource.onended = null;
            this._currentAudioSource.disconnect();
        }

        this._currentAudioSource = this.#create_audio_buffer_source(this._audioClip);
        this._currentAudioSource.start(0, t);
        this._currentAudioSource.start_time = this._audioCtx.currentTime - t;
        this._currentAudioSource.onended = () => {
            this._currentAudioSource.disconnect();
            this._currentAudioSource = null;
            this._audioTime = 0;
        };
        this._audioTime = t;
    }

    pause() {
        if (!this._currentAudioSource) {
            return;
        }

        if (this._currentAudioSource.paused) {
            this.start(this.currentTime);
        } else {
            this._currentAudioSource.stop();
            this._audioTime = this._audioCtx.currentTime - this._currentAudioSource.start_time;
        }
    }

    seek(t) {
        if (!this._currentAudioSource) {
            return;
        }

        this._currentAudioSource.stop();
        this.start(t);
    }

    stop() {
        if (!this._currentAudioSource) {
            return;
        }

        this._currentAudioSource.stop();
    }

    get_chart_time() {
        return this._audioCtx.currentTime - this._currentAudioSource.start_time;
    }

    render() {
        if (!this._currentAudioSource) {
            return;
        }

        this._audioTime = this.get_chart_time();
        this._cvctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        this.#call_wasm("h5bind_render", this._ctx, this._audioTime);
    }
};

class MilImgDecoder {
    constructor(options) {
        options = options || {};

        if (!options.buildDirectory) {
            throw new Error("No buildDirectory specified");
        }

        this._buildDirectory = options.buildDirectory;
    }

    async init() {
        const module = await import(_solve_wasm_path(this._buildDirectory));
        this._instance = await module.default();
    }

    #call_wasm(func, ...args) {
        return this._instance["_" + func](...args);
    }

    #read_u32(ptr) {
        return new DataView(this._instance.HEAPU8.buffer, ptr, 4).getUint32(0, true);
    }

    #read_u64(ptr) {
        return new DataView(this._instance.HEAPU8.buffer, ptr, 8).getBigUint64(0, true);
    }

    async load(milimg) {
        milimg = await _normToUint8Array(milimg);

        const dataPtr = this.#call_wasm("malloc", milimg.byteLength);
        new Uint8Array(this._instance.HEAPU8.buffer, dataPtr, milimg.byteLength).set(milimg);

        const ptr = this.#call_wasm("h5bind_load_milimg", dataPtr, BigInt(milimg.byteLength));
        this.#call_wasm("free", dataPtr);

        return ptr;
    }

    get_info(ptr) {
        const info_size = 4 * 3;
        const info_ptr = this.#call_wasm("malloc", info_size);
        this.#call_wasm(
            "h5bind_get_milimg_info",
            ptr,
            info_ptr,
            info_ptr + 4,
            info_ptr + 8
        );

        const version = this.#read_u32(info_ptr);
        const width = this.#read_u32(info_ptr + 4);
        const height = this.#read_u32(info_ptr + 8);

        this.#call_wasm("free", info_ptr);

        return { version, width, height };
    }

    decode(ptr) {
        const info_size = 8 * 3;
        const info_ptr = this.#call_wasm("malloc", info_size);
        const decoded_ptr = this.#call_wasm(
            "h5bind_decode_milimg",
            ptr,
            info_ptr,
            info_ptr + 8,
            info_ptr + 16
        );

        const width = parseInt(this.#read_u64(info_ptr));
        const height = parseInt(this.#read_u64(info_ptr + 8));
        const size = parseInt(this.#read_u64(info_ptr + 16));

        const data = new Uint8Array(this._instance.HEAPU8.buffer, decoded_ptr, size).slice();

        this.#call_wasm("free", decoded_ptr);
        this.#call_wasm("free", info_ptr);

        return { width, height, data };
    }

    free(ptr) {
        this.#call_wasm("h5bind_release_milimg", ptr);
    }
};

export default {
    MilLunePlayer,
    MilImgDecoder
};
