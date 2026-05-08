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
            { name: "--accent", label: "Accent" },
            { name: "--accent-transparent", label: "Accent Transparent" },
            { name: "--card-hover", label: "Card Hover" },
            { name: "--red", label: "Error Red" },
            { name: "--bright-red", label: "Bright Red" }
        ],
        globalEditableVars: [
            { name: "--rating-color-2",  label: "★ 0.5"  },
            { name: "--rating-color-4",  label: "★ 1"  },
            { name: "--rating-color-6",  label: "★ 1.5"  },
            { name: "--rating-color-8",  label: "★ 2"  },
            { name: "--rating-color-10", label: "★ 2.5" },
            { name: "--rating-color-12", label: "★ 3" },
            { name: "--rating-color-14", label: "★ 3.5" },
            { name: "--rating-color-16", label: "★ 4" },
            { name: "--rating-color-18", label: "★ 4.5" },
            { name: "--rating-color-20", label: "★ 5" }
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

    // Intercept Stash's config overwrites and merge our live state in
    const _originalFetch = window.fetch;
    window.fetch = async function (...args) {
        let [resource, config] = args;

        if (typeof resource === 'string' && resource.endsWith('/graphql') && config?.body) {
            try {
                const body = JSON.parse(config.body);
                const isConfigurePlugin = body?.query?.includes('configurePlugin') ||
                    body?.operationName === 'ConfigurePlugin';
                const targetId = body?.variables?.pluginId || body?.variables?.plugin_id;

                if (isConfigurePlugin && targetId === PLUGIN_ID && storage.config !== null) {
                    console.log('[Switcher] Intercepting configurePlugin - merging live config');

                    // Merge: incoming input wins for its keys, but we inject any keys
                    // that Stash's snapshot is missing
                    const merged = {
                        ...body.variables.input,   // Stash's stale snapshot
                        ...storage.config,          // our live in-memory truth
                    };

                    const newBody = {
                        ...body,
                        variables: {
                            ...body.variables,
                            input: merged
                        }
                    };

                    config = { ...config, body: JSON.stringify(newBody) };
                    console.log('[Switcher] Merged config keys:', Object.keys(merged));
                }
            } catch (e) {
                // JSON parse failed or something unexpected - let it pass through unchanged
            }
        }

        return _originalFetch.call(this, resource, config);
    };

    // =========================================================================
    // CROSS-TAB SYNC VIA BROADCAST CHANNEL
    // =========================================================================

    class CrossTabSync {
        constructor() {
            this.channel = null;
            this.enabled = false;
        }

        initialize() {
            if (typeof BroadcastChannel === 'undefined') {
                console.log('[Switcher] BroadcastChannel not supported, cross-tab sync disabled');
                return;
            }

            try {
                this.channel = new BroadcastChannel('theme-switcher-sync');
                this.enabled = true;

                this.channel.addEventListener('message', (event) => {
                    this.handleMessage(event.data);
                });

                console.log('[Switcher] Cross-tab sync enabled');
            } catch (err) {
                console.error('[Switcher] Failed to initialize BroadcastChannel:', err);
            }
        }

        broadcast(type, data) {
            if (!this.enabled || !this.channel) return;

            this.channel.postMessage({ type, data });
        }

        async handleMessage(message) {
            const { type, data } = message;

            switch (type) {
                case 'theme-change':
                    // Only apply if this is a newer theme change than what we have locally
                    if (data.sequence && data.sequence <= state.themeSequence) {
                        console.log(`[Switcher] Ignoring stale theme sync [seq: ${data.sequence}], current [seq: ${state.themeSequence}]`);
                        return;
                    }

                    // Update our sequence to match
                    if (data.sequence) {
                        state.themeSequence = data.sequence;
                    }

                    if (data.theme === 'no-theme') {
                        console.log('[Switcher] Syncing no-theme from other tab:', data);
                        ThemeManager.applyNoTheme(true); // fromSync = true
                    } else if (state.currentTheme !== data.theme || state.currentScheme !== data.scheme) {
                        console.log('[Switcher] Syncing theme from other tab:', data);
                        ThemeManager.apply(data.theme, data.scheme, true); // fromSync = true
                    }
                    break;

                case 'color-var-change':
                    console.log('[Switcher] Syncing color var from other tab:', data);

                    // Save to storage so it persists across theme/scheme changes
                    if (data.scope === 'global') {
                        await state.setGlobalVar(data.varName, data.value);
                    } else {
                        await state.setThemeVar(data.varName, data.value);
                    }

                    CSSVariableManager.setVar(data.varName, data.value);

                    const input = document.querySelector(
                        `.theme-switcher__color-input[data-var-name='${data.varName}']`
                    );
                    if (input) {
                        ColorisManager.updateInput(input, data.value);
                        ColorisManager.markModified(input, true);
                    }

                    // Refresh pin states — the new color value may match or unmatch a pinned swatch
                    if (window.UIManager) {
                        UIManager.refreshAllPinStates();
                    }
                    break;

                case 'color-var-reset':
                    console.log('[Switcher] Syncing color var reset from other tab:', data);

                    if (data.scope === 'global') {
                        await state.removeGlobalVar(data.varName);
                        CSSVariableManager.removeVar(data.varName);
                        const globalVal = CSSVariableManager.getComputedVar(data.varName);
                        if (globalVal) CSSVariableManager.setVar(data.varName, globalVal);
                        const globalResetInput = document.querySelector(
                            `.theme-switcher__color-input[data-var-name='${data.varName}']`
                        );
                        if (globalResetInput) {
                            ColorisManager.resetInput(globalResetInput, globalVal || '');
                            ColorisManager.markModified(globalResetInput, false);
                        }
                    } else {
                        // Remove from storage
                        await state.removeThemeVar(data.varName);

                        // Get the reset value and apply it
                        const val = CSSVariableManager.resolveValue(data.varName);
                        CSSVariableManager.setVar(data.varName, val);

                        const resetInput = document.querySelector(
                            `.theme-switcher__color-input[data-var-name='${data.varName}']`
                        );
                        if (resetInput) {
                            ColorisManager.resetInput(resetInput, val);
                            ColorisManager.markModified(resetInput, false);
                        }
                    }
                    break;

                case 'all-global-colors-reset':
                    console.log('[Switcher] Syncing all global colors reset from other tab');

                    // Clear global storage keys
                    const globalKeysToRemove = CONFIG.globalEditableVars.map(v =>
                        state.getKey('cssVar', state.currentTheme, '_global', v.name)
                    );
                    await storage.batchRemove(globalKeysToRemove);

                    // Remove inline overrides and update UI
                    for (const v of CONFIG.globalEditableVars) {
                        CSSVariableManager.removeVar(v.name);
                        const cssDefault = CSSVariableManager.getComputedVar(v.name);
                        const globalInput = document.querySelector(
                            `.theme-switcher__color-input[data-var-name='${v.name}']`
                        );
                        if (globalInput) {
                            ColorisManager.resetInput(globalInput, cssDefault || '');
                            ColorisManager.markModified(globalInput, false);
                        }
                    }
                    break;

                case 'all-colors-reset':
                    console.log('[Switcher] Syncing all colors reset from other tab');

                    // Clear storage keys
                    const keysToRemove = [];
                    for (const v of CONFIG.editableVars) {
                        const key = state.getKey('cssVar', state.currentTheme, state.currentScheme, v.name);
                        keysToRemove.push(key);
                    }
                    await storage.batchRemove(keysToRemove);

                    // Update CSS variables and UI
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

                    setTimeout(() => {
                        if (window.UIManager) {
                            UIManager.applyDropdownStyles();
                        }
                    }, 150);
                    break;

                case 'swatch-pin-change':
                    console.log('[Switcher] Syncing swatch pins from other tab:', data);

                    // Update local storage cache so isColorPinned() reads correctly
                    storage.config['coloris-swatches'] = data.swatches;

                    // Update the Coloris picker
                    ColorisManager.updateSwatches();

                    // Refresh pin button states on all visible color rows
                    if (window.UIManager) {
                        UIManager.refreshAllPinStates();
                    }
                    break;

                case 'snippet-pin-change':
                    console.log('[Switcher] Syncing snippet pin from other tab:', data);

                    // Update storage cache to match
                    if (data.pinned) {
                        storage.config[`pinned-snippet-${data.snippetName}`] = true;
                    } else {
                        delete storage.config[`pinned-snippet-${data.snippetName}`];
                    }

                    // Rebuild the full snippet UI so pin positions update correctly
                    if (window.UIManager) {
                        UIManager.buildSnippetUI();
                    }
                    break;

                case 'favorite-applied': {
                    console.log('[Switcher] Syncing favorite apply from other tab:', data.name);
                    const fav = data.favorite;

                    // Apply colors
                    const updates = {};
                    for (const [varName, value] of Object.entries(fav.colors || {})) {
                        CSSVariableManager.setVar(varName, value);
                        const key = state.getKey('cssVar', state.currentTheme, state.currentScheme, varName);
                        updates[key] = value;
                        storage.config[key] = value;
                        const input = document.querySelector(`.theme-switcher__color-input[data-var-name='${varName}']`);
                        if (input) {
                            ColorisManager.updateInput(input, value);
                            ColorisManager.markModified(input, true);
                        }
                    }

                    // Apply snippets: full replacement
                    await SnippetManager.disableAll();

                    for (const raw of state.snippets) {
                        const snippet = SnippetManager.normalizeSnippet(raw);
                        if (!snippet) continue;

                        const saved = (fav.snippets || {})[snippet.name];
                        const enabled = saved ? saved.enabled : false;
                        const scopes = saved ? saved.scopes : [];
                        const vars = saved ? (saved.vars || {}) : {};

                        if (enabled) {
                            await SnippetManager.setEnabled(snippet.name, enabled);
                            await SnippetManager.setScopes(snippet.name, scopes);
                            for (const [varName, value] of Object.entries(vars)) {
                                await SnippetManager.setVar(snippet.name, varName, value);
                            }
                        }

                        await SnippetManager.apply(snippet, enabled, scopes);
                    }

                    if (window.UIManager) {
                        UIManager.refreshAllPinStates();
                        UIManager.buildSnippetUI();
                        requestAnimationFrame(() => UIManager.applyDropdownStyles());
                    }
                    break;
                }

                case 'favorite-change':
                    console.log('[Switcher] Syncing favorites list from other tab:', data);

                    // Sync storage cache
                    if (data.action === 'save' && data.favorite) {
                        storage.config[`favorite-${data.name}`] = data.favorite;
                        const index = storage.config['favorites-index'] || [];
                        if (!index.includes(data.name)) {
                            index.push(data.name);
                            storage.config['favorites-index'] = index;
                        }
                    } else if (data.action === 'delete') {
                        delete storage.config[`favorite-${data.name}`];
                        storage.config['favorites-index'] = (storage.config['favorites-index'] || [])
                            .filter(n => n !== data.name);
                    }

                    if (window.UIManager) {
                        UIManager.buildFavoritesUI();
                    }
                    break;

                case 'snippet-change':
                    console.log('[Switcher] Syncing snippet from other tab:', data);

                    // Only apply if we're on the same theme+scheme combination
                    if (data.theme !== state.currentTheme || data.scheme !== state.currentScheme) {
                        console.log('[Switcher] Ignoring snippet change - different theme/scheme');
                        return;
                    }

                    const snippet = state.snippets.find(s => s.name === data.snippetName ||
                        SnippetManager.normalizeSnippet(s)?.name === data.snippetName);

                    if (snippet) {
                        const normalized = SnippetManager.normalizeSnippet(snippet);
                        if (normalized) {
                            // Update storage
                            await SnippetManager.setEnabled(data.snippetName, data.enabled);
                            await SnippetManager.setScopes(data.snippetName, data.scopes);

                            // Apply the snippet
                            SnippetManager.apply(normalized, data.enabled, data.scopes);

                            // Update UI if snippet panel is visible
                            const snippetEl = document.querySelector(
                                `.theme-switcher__snippet[data-snippet-id="${data.snippetName}"]`
                            );
                            if (snippetEl) {
                                const toggle = snippetEl.querySelector('.theme-switcher__toggle');
                                if (toggle) {
                                    toggle.setAttribute('data-active', data.enabled.toString());
                                }

                                const checkboxToggle = snippetEl.querySelector('.theme-switcher__toggle-checkbox');
                                if (checkboxToggle) {
                                    checkboxToggle.checked = data.enabled;
                                }

                                const scopeCheckboxes = snippetEl.querySelectorAll('.theme-switcher__scope-checkbox');
                                scopeCheckboxes.forEach(cb => {
                                    cb.checked = data.scopes.includes(cb.dataset.scope);
                                });
                            }
                        }
                    }
                    break;

                case 'all-snippets-disabled':
                    console.log('[Switcher] Syncing all snippets disabled from other tab');

                    // Call disableAll to properly clear storage and styles
                    await SnippetManager.disableAll();

                    // Rebuild UI to reflect disabled state
                    if (window.UIManager) {
                        UIManager.buildSnippetUI();
                        UIManager.applyDropdownStyles();
                    }
                    break;

                case 'snippet-var-change':
                    console.log('[Switcher] Syncing snippet var change from other tab:', data);
                    if (!state.currentTheme || !state.currentScheme) return;

                    // Only apply if we're on the same theme+scheme combination
                    if (data.theme !== state.currentTheme || data.scheme !== state.currentScheme) {
                        console.log('[Switcher] Ignoring snippet var change - different theme/scheme');
                        return;
                    }

                    // Update storage
                    await SnippetManager.setVar(data.snippetName, data.varName, data.value);

                    // Apply CSS variable
                    CSSVariableManager.setVar(data.varName, data.value);

                    // Update UI input if visible
                    const snippetContainer = document.querySelector(
                        `.theme-switcher__snippet[data-snippet-id="${data.snippetName}"]`
                    );

                    if (snippetContainer) {
                        const varInput = snippetContainer.querySelector(
                            `.theme-switcher__var-input[data-var-name="${data.varName}"]`
                        );
                        const varSelect = snippetContainer.querySelector(
                            `.theme-switcher__var-select[data-var-name="${data.varName}"]`
                        );

                        if (varInput && data.meta) {
                            // Remove unit for display
                            const unit = data.meta.unit || '';
                            varInput.value = data.value.replace(unit, '');
                        } else if (varSelect) {
                            varSelect.value = data.value;
                        }
                    }
                    break;
            }
        }

        close() {
            if (this.channel) {
                this.channel.close();
                this.enabled = false;
            }
        }
    }

    const crossTabSync = new CrossTabSync();

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

            // Sequence tracking to prevent race conditions
            this.themeSequence = 0;
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

        getGlobalVar(varName) {
            if (!this.currentTheme) return null;
            return this.get(this.getKey('cssVar', this.currentTheme, '_global', varName));
        }

        async setGlobalVar(varName, value) {
            if (!this.currentTheme) return;
            await this.set(this.getKey('cssVar', this.currentTheme, '_global', varName), value);
        }

        async removeGlobalVar(varName) {
            if (!this.currentTheme) return;
            await this.remove(this.getKey('cssVar', this.currentTheme, '_global', varName));
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

        static resolveGlobalValue(varName) {
            if (state.currentTheme) {
                const saved = state.getGlobalVar(varName);
                if (saved) return saved;
            }
            return this.getComputedVar(varName) || "";
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

            // Apply any saved user customizations for global vars.
            // Always removeVar first to strip any inline override from the previous theme,
            // then re-apply only if the new theme has a saved customization.
            for (const v of CONFIG.globalEditableVars) {
                this.removeVar(v.name);
                const saved = state.getGlobalVar(v.name);
                if (saved) this.setVar(v.name, saved);
            }
        }

        static clearAllThemeVars() {
            // Clear editable vars
            CONFIG.editableVars.forEach(v => this.removeVar(v.name));

            // Clear global var inline overrides (restores CSS file values)
            CONFIG.globalEditableVars.forEach(v => this.removeVar(v.name));

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

        static updateSwatches() {
            if (!window.Coloris) return;
            const swatches = SwatchPinManager.getAll();

            Coloris({ swatches: swatches.length ? swatches : [] });

            // When empty, Coloris won't clean up its already-rendered swatch nodes
            if (!swatches.length) {
                const swatchContainer = document.querySelector('.clr-swatches');
                if (swatchContainer) swatchContainer.innerHTML = '';
            }
        }

        static updateInput(input, value) {
            if (!input) return;

            input.value = value;
            input.style.background = value;

            if (window.Coloris?.set) {
                Coloris.set(input, value);
            }

            // Update the clr-field wrapper and button
            const field = input.closest('.clr-field');
            if (field) {
                // Update the wrapper's color style
                field.style.color = value;

                // Update the button's background
                //const button = field.querySelector('button');
                //if (button) {
                //button.style.background = value;
                //}
            }
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

                // Wait longer for Coloris to create the wrapper and button
                setTimeout(() => {
                    const field = input.closest('.clr-field');
                    if (field && value) {
                        // Update the wrapper's color style
                        field.style.color = value;

                        // Update the button's background
                        //const button = field.querySelector('button');
                        //if (button) {
                        //button.style.background = value;
                        //}
                    }
                }, 100);
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
                    inline: false,      // Ensures picker is a popup, not inline with input
                    parent: 'body',     // Attach picker to body element for proper positioning
                    theme: "polaroid",
                    themeMode: "dark",
                    formatToggle: true,
                    alpha: true,
                    swatches: (() => {
                        const s = SwatchPinManager.getAll();
                        return s.length ? s : false;
                    })(),

                    // Real-time color updates while dragging/selecting
                    onChange: (color, input) => {
                        if (!input || !input.dataset.varName) return;

                        const varName = input.dataset.varName;

                        // Apply color immediately to CSS for live preview
                        CSSVariableManager.setVar(varName, color);

                        // Update the input's visual appearance
                        input.value = color;
                        input.style.background = color;

                        // Update the clr-field wrapper
                        const field = input.closest('.clr-field');
                        if (field) {
                            field.style.color = color;
                        }

                        // Update pin button state in real time as color changes
                        if (window.UIManager) {
                            UIManager.updatePinState(varName);
                        }

                        console.log(`[Switcher] Live preview: ${varName} = ${color}`);
                    }
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
        static async apply(themeName, schemeName = null, fromSync = false) {
            if (!themeName || themeName === "no-theme") {
                return this.applyNoTheme(fromSync);
            }

            const theme = state.getTheme(themeName);
            if (!theme) {
                console.error(`[Switcher] Theme not found: ${themeName}`);
                return;
            }

            if (!schemeName || !theme.schemes.includes(schemeName)) {
                schemeName = theme.schemes[0];
            }

            // Only increment sequence if this is a local action, not from sync
            let sequence;
            if (!fromSync) {
                sequence = ++state.themeSequence;
                console.log(`[Switcher] Applying theme: ${themeName} (${schemeName}) [seq: ${sequence}]`);
            } else {
                console.log(`[Switcher] Applying theme: ${themeName} (${schemeName}) [from sync]`);
            }

            await state.set(state.getKey('theme'), themeName);
            await state.set(state.getKey('colorScheme'), schemeName);

            await this.loadThemeCSS(theme.file);

            // Check if a newer theme was requested while we were loading (only for local changes)
            if (!fromSync && sequence !== state.themeSequence) {
                console.log(`[Switcher] Skipping theme application [seq: ${sequence}], newer request in progress [seq: ${state.themeSequence}]`);
                return;
            }

            state.currentTheme = themeName;
            state.currentScheme = schemeName;

            CSSVariableManager.loadAllThemeVars();

            // Clear all snippet styles from previous theme before loading new ones
            SnippetManager.clearAllStyles();
            SnippetManager.loadAll();

            // Only broadcast if this was a local action
            if (!fromSync) {
                crossTabSync.broadcast('theme-change', {
                    theme: themeName,
                    scheme: schemeName,
                    sequence: sequence
                });
            }

            console.log('[Switcher] Theme applied successfully');
        }

        static async loadThemeCSS(filename) {
            return new Promise((resolve) => {
                const oldLink = document.getElementById('theme-switcher-css');
                const isFromDefault = !oldLink; // Coming from default if no existing theme CSS

                let overlay = null;

                // Only add overlay when switching from default
                if (isFromDefault) {
                    overlay = document.createElement('div');
                    overlay.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: var(--body, #394b59);
                        z-index: 999999;
                        opacity: 1;
                        transition: opacity 0.15s;
                        pointer-events: none;
                    `;
                    document.body.appendChild(overlay);
                }

                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = `${CONFIG.dirs.themes}${filename}`;

                link.onload = () => {
                    // Give the browser a moment to apply the new styles
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            // Remove old theme CSS after new one is loaded and applied
                            if (oldLink && oldLink !== link) {
                                oldLink.remove();
                            }

                            // Set ID on new link
                            link.id = 'theme-switcher-css';

                            // Fade out overlay if it exists
                            if (overlay) {
                                overlay.style.opacity = '0';
                                setTimeout(() => overlay.remove(), 150);
                            }

                            resolve();
                        });
                    });
                };

                link.onerror = () => {
                    console.warn('[Switcher] Theme CSS failed to load:', link.href);
                    if (overlay) overlay.remove();
                    resolve();
                };

                document.head.appendChild(link);
            });
        }

        static async applyNoTheme(fromSync = false) {
            // Only increment sequence if this is a local action, not from sync
            let sequence;
            if (!fromSync) {
                sequence = ++state.themeSequence;
                console.log(`[Switcher] Applying default (no theme) [seq: ${sequence}]`);
            } else {
                console.log('[Switcher] Applying default (no theme) [from sync]');
            }

            const existingLink = document.getElementById('theme-switcher-css');
            if (existingLink) existingLink.remove();

            CSSVariableManager.clearAllThemeVars();

            // Clear any remaining snippet styles from all themes/schemes
            SnippetManager.clearAllStyles();

            await state.set(state.getKey('theme'), 'no-theme');
            await state.remove(state.getKey('colorScheme'));

            state.currentTheme = null;
            state.currentScheme = null;

            // Only broadcast if this was a local action
            if (!fromSync) {
                crossTabSync.broadcast('theme-change', {
                    theme: 'no-theme',
                    scheme: null,
                    sequence: sequence
                });
            }

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

        static clearAllStyles() {
            // Remove all snippet style elements from any theme/scheme
            document.querySelectorAll('style[id^="snippet-css-"]').forEach(el => el.remove());
            console.log('[Switcher] Cleared all snippet styles');
        }

        static async apply(snippet, enabled, scopes = []) {
            if (!state.currentTheme || !state.currentScheme) return;

            const id = `snippet-css-${state.currentTheme}-${state.currentScheme}-${snippet.name}`;

            if (!enabled) {
                document.querySelectorAll(`style[id="${id}"]`).forEach(el => el.remove());
                this.clearVars(snippet);
                // Remove var storage keys so they don't orphan in config
                if (snippet.vars && state.currentTheme && state.currentScheme) {
                    Object.keys(snippet.vars).forEach(varName => {
                        state.remove(state.getKey('snippetVar', state.currentTheme, state.currentScheme, snippet.name, varName));
                    });
                }
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
            const enabledKey = state.getKey('snippetEnabled', state.currentTheme, state.currentScheme, name);
            const scopesKey  = state.getKey('snippetScopes',  state.currentTheme, state.currentScheme, name);
            if (enabled) {
                await state.set(enabledKey, "1");
            } else {
                // Disabled = no keys needed; absence is equivalent to false/empty
                await state.remove(enabledKey);
                await state.remove(scopesKey);
            }
        }

        static async setScopes(name, scopes) {
            if (!state.currentTheme || !state.currentScheme) return;
            const key = state.getKey('snippetScopes', state.currentTheme, state.currentScheme, name);
            if (scopes && scopes.length > 0) {
                await state.set(key, JSON.stringify(scopes));
            } else {
                await state.remove(key);
            }
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
                state.remove(state.getKey('snippetScopes',  state.currentTheme, state.currentScheme, snippet.name));

                // Remove var keys too — orphaned var storage is cleaned up on disable
                if (snippet.vars) {
                    Object.keys(snippet.vars).forEach(varName => {
                        state.remove(state.getKey('snippetVar', state.currentTheme, state.currentScheme, snippet.name, varName));
                    });
                }

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
    // FAVORITES MANAGER
    // =========================================================================

    class FavoritesManager {
        static getFavoritesIndex() {
            return storage.config['favorites-index'] || [];
        }

        static getAll() {
            return this.getFavoritesIndex()
                .map(name => storage.config[`favorite-${name}`])
                .filter(Boolean);
        }

        static async save(name) {
            // Capture modified colors
            const colors = {};
            for (const v of CONFIG.editableVars) {
                const current = CSSVariableManager.resolveValue(v.name);
                const schemeDefault = state.colorSchemes[state.currentTheme]?.[state.currentScheme]?.[v.name]
                    ?? CSSVariableManager.getComputedVar(v.name);
                if (current && current !== schemeDefault) {
                    colors[v.name] = current;
                }
            }

            // Capture enabled/modified snippets
            const snippets = {};
            for (const raw of state.snippets) {
                const snippet = SnippetManager.normalizeSnippet(raw);
                if (!snippet) continue;

                const enabled = SnippetManager.getEnabled(snippet.name);
                const scopes = SnippetManager.getScopes(snippet.name);

                // Capture non-default vars
                const vars = {};
                if (snippet.vars) {
                    for (const [varName, meta] of Object.entries(snippet.vars)) {
                        const key = state.getKey('snippetVar', state.currentTheme, state.currentScheme, snippet.name, varName);
                        const saved = state.get(key);
                        const defaultVal = meta.default !== undefined
                            ? (meta.type === 'number' ? `${meta.default}${meta.unit || ''}` : String(meta.default))
                            : null;
                        if (saved && saved !== defaultVal) {
                            vars[varName] = saved;
                        }
                    }
                }

                // Only include enabled snippets — disabled snippets contribute nothing on restore
                if (enabled) {
                    const entry = { enabled, scopes };
                    if (Object.keys(vars).length > 0) entry.vars = vars;
                    snippets[snippet.name] = entry;
                }
            }

            // Nothing to save
            if (!Object.keys(colors).length && !Object.keys(snippets).length) return false;

            const favorite = { name, colors, snippets };
            await storage.set(`favorite-${name}`, favorite);

            const index = this.getFavoritesIndex();
            if (!index.includes(name)) {
                index.push(name);
                await storage.set('favorites-index', index);
            }

            crossTabSync.broadcast('favorite-change', { action: 'save', name, favorite });
            return true;
        }

        static async apply(name) {
            const favorite = storage.config[`favorite-${name}`];
            if (!favorite) return;

            // --- Apply colors ---
            const updates = {};
            state.suppressSave = true;

            for (const [varName, value] of Object.entries(favorite.colors || {})) {
                CSSVariableManager.setVar(varName, value);
                const key = state.getKey('cssVar', state.currentTheme, state.currentScheme, varName);
                updates[key] = value;

                const input = document.querySelector(
                    `.theme-switcher__color-input[data-var-name='${varName}']`
                );
                if (input) {
                    ColorisManager.updateInput(input, value);
                    ColorisManager.markModified(input, true);
                }
            }

            state.suppressSave = false;
            await storage.batchSet(updates);

            // Refresh pin buttons to reflect current swatch state
            if (window.UIManager) {
                UIManager.refreshAllPinStates();
            }

            // --- Apply snippets: full replacement ---
            // 1. Disable all first
            await SnippetManager.disableAll();

            // 2. Restore saved snippet states — only write storage for enabled snippets;
            //    disabled ones are already gone from disableAll() above
            for (const raw of state.snippets) {
                const snippet = SnippetManager.normalizeSnippet(raw);
                if (!snippet) continue;

                const saved = (favorite.snippets || {})[snippet.name];
                const enabled = saved ? saved.enabled : false;
                const scopes = saved ? saved.scopes : [];
                const vars = saved ? (saved.vars || {}) : {};

                if (enabled) {
                    await SnippetManager.setEnabled(snippet.name, enabled);
                    await SnippetManager.setScopes(snippet.name, scopes);
                    for (const [varName, value] of Object.entries(vars)) {
                        await SnippetManager.setVar(snippet.name, varName, value);
                    }
                }

                await SnippetManager.apply(snippet, enabled, scopes);
            }

            // Rebuild snippet UI
            if (window.UIManager) {
                UIManager.buildSnippetUI();
                requestAnimationFrame(() => UIManager.applyDropdownStyles());
            }

            crossTabSync.broadcast('favorite-applied', { name, favorite });
        }

        static async delete(name) {
            await storage.remove(`favorite-${name}`);
            const index = this.getFavoritesIndex().filter(n => n !== name);
            await storage.set('favorites-index', index);
            crossTabSync.broadcast('favorite-change', { action: 'delete', name });
        }
    }


    // =========================================================================
    // SWATCH PIN MANAGER
    // =========================================================================

    class SwatchPinManager {
        static getAll() {
            return storage.config['coloris-swatches'] || [];
        }

        static isColorPinned(color) {
            return this.getAll().includes(color);
        }

        static async pin(color) {
            const swatches = this.getAll();
            if (!swatches.includes(color)) {
                swatches.push(color);
                await storage.set('coloris-swatches', swatches);
                crossTabSync.broadcast('swatch-pin-change', { swatches });
            }
        }

        static async unpin(color) {
            const swatches = this.getAll().filter(c => c !== color);
            await storage.set('coloris-swatches', swatches);
            crossTabSync.broadcast('swatch-pin-change', { swatches });
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

            // Rebuild snippet UI to reflect the new theme's snippet states
            if (window.UIManager && state.snippets.length > 0) {
                setTimeout(() => {
                    UIManager.buildSnippetUI();
                }, 50);
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

            // Clear all snippet styles from previous scheme before loading new ones
            SnippetManager.clearAllStyles();
            SnippetManager.loadAll();

            UIManager.highlightActiveScheme(schemeName);

            // Rebuild snippet UI to reflect the new scheme's snippet states
            if (window.UIManager && state.snippets.length > 0) {
                UIManager.buildSnippetUI();
            }

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
                const row = e.target.closest('.theme-switcher__color-row');
                const isGlobal = row?.getAttribute('data-scope') === 'global';

                CSSVariableManager.setVar(varName, value);

                if (isGlobal) {
                    await state.setGlobalVar(varName, value);
                } else {
                    await state.setThemeVar(varName, value);
                }

                // Update the button/field in this tab (Tab A)
                ColorisManager.updateInput(e.target, value);
                ColorisManager.markModified(e.target, true);

                // Broadcast to other tabs
                crossTabSync.broadcast('color-var-change', { varName, value, scope: isGlobal ? 'global' : 'scheme' });

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

                // Broadcast to other tabs
                crossTabSync.broadcast('all-colors-reset', {});

                console.log('[Switcher] All customizations reset');
            })();
        }

        static handleResetAllGlobalColors() {
            (async () => {
                state.suppressSave = true;

                const keysToRemove = CONFIG.globalEditableVars.map(v =>
                    state.getKey('cssVar', state.currentTheme, '_global', v.name)
                );
                await storage.batchRemove(keysToRemove);

                for (const v of CONFIG.globalEditableVars) {
                    // Remove inline override first so getComputedVar reads the CSS file value
                    CSSVariableManager.removeVar(v.name);
                    const cssDefault = CSSVariableManager.getComputedVar(v.name);
                    if (cssDefault) CSSVariableManager.setVar(v.name, cssDefault);

                    const input = document.querySelector(
                        `.theme-switcher__color-input[data-var-name='${v.name}']`
                    );
                    if (input) {
                        ColorisManager.resetInput(input, cssDefault || '');
                        ColorisManager.markModified(input, false);
                    }
                }

                state.suppressSave = false;

                // Broadcast to other tabs
                crossTabSync.broadcast('all-global-colors-reset', {});

                console.log('[Switcher] All global color customizations reset');
            })();
        }

        static async handleColorReset(varName, input) {
            const row = input.closest('.theme-switcher__color-row');
            const isGlobal = row?.getAttribute('data-scope') === 'global';

            if (isGlobal) {
                await state.removeGlobalVar(varName);
                // Remove inline override first so getComputedVar reads the CSS file value
                CSSVariableManager.removeVar(varName);
                const cssDefault = CSSVariableManager.getComputedVar(varName);
                if (cssDefault) {
                    CSSVariableManager.setVar(varName, cssDefault);
                    ColorisManager.resetInput(input, cssDefault);
                }
            } else {
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
            }

            ColorisManager.markModified(input, false);

            // Broadcast to other tabs
            crossTabSync.broadcast('color-var-reset', { varName, scope: isGlobal ? 'global' : 'scheme' });
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
        FavoritesManager,
        UIController,
        EventHandlers,
        SwatchPinManager,
        crossTabSync
    };

})();