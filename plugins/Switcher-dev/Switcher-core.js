(async () => {
    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const PLUGIN_ID = 'theme-switcher';
    
    const CONFIG = {
        dirs: {
            themes: '/custom/assets/themes/',
            coloris: '/custom/coloris/',
            snippets: '/custom/assets/snippets/'
        },
        files: {
            colorisCss: '/custom/coloris/coloris.min.css',
            colorisJs: '/custom/coloris/coloris.min.js',
            snippetsJson: '/custom/assets/snippets/snippets.json',
            themesJson: '/custom/assets/themes/themes.json',
            colorSchemesJson: '/custom/assets/themes/color-schemes.json'
        },
        editableVars: [
            { name: "--body", label: "Page Background" },
            { name: "--card", label: "Card Background" },
            { name: "--nav", label: "Navbar" },
            { name: "--nav-grey", label: "Navbar Grey" },
            { name: "--nav-grey-dark", label: "Navbar Grey (Dark)" },
            { name: "--tags", label: "Tags/Text Grey" },
            { name: "--accent", label: "Accent Color" },
            { name: "--accent-transparent", label: "Accent Transparent" },
            { name: "--red", label: "Error Red" },
            { name: "--bright-red", label: "Bright Red" }
        ]
    };

    // =========================================================================
    // STORAGE ABSTRACTION LAYER
    // =========================================================================

    class StorageManager {
        constructor() {
            this.config = null;
            this.pendingSave = null;
            this.saveDelay = 500;
        }

        async initialize() {
            if (window.csLib) {
                try {
                    this.config = await csLib.getConfiguration(PLUGIN_ID, {});
                    console.log('[Switcher] Loaded config from GraphQL:', this.config);
                    return true;
                } catch (err) {
                    console.error('[Switcher] Failed to load GraphQL config:', err);
                    this.config = {};
                }
            } else {
                this.config = {};
            }
            return false;
        }

        async get(key) {
            return this.config[key] || null;
        }

        async set(key, value) {
            this.config[key] = value;
            this.scheduleSave();
        }

        async remove(key) {
            delete this.config[key];
            this.scheduleSave();
        }

        async batchSet(updates) {
            Object.assign(this.config, updates);
            this.scheduleSave();
        }

        async batchRemove(keys) {
            keys.forEach(key => delete this.config[key]);
            this.scheduleSave();
        }

        scheduleSave() {
            if (this.pendingSave) {
                clearTimeout(this.pendingSave);
            }
            
            this.pendingSave = setTimeout(async () => {
                try {
                    await csLib.setConfiguration(PLUGIN_ID, this.config);
                    console.log('[Switcher] Config saved to GraphQL');
                } catch (err) {
                    console.error('[Switcher] Failed to save config:', err);
                }
                this.pendingSave = null;
            }, this.saveDelay);
        }

        // Force immediate save (for important operations)    
        async forceSave() {
            if (this.pendingSave) {
                clearTimeout(this.pendingSave);
                this.pendingSave = null;
            }
            
            if (this.config !== null) {
                try {
                    await csLib.setConfiguration(PLUGIN_ID, this.config);
                    console.log('[Switcher] Config force-saved to GraphQL');
                } catch (err) {
                    console.error('[Switcher] Failed to force-save config:', err);
                }
            }
        }

        async getKeysMatching(pattern) {
            return Object.keys(this.config).filter(key => key.includes(pattern));
        }
    }

    const storage = new StorageManager();

    // =========================================================================
    // STATE MANAGER
    // =========================================================================

    class StateManager {
        constructor() {
            this.themes = [];
            this.colorSchemes = {};
            this.snippets = [];
            this._currentTheme = null;
            this._currentScheme = null;
            this.dropdownOpen = false;
            this.suppressSave = false;
            this.saveTimeout = null;
            this.cachedElements = new Map();
            this.snippetUpdateTimeouts = new Map();
            
            this.listeners = new Map();
        }
        
        subscribe(key, callback) {
            if (!this.listeners.has(key)) {
                this.listeners.set(key, []);
            }
            this.listeners.get(key).push(callback);
        }

        notify(key, value) {
            if (this.listeners.has(key)) {
                this.listeners.get(key).forEach(callback => {
                    try {
                        callback(value);
                    } catch (error) {
                        console.error(`[Switcher] Error in listener for ${key}:`, error);
                    }
                });
            }
        }

        get currentTheme() {
            return this._currentTheme;
        }
        set currentTheme(value) {
            if (this._currentTheme !== value) {
                this._currentTheme = value;
                this.notify('currentTheme', value);
            }
        }

        get currentScheme() {
            return this._currentScheme;
        }
        set currentScheme(value) {
            if (this._currentScheme !== value) {
                this._currentScheme = value;
                this.notify('currentScheme', value);
            }
        }
        
        getKey(type, ...args) {
            const keyMap = {
                cssVar: (theme, scheme, varName) => `cssvar-${theme}-${scheme}-${varName}`,
                snippetEnabled: (theme, scheme, name) => `snippet-enabled-${theme}-${scheme}-${name}`,
                snippetScopes: (theme, scheme, name) => `snippet-scopes-${theme}-${scheme}-${name}`,
                snippetVar: (theme, scheme, snippet, varName) => `snippet-var-${theme}-${scheme}-${snippet}-${varName}`,
                theme: () => 'theme-switcher-active',
                colorScheme: () => 'theme-switcher-color-scheme'
            };
            return keyMap[type]?.(...args) || '';
        }

        getElement(id, selector) {
            if (!this.cachedElements.has(id)) {
                this.cachedElements.set(id, document.querySelector(selector));
            }
            return this.cachedElements.get(id);
        }

        clearElementCache() {
            this.cachedElements.clear();
        }

        get(key) {
            return storage.config[key] || null;
        }

        async set(key, value) {
            return storage.set(key, value);
        }

        async remove(key) {
            return storage.remove(key);
        }

        getThemeVar(varName) {
            if (!this.currentTheme || !this.currentScheme) return null;
            return this.get(this.getKey('cssVar', this.currentTheme, this.currentScheme, varName));
        }

        async setThemeVar(varName, value) {
            if (!this.currentTheme || !this.currentScheme) return;
            await this.set(this.getKey('cssVar', this.currentTheme, this.currentScheme, varName), value);
        }

        async removeThemeVar(varName) {
            if (!this.currentTheme || !this.currentScheme) return;
            await this.remove(this.getKey('cssVar', this.currentTheme, this.currentScheme, varName));
        }

        getAvailableSchemes() {
            const theme = this.themes.find(t => t.name === this.currentTheme);
            return theme?.schemes || [];
        }

        getTheme(name) {
            return this.themes.find(t => t.name === name);
        }
    }

    const state = new StateManager();

    // =========================================================================
    // CSS VARIABLE MANAGER
    // =========================================================================

    class CSSVariableManager {
        static setVar(name, value) {
            document.documentElement.style.setProperty(name, value);
        }

        static removeVar(name) {
            document.documentElement.style.removeProperty(name);
        }

        static getComputedVar(name) {
            return getComputedStyle(document.documentElement)
                .getPropertyValue(name)
                .trim();
        }

        static resolveValue(varName) {
            const saved = state.getThemeVar(varName);
            if (saved) return saved;

            if (state.currentTheme && state.currentScheme) {
                const schemeValue = state.colorSchemes[state.currentTheme]?.[state.currentScheme]?.[varName];
                if (schemeValue) return schemeValue;
            }

            const computed = this.getComputedVar(varName);
            return computed || "";
        }

        static loadAllThemeVars() {
            // First, load ALL variables from the color scheme (including non-editable ones)
            if (state.currentTheme && state.currentScheme) {
                const schemeVars = state.colorSchemes[state.currentTheme]?.[state.currentScheme];
                if (schemeVars) {
                    Object.entries(schemeVars).forEach(([varName, value]) => {
                        // Only apply if there's no user customization for editable vars
                        const isEditable = CONFIG.editableVars.some(v => v.name === varName);
                        if (!isEditable) {
                            // Non-editable: always apply from scheme
                            this.setVar(varName, value);
                        } else {
                            // Editable: use resolveValue to check for user customization
                            const resolvedValue = this.resolveValue(varName);
                            if (resolvedValue) {
                                this.setVar(varName, resolvedValue);
                            }
                        }
                    });
                }
            }
            
            // Then load editable vars (in case they're not in the color scheme)
            for (const v of CONFIG.editableVars) {
                const value = this.resolveValue(v.name);
                if (value) this.setVar(v.name, value);
            }
        }

        static clearAllThemeVars() {
            // Clear editable vars
            CONFIG.editableVars.forEach(v => this.removeVar(v.name));
            
            // Clear any color scheme vars that were set
            if (state.currentTheme && state.currentScheme) {
                const schemeVars = state.colorSchemes[state.currentTheme]?.[state.currentScheme];
                if (schemeVars) {
                    Object.keys(schemeVars).forEach(varName => {
                        this.removeVar(varName);
                    });
                }
            }
        }
    }

    // =========================================================================
    // COLORIS MANAGER
    // =========================================================================

    class ColorisManager {
        static async loadAssets() {
            if (window.Coloris) return;

            return new Promise((resolve, reject) => {
                const css = document.createElement("link");
                css.rel = "stylesheet";
                css.href = CONFIG.files.colorisCss;
                css.onerror = reject;

                css.onload = () => {
                    const js = document.createElement("script");
                    js.src = CONFIG.files.colorisJs;
                    js.onerror = reject;
                    js.onload = resolve;
                    document.head.appendChild(js);
                };

                document.head.appendChild(css);
            });
        }

        static updateInput(input, value) {
            if (!input) return;

            input.value = value;
            input.style.background = value;

            if (window.Coloris?.set) {
                Coloris.set(input, value);
            }

            const swatch = input.parentElement.querySelector('.clr-picker');
            if (swatch) swatch.style.background = value;
        }

        static resetInput(input, value = "") {
            if (!input) return;

            const varName = input.dataset.varName;
            
            if (window.Coloris?.close) {
                Coloris.close();
            }

            const field = input.closest(".clr-field");
            if (field) {
                const parent = field.parentNode;
                parent.insertBefore(input, field);
                field.remove();
            }

            input.style.cssText = '';
            input.value = value;
            input.dataset.varName = varName;
            
            if (value) {
                input.style.background = value;
            } else {
                input.style.background = "transparent";
            }

            if (window.Coloris) {
                Coloris({ el: input });
                
                requestAnimationFrame(() => {
                    const field = input.closest('.clr-field');
                    if (field) {
                        const swatch = field.querySelector('.clr-picker');
                        if (swatch && value) {
                            swatch.style.background = value;
                        }
                    }
                });
            }
        }

        static markModified(input, isModified) {
            if (!input) return;
            
            // Find parent row using BEM class
            const row = input.closest(".theme-switcher__color-row");
            
            if (row) {
                row.setAttribute('data-modified', isModified.toString());
            }
        }

        static async initialize() {
            await this.loadAssets();
            
            if (window.Coloris) {
                Coloris({
                    el: ".theme-switcher__color-input",
                    theme: "polaroid",
                    themeMode: "dark",
                    formatToggle: true,
                    alpha: false,
                    swatches: [
                        "#1a1a1a", "#242424", "#2e2e2e", "#383838",
                        "#4a4a4a", "#5c5c5c", "#6e6e6e", "#808080",
                        "#007bff", "#28a745", "#dc3545", "#ffc107",
                        "#17a2b8", "#6f42c1", "#e83e8c", "#fd7e14"
                    ]
                });
            }
        }

        static initializeAll() {
            document.querySelectorAll('.theme-switcher__color-input').forEach(input => {
                const value = CSSVariableManager.resolveValue(input.dataset.varName);
                this.updateInput(input, value);
                this.markModified(input, !!state.getThemeVar(input.dataset.varName));
            });
        }
    }

    // =========================================================================
    // DATA LOADER
    // =========================================================================

    class DataLoader {
        static async fetchJSON(url) {
            try {
                console.log(`[Switcher] Fetching ${url}`);
                const response = await fetch(url);
                if (!response.ok) {
                    console.error(`[Switcher] HTTP ${response.status} for ${url}`);
                    throw new Error(`HTTP ${response.status}`);
                }
                const data = await response.json();
                console.log(`[Switcher] Successfully loaded ${url}`, data);
                return data;
            } catch (err) {
                console.error(`[Switcher] Failed to fetch ${url}:`, err);
                return null;
            }
        }

        static async fetchThemes() {
            const data = await this.fetchJSON(CONFIG.files.themesJson);
            if (!data) {
                console.error('[Switcher] Failed to load themes.json');
                return;
            }
            
            if (Array.isArray(data)) {
                state.themes = data;
            } else if (data.themes && Array.isArray(data.themes)) {
                state.themes = data.themes;
            } else {
                console.error('[Switcher] Invalid themes.json format:', data);
                return;
            }
            
            console.log('[Switcher] Loaded themes:', state.themes);
        }

        static async fetchColorSchemes() {
            const data = await this.fetchJSON(CONFIG.files.colorSchemesJson);
            if (data) {
                state.colorSchemes = data;
                console.log('[Switcher] Loaded color schemes for themes:', Object.keys(data));
            } else {
                console.error('[Switcher] No color schemes found');
            }
        }

        static async fetchSnippets() {
            const data = await this.fetchJSON(CONFIG.files.snippetsJson);
            if (!data) {
                console.warn('[Switcher] No snippets.json found (this is okay if you dont use snippets)');
                return;
            }
            
            if (Array.isArray(data)) {
                state.snippets = data;
            } else if (data.snippets && Array.isArray(data.snippets)) {
                state.snippets = data.snippets;
            } else {
                console.warn('[Switcher] Invalid snippets.json format (this is okay if you dont use snippets)');
                return;
            }
            
            console.log('[Switcher] Loaded snippets:', state.snippets.length);
        }
    }

    // =========================================================================
    // THEME MANAGER
    // =========================================================================

    class ThemeManager {
        static async apply(themeName, schemeName = null) {
            if (!themeName || themeName === "no-theme") {
                return this.applyNoTheme();
            }

            const theme = state.getTheme(themeName);
            if (!theme) {
                console.error(`[Switcher] Theme not found: ${themeName}`);
                return;
            }

            if (!schemeName || !theme.schemes.includes(schemeName)) {
                schemeName = theme.schemes[0];
            }

            console.log(`[Switcher] Applying theme: ${themeName} (${schemeName})`);

            await state.set(state.getKey('theme'), themeName);
            await state.set(state.getKey('colorScheme'), schemeName);

            await this.loadThemeCSS(theme.file);

            state.currentTheme = themeName;
            
            CSSVariableManager.loadAllThemeVars();
            SnippetManager.loadAll();

            state.currentScheme = schemeName;

            console.log('[Switcher] Theme applied successfully');
        }

        static async loadThemeCSS(filename) {
            return new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = `${CONFIG.dirs.themes}${filename}`;
                
                link.onload = () => {
                    const oldLink = document.getElementById('theme-switcher-css');
                    if (oldLink) oldLink.remove();
                    
                    link.id = 'theme-switcher-css';
                    
                    requestAnimationFrame(resolve);
                };
                
                link.onerror = () => {
                    console.warn('[Switcher] Theme CSS failed to load:', link.href);
                    resolve();
                };
                
                document.head.appendChild(link);
            });
        }

        static async applyNoTheme() {
            console.log('[Switcher] Applying default (no theme)');

            const existingLink = document.getElementById('theme-switcher-css');
            if (existingLink) existingLink.remove();

            CSSVariableManager.clearAllThemeVars();

            SnippetManager.disableAll();

            await state.set(state.getKey('theme'), 'no-theme');
            await state.remove(state.getKey('colorScheme'));

            state.currentTheme = null;
            state.currentScheme = null;

            console.log('[Switcher] Default theme applied');
        }

        static async switchScheme(schemeName) {
            if (!state.currentTheme) return;
            await this.apply(state.currentTheme, schemeName);
        }
    }

    // =========================================================================
    // SNIPPET MANAGER
    // =========================================================================

    class SnippetManager {
        static applyVars(snippet) {
            if (!state.currentTheme || !state.currentScheme || !snippet.vars) return;

            Object.entries(snippet.vars).forEach(([varName, meta]) => {
                const key = state.getKey('snippetVar', state.currentTheme, state.currentScheme, snippet.name, varName);
                let value = state.get(key);

                if (!value && meta.default !== undefined) {
                    value = meta.type === "number" 
                        ? `${meta.default}${meta.unit || ""}` 
                        : meta.default;
                }

                if (value) {
                    CSSVariableManager.setVar(varName, value);
                }
            });
        }

        static clearVars(snippet) {
            if (!snippet.vars) return;
            Object.keys(snippet.vars).forEach(v => CSSVariableManager.removeVar(v));
        }

        static async apply(snippet, enabled, scopes = []) {
            if (!state.currentTheme || !state.currentScheme) return;
            
            const id = `snippet-css-${state.currentTheme}-${state.currentScheme}-${snippet.name}`;

            if (!enabled) {
                document.querySelectorAll(`style[id="${id}"]`).forEach(el => el.remove());
                this.clearVars(snippet);
                return;
            }

            try {
                const css = await fetch(`${CONFIG.dirs.snippets}${snippet.file}`).then(r => r.text());
                
                document.querySelectorAll(`style[id="${id}"]`).forEach(el => el.remove());

                const style = document.createElement("style");
                style.id = id;
                document.head.appendChild(style);

                const scopedCss = scopes.map(scopeName => {
                    const selector = snippet.scopes[scopeName] || "body";
                    
                    const cardTypeMatch = selector.match(/\.([\w-]+)-card/);
                    if (!cardTypeMatch) {
                        return `/* scope: ${scopeName} */\n${css}`;
                    }
                    
                    const cardType = cardTypeMatch[1];
                    const cardClass = `.${cardType}-card`;
                    
                    const scopeSelectors = selector.split(',').map(s => s.trim());
                    
                    const rulePattern = /([^{}]+)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
                    
                    let transformed = '';
                    let match;
                    let lastIndex = 0;
                    
                    while ((match = rulePattern.exec(css)) !== null) {
                        transformed += css.substring(lastIndex, match.index);
                        
                        const [fullMatch, selectorsStr, properties] = match;
                        const selectorList = selectorsStr.split(',').map(s => s.trim());
                        
                        const transformedSelectors = selectorList.flatMap(sel => {
                            const cardMatch = sel.match(new RegExp(`^\\${cardClass}((?:\\.[\\w-]+|:+[^\\s]+)*)\\s*(.*)$`));
                            if (!cardMatch) return [];
                            
                            const [, chainedAndPseudos, descendants] = cardMatch;
                            
                            return scopeSelectors.map(scopeSel => {
                                let result = scopeSel + chainedAndPseudos;
                                if (descendants) result += ' ' + descendants;
                                return result;
                            });
                        });
                        
                        if (transformedSelectors.length > 0) {
                            transformed += transformedSelectors.join(',\n') + ' {' + properties + '}';
                        }
                        
                        lastIndex = match.index + fullMatch.length;
                    }
                    
                    transformed += css.substring(lastIndex);
                    
                    return `/* scope: ${scopeName} */\n${transformed}`;
                }).join('\n');

                style.textContent = scopedCss;
                this.applyVars(snippet);
            } catch (err) {
                console.warn("Snippet load error:", err);
            }
        }

        static getEnabled(name) {
            if (!state.currentTheme || !state.currentScheme) return false;
            const value = state.get(state.getKey('snippetEnabled', state.currentTheme, state.currentScheme, name));
            return value === "1";
        }

        static getScopes(name) {
            if (!state.currentTheme || !state.currentScheme) return ["all"];
            const raw = state.get(state.getKey('snippetScopes', state.currentTheme, state.currentScheme, name));
            try {
                return raw ? JSON.parse(raw) : ["all"];
            } catch (e) {
                console.error('[Switcher] Error parsing scopes:', e, raw);
                return ["all"];
            }
        }

        static async setEnabled(name, enabled) {
            if (!state.currentTheme || !state.currentScheme) return;
            const key = state.getKey('snippetEnabled', state.currentTheme, state.currentScheme, name);
            await state.set(key, enabled ? "1" : "0");
        }

        static async setScopes(name, scopes) {
            if (!state.currentTheme || !state.currentScheme) return;
            const key = state.getKey('snippetScopes', state.currentTheme, state.currentScheme, name);
            await state.set(key, JSON.stringify(scopes));
        }

        static async setVar(snippetName, varName, value) {
            if (!state.currentTheme || !state.currentScheme) return;
            const key = state.getKey('snippetVar', state.currentTheme, state.currentScheme, snippetName, varName);
            await state.set(key, value);
        }

        static normalizeSnippet(raw) {
            // Handle string format (just filename)
            if (typeof raw === 'string') {
                const nameFromFile = raw.replace(/\.css$/i, '').trim();
                return {
                    name: nameFromFile,
                    file: raw,
                    vars: {},
                    scopes: { all: "body" }
                };
            }
            
            // Handle object format
            if (raw && typeof raw === 'object') {
                // Derive name from file if not provided
                const name = raw.name || (raw.file ? raw.file.replace(/\.css$/i, '').trim() : 'unnamed');
                
                return {
                    name: name,
                    file: raw.file || `${name}.css`,
                    vars: raw.vars || {},
                    scopes: raw.scopes || { all: "body" }
                };
            }
            
            // Invalid format
            console.warn('[Switcher] Invalid snippet format:', raw);
            return null;
        }

        static loadAll() {
            state.snippets.forEach(raw => {
                const snippet = this.normalizeSnippet(raw);
                
                // Skip if normalization failed
                if (!snippet) {
                    return;
                }
                
                const enabled = this.getEnabled(snippet.name);
                const scopes = this.getScopes(snippet.name);
                
                if (state.snippetUpdateTimeouts.has(snippet.name)) {
                    clearTimeout(state.snippetUpdateTimeouts.get(snippet.name));
                }
                
                const timeout = setTimeout(() => {
                    this.apply(snippet, enabled, scopes);
                    state.snippetUpdateTimeouts.delete(snippet.name);
                }, 10);
                
                state.snippetUpdateTimeouts.set(snippet.name, timeout);
            });
        }

        static async disableAll() {
            if (!state.currentTheme || !state.currentScheme) return;

            // Clear all pending snippet updates
            state.snippetUpdateTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            state.snippetUpdateTimeouts.clear();

            // Remove all snippet storage and styles
            state.snippets.forEach(raw => {
                const snippet = this.normalizeSnippet(raw);
                if (!snippet) return;
                
                // Remove storage keys completely (don't just set to false)
                state.remove(state.getKey('snippetEnabled', state.currentTheme, state.currentScheme, snippet.name));
                state.remove(state.getKey('snippetScopes', state.currentTheme, state.currentScheme, snippet.name));

                // Remove style elements
                const id = `snippet-css-${state.currentTheme}-${state.currentScheme}-${snippet.name}`;
                const styleElements = document.querySelectorAll(`style[id="${id}"]`);
                styleElements.forEach(el => el.remove());
                
                // Clear CSS variables
                this.clearVars(snippet);
            });
            
            // Force reflow
            document.body.offsetHeight;
            
            console.log('[Switcher] All snippets disabled');
        }
    }

    // =========================================================================
    // UI CONTROLLER - OBSERVER PATTERN
    // =========================================================================

    class UIController {
        static initialize() {
            state.subscribe('currentTheme', (themeName) => this.onThemeChange(themeName));
            state.subscribe('currentScheme', (schemeName) => this.onSchemeChange(schemeName));
        }

        static onThemeChange(themeName) {
            console.log('[Switcher] Theme changed to:', themeName);
            
            if (!themeName || themeName === 'no-theme') {
                UIManager.highlightActiveTheme('no-theme');
                UIManager.hideThemeElements();
                UIManager.updateButtonLabel('Themes');
                return;
            }
            
            UIManager.highlightActiveTheme(themeName);
            UIManager.showThemeElements();
            
            const theme = state.getTheme(themeName);
            if (theme) {
                UIManager.updateButtonLabel(theme.label || theme.name);
                
                if (Object.keys(state.colorSchemes).length > 0) {
                    CSSVariableManager.loadAllThemeVars();
                }
            }
            
            requestAnimationFrame(() => {
                UIManager.applyDropdownStyles();
            });
        }

        static onSchemeChange(schemeName) {
            console.log('[Switcher] Scheme changed to:', schemeName);
            
            if (Object.keys(state.colorSchemes).length === 0) {
                console.log('[Switcher] Color schemes not loaded yet, skipping scheme change');
                return;
            }
            
            CSSVariableManager.loadAllThemeVars();
            SnippetManager.loadAll();
            UIManager.highlightActiveScheme(schemeName);

            // Update button label to show scheme name
            if (schemeName) {
                const displayName = schemeName.charAt(0).toUpperCase() + schemeName.slice(1);
                UIManager.updateButtonLabel(displayName);
            }
            
            setTimeout(() => {
                UIManager.updateAllColorInputs();
            }, 50);
            
            requestAnimationFrame(() => {
                UIManager.applyDropdownStyles();
            });
        }
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    class EventHandlers {
        static setupColorInput() {
            document.addEventListener("change", async (e) => {
                if (!e.target.matches(".theme-switcher__color-input")) return;
                if (state.suppressSave) return;

                const varName = e.target.dataset.varName;
                const value = e.target.value;

                CSSVariableManager.setVar(varName, value);
                await state.setThemeVar(varName, value);
                ColorisManager.markModified(e.target, true);

                console.log(`[Switcher] CSS var updated: ${varName} = ${value}`);
            });
        }

        static handleResetAllColors() {
            const resetBtn = document.querySelector('.theme-switcher__reset-all');
            if (!resetBtn) return;

            (async () => {
                state.suppressSave = true;

                const keysToRemove = [];
                for (const v of CONFIG.editableVars) {
                    const key = state.getKey('cssVar', state.currentTheme, state.currentScheme, v.name);
                    keysToRemove.push(key);
                }

                await storage.batchRemove(keysToRemove);

                for (const v of CONFIG.editableVars) {
                    const schemeDefault = state.colorSchemes[state.currentTheme]?.[state.currentScheme]?.[v.name];
                    
                    if (schemeDefault) {
                        CSSVariableManager.setVar(v.name, schemeDefault);
                    } else {
                        const cssDefault = CSSVariableManager.getComputedVar(v.name);
                        if (cssDefault) {
                            CSSVariableManager.setVar(v.name, cssDefault);
                        }
                    }

                    const input = document.querySelector(
                        `.theme-switcher__color-input[data-var-name='${v.name}']`
                    );
                    if (input) {
                        const val = CSSVariableManager.resolveValue(v.name);
                        ColorisManager.resetInput(input, val);
                        ColorisManager.markModified(input, false);
                    }
                }

                state.suppressSave = false;
                
                requestAnimationFrame(() => {
                    UIManager.applyDropdownStyles();
                });

                console.log('[Switcher] All customizations reset');
            })();
        }

        static async handleColorReset(varName, input) {
            if (!state.currentTheme || !state.currentScheme) return;
            
            await state.removeThemeVar(varName);
            
            const schemeDefault = state.colorSchemes[state.currentTheme]?.[state.currentScheme]?.[varName];
            
            if (schemeDefault) {
                CSSVariableManager.setVar(varName, schemeDefault);
                ColorisManager.resetInput(input, schemeDefault);
            } else {
                const cssDefault = CSSVariableManager.getComputedVar(varName);
                if (cssDefault) {
                    CSSVariableManager.setVar(varName, cssDefault);
                    ColorisManager.resetInput(input, cssDefault);
                }
            }
            
            ColorisManager.markModified(input, false);
        }

        static setupResetButton() {
            // Already handled in handleResetAllColors
        }
    }

    // Export globals for UI file
    window.ThemeSwitcherCore = {
        CONFIG,
        storage,
        state,
        CSSVariableManager,
        ColorisManager,
        DataLoader,
        ThemeManager,
        SnippetManager,
        UIController,
        EventHandlers
    };

})();