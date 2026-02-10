(async () => {
    // =========================================================================
    // CONFIGURATION
    // =========================================================================

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
            themesJson: '/custom/assets/themes/themes.json',           // NEW: theme families
            colorSchemesJson: '/custom/assets/themes/color-schemes.json'  // NEW: nested color schemes
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
			//{ name: "--description", label: "Description Background" }
        ]
    };

    // =========================================================================
    // STATE MANAGER
    // =========================================================================

    class StateManager {
        constructor() {
            this.themes = [];           // Array of {name, file, schemes[]}
            this.colorSchemes = {};     // Nested: {themeName: {schemeName: {vars}}}
            this.snippets = [];
            this.currentTheme = null;   // Current theme name (e.g., "CMD")
            this.currentScheme = null;  // Current scheme name (e.g., "dark")
            this.dropdownOpen = false;
            this.suppressSave = false;
            this.saveTimeout = null;
            this.cachedElements = new Map();
            this.snippetUpdateTimeouts = new Map();
        }
        
        // Storage key generators (all keys are THEME+SCHEME-SCOPED)
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

        // Cached element retrieval
        getElement(id, selector) {
            if (!this.cachedElements.has(id)) {
                this.cachedElements.set(id, document.querySelector(selector));
            }
            return this.cachedElements.get(id);
        }

        clearElementCache() {
            this.cachedElements.clear();
        }

        // LocalStorage helpers
        get(key) {
            return localStorage.getItem(key);
        }

        set(key, value) {
            localStorage.setItem(key, value);
        }

        remove(key) {
            localStorage.removeItem(key);
        }

        // Theme+Scheme-scoped storage
        getThemeVar(varName) {
            if (!this.currentTheme || !this.currentScheme) return null;
            return this.get(this.getKey('cssVar', this.currentTheme, this.currentScheme, varName));
        }

        setThemeVar(varName, value) {
            if (!this.currentTheme || !this.currentScheme) return;
            this.set(this.getKey('cssVar', this.currentTheme, this.currentScheme, varName), value);
        }

        removeThemeVar(varName) {
            if (!this.currentTheme || !this.currentScheme) return;
            this.remove(this.getKey('cssVar', this.currentTheme, this.currentScheme, varName));
        }

        // Get available schemes for current theme
        getAvailableSchemes() {
            const theme = this.themes.find(t => t.name === this.currentTheme);
            return theme?.schemes || [];
        }

        // Get theme object by name
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
            // Priority: 1. User customization, 2. Color scheme default, 3. Theme CSS default
            const saved = state.getThemeVar(varName);
            if (saved) return saved;

            // Check if we have a color scheme with this variable
            if (state.currentTheme && state.currentScheme) {
                const schemeValue = state.colorSchemes[state.currentTheme]?.[state.currentScheme]?.[varName];
                if (schemeValue) return schemeValue;
            }

            // Fall back to computed CSS value
            const computed = this.getComputedVar(varName);
            return computed || "";
        }

        static loadAllThemeVars() {
            CONFIG.editableVars.forEach(v => {
                const value = this.resolveValue(v.name);
                if (value) this.setVar(v.name, value);
            });
        }

        static clearAllThemeVars() {
            CONFIG.editableVars.forEach(v => this.removeVar(v.name));
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
            const label = input.closest("div[data-var-name]")?.querySelector("span");
            if (label) {
                label.classList.toggle("modified-label", isModified);
            }
        }

        static async initializeAll() {
            await this.loadAssets();

            document.querySelectorAll('[data-coloris]').forEach(input => {
                const value = CSSVariableManager.resolveValue(input.dataset.varName);
                this.updateInput(input, value);
                this.markModified(input, !!state.getThemeVar(input.dataset.varName));
            });
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
                    
                    // Extract the card type from the scope selector (e.g., ".scene-card" → "scene")
                    const cardTypeMatch = selector.match(/\.([\w-]+)-card/);
                    if (!cardTypeMatch) {
                        // If no card type found, return CSS unchanged
                        return `/* scope: ${scopeName} */\n${css}`;
                    }
                    
                    const cardType = cardTypeMatch[1];
                    const cardClass = `.${cardType}-card`;
                    
                    // Split multi-selector scopes by comma
                    const scopeSelectors = selector.split(',').map(s => s.trim());
                    
                    // Process complete CSS rules
                    const rulePattern = /([^{}]+)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
                    
                    let transformed = '';
                    let match;
                    let lastIndex = 0;
                    
                    while ((match = rulePattern.exec(css)) !== null) {
                        // Preserve whitespace/comments between rules
                        transformed += css.substring(lastIndex, match.index);
                        
                        const [fullMatch, selectorsStr, properties] = match;
                        const selectorList = selectorsStr.split(',').map(s => s.trim());
                        
                        // Only process selectors that start with this card type
                        const transformedSelectors = selectorList.flatMap(sel => {
                            // Match: .scene-card followed by:
                            // - Optional chained classes (e.g., .has-date, .no-description)
                            // - Optional pseudo-classes/elements (e.g., :hover, ::before)
                            // - Optional space and descendants
                            const cardMatch = sel.match(new RegExp(`^\\${cardClass}((?:\\.[\\w-]+|:+[^\\s]+)*)\\s*(.*)$`));
                            if (!cardMatch) return []; // Skip selectors for other card types
                            
                            const [, chainedAndPseudos, descendants] = cardMatch;
                            
                            // Replace card class with each scope selector
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
                    
                    // Add any remaining content (comments, whitespace at end)
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
            return state.get(state.getKey('snippetEnabled', state.currentTheme, state.currentScheme, name)) === "1";
        }

         static getScopes(name) {
            if (!state.currentTheme || !state.currentScheme) return ["all"];
            const raw = state.get(state.getKey('snippetScopes', state.currentTheme, state.currentScheme, name));
            return raw ? JSON.parse(raw) : ["all"];
        }

        static setEnabled(name, enabled, scopes) {
            if (!state.currentTheme || !state.currentScheme) return;
            
            const enabledKey = state.getKey('snippetEnabled', state.currentTheme, state.currentScheme, name);
            const scopesKey = state.getKey('snippetScopes', state.currentTheme, state.currentScheme, name);

            const oldEnabled = state.get(enabledKey);
            const oldScopes = state.get(scopesKey);

            state.set(enabledKey, enabled ? "1" : "0");
            state.set(scopesKey, JSON.stringify(scopes));

            window.dispatchEvent(new StorageEvent('storage', {
                key: enabledKey,
                oldValue: oldEnabled,
                newValue: enabled ? "1" : "0",
                storageArea: localStorage
            }));

            window.dispatchEvent(new StorageEvent('storage', {
                key: scopesKey,
                oldValue: oldScopes,
                newValue: JSON.stringify(scopes),
                storageArea: localStorage
            }));
        }


        static applyDebounced(snippet, enabled, scopes) {
            // Clear existing timeout for this snippet
            const timeoutId = state.snippetUpdateTimeouts.get(snippet.name);
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Set new timeout
            const newTimeoutId = setTimeout(() => {
                this.apply(snippet, enabled, scopes);
                state.snippetUpdateTimeouts.delete(snippet.name);
            }, 100);

            state.snippetUpdateTimeouts.set(snippet.name, newTimeoutId);
        }

        static loadAll() {
            state.snippets.forEach(s => {
                const snippet = this.normalizeSnippet(s);
                const enabled = this.getEnabled(snippet.name);
                const scopes = this.getScopes(snippet.name);
                this.apply(snippet, enabled, scopes);
            });
        }

        static normalizeSnippet(s) {
            if (typeof s === "string") {
                return {
                    name: s.replace(".css", ""),
                    file: s,
                    scopes: { all: "body" }
                };
            }
            return {
                name: s.name || s.file.replace(".css", ""),
                file: s.file || s.name + ".css",
                scopes: s.scopes || { all: "body" },
                vars: s.vars || null
            };
        }

        static disableAll() {
            if (!state.currentTheme || !state.currentScheme) return;

            state.snippetUpdateTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            state.snippetUpdateTimeouts.clear();

            state.snippets.forEach(s => {
                const snippet = this.normalizeSnippet(s);
                
                state.remove(state.getKey('snippetEnabled', state.currentTheme, state.currentScheme, snippet.name));
                state.remove(state.getKey('snippetScopes', state.currentTheme, state.currentScheme, snippet.name));

                const id = `snippet-css-${state.currentTheme}-${state.currentScheme}-${snippet.name}`;
                const styleElements = document.querySelectorAll(`style[id="${id}"]`);
                styleElements.forEach(el => el.remove());
                
                this.clearVars(snippet);
            });
            
            document.body.offsetHeight;
        }
    }

    // =========================================================================
    // THEME MANAGER
    // =========================================================================

    class ThemeManager {
        static async apply(themeName, schemeName = null) {
            // Find theme object
            const theme = state.getTheme(themeName);
            
            // Handle "no theme"
            if (!themeName || themeName === "no-theme" || !theme) {
                return this.applyNoTheme();
            }

            // Determine scheme to use
            if (!schemeName) {
                const savedScheme = state.get(state.getKey('colorScheme'));
                schemeName = theme.schemes.includes(savedScheme) 
                    ? savedScheme 
                    : theme.schemes[0];
            }

            // Validate scheme exists for this theme
            if (!theme.schemes.includes(schemeName)) {
                console.warn(`Scheme "${schemeName}" not available for theme "${themeName}", using ${theme.schemes[0]}`);
                schemeName = theme.schemes[0];
            }

            console.log(`🎨 Applying theme: ${themeName} / ${schemeName}`);

            // Clear snippets from previous scheme when switching schemes
            if (state.currentScheme && state.currentScheme !== schemeName) {
                document.querySelectorAll(`style[id^='snippet-css-${state.currentTheme}-${state.currentScheme}-']`).forEach(el => el.remove());
            }

            // Clear previous theme
            if (state.currentTheme && state.currentTheme !== themeName) {
                document.querySelectorAll("style[id^='snippet-css-']").forEach(el => el.remove());
                CSSVariableManager.clearAllThemeVars();
                
                state.snippets.forEach(raw => {
                    const snippet = SnippetManager.normalizeSnippet(raw);
                    SnippetManager.clearVars(snippet);
                });
            }

            // Update state first
            const needsCSS = !document.getElementById("theme-switcher-css") || state.currentTheme !== themeName;
            state.currentTheme = themeName;
            state.currentScheme = schemeName;

            // Show UI elements
            this.showThemeElements();
            document.body.classList.remove("no-theme");

            // Load theme CSS if needed
            if (needsCSS) {
                await this.loadThemeCSS(theme.file);
            }
            
            // Apply color scheme
            this.applyColorScheme(schemeName);

            // Wait for styles to be applied
            await new Promise(resolve => requestAnimationFrame(resolve));

            // Reload snippets for new scheme
            SnippetManager.loadAll();

            // Update UI
            UIManager.updateButtonLabel(schemeName || themeName);
            UIManager.highlightActiveTheme(themeName);
            UIManager.highlightActiveScheme(schemeName);
            
            // Save to localStorage
            state.set(state.getKey('theme'), themeName);
            state.set(state.getKey('colorScheme'), schemeName);
            
            // Rebuild snippet UI to reflect scheme-specific states
            UIManager.buildSnippetUI();
            
            // Final style refresh
            requestAnimationFrame(() => {
                UIManager.applyDropdownStyles();
            });

            console.log("✓ Theme applied successfully");
        }

        static applyNoTheme() {
            document.getElementById("theme-switcher-css")?.remove();
            document.body.classList.add("no-theme");
            
            this.hideThemeElements();
            
            UIManager.updateButtonLabel("Themes");
            UIManager.highlightActiveTheme(null);
            UIManager.highlightActiveScheme(null);
            
            SnippetManager.disableAll();
            CSSVariableManager.clearAllThemeVars();
            ColorisManager.initializeAll();
            UIManager.applyDropdownStyles();
            
            state.set(state.getKey('theme'), "no-theme");
            state.currentTheme = null;
            state.currentScheme = null;
        }

        static applyColorScheme(schemeName) {
            const scheme = state.colorSchemes[state.currentTheme]?.[schemeName];
            if (!scheme) {
                console.warn(`Color scheme "${schemeName}" not found for theme "${state.currentTheme}"`);
                return;
            }

            // Apply each color variable
            Object.entries(scheme).forEach(([varName, value]) => {
                // Check if user has a custom override
                const userValue = state.getThemeVar(varName);
                if (userValue) {
                    CSSVariableManager.setVar(varName, userValue);
                } else {
                    CSSVariableManager.setVar(varName, value);
                }
            });

            // Force browser to recompute styles
            document.body.offsetHeight;

            // Force complete Coloris reset on scheme change
            document.querySelectorAll('[data-coloris]').forEach(inp => {
                const varName = inp.dataset.varName;
                const val = CSSVariableManager.resolveValue(varName);
                
                ColorisManager.resetInput(inp, val);
                ColorisManager.markModified(inp, !!state.getThemeVar(varName));
            });

            // Apply dropdown styles
            requestAnimationFrame(() => {
                UIManager.applyDropdownStyles();
            });
        }

        static async loadThemeCSS(filename) {
            const cssPath = `${CONFIG.dirs.themes}${filename}`;
            
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = `${cssPath}?v=${Date.now()}`;
            link.dataset.theme = filename;

            return new Promise((resolve, reject) => {
                link.onload = async () => {
                    document.getElementById("theme-switcher-css")?.remove();
                    link.id = "theme-switcher-css";

                    // Wait for CSS to be parsed
                    await new Promise(r => requestAnimationFrame(r));

                    // Reinitialize Coloris
                    window.Coloris?.destroy?.();
                    document.querySelectorAll('.clr-field').forEach(f => {
                        const input = f.querySelector('input[data-coloris]');
                        if (input) f.replaceWith(input);
                    });

                    await ColorisManager.initializeAll();
                    
                    resolve();
                };

                link.onerror = () => {
                    console.warn('Theme CSS failed to load:', link.href);
                    reject();
                };

                document.head.appendChild(link);
            });
        }

        static hideThemeElements() {
            const elements = [
                state.getElement('snippetsBtn', '#snippets-collapse-btn'),
                state.getElement('snippetContainer', '.snippet-container'),
                state.getElement('colorsBtn', '#theme-collapse-btn'),
                state.getElement('colorContainer', '.color-container'),
                state.getElement('separator2', '#theme-switcher-panel hr.separator2')
            ];
            
            elements.forEach(el => {
                if (el) el.style.display = "none";
            });
        }

        static showThemeElements() {
            const elements = [
                state.getElement('snippetsBtn', '#snippets-collapse-btn'),
                state.getElement('colorsBtn', '#theme-collapse-btn'),
                state.getElement('separator2', '#theme-switcher-panel hr.separator2')
            ];
            
            elements.forEach(el => {
                if (el) el.style.display = "block";
            });
        }
    }

    // =========================================================================
    // UI MANAGER
    // =========================================================================

    class UIManager {
        static updateButtonLabel(text) {
            const btn = state.getElement('themeBtn', '#theme-switcher-button');
            if (btn) btn.textContent = text;
        }

        static highlightActiveTheme(theme) {
            document.querySelectorAll(".dropdown-item").forEach(el => {
                // Highlight main theme button if it matches
                if (el.classList.contains('theme-main-btn')) {
                    el.classList.toggle("active", el.dataset.theme === theme);
                }
            });
        }

        static highlightActiveScheme(schemeName) {
            document.querySelectorAll(".dropdown-item[data-scheme]").forEach(el => {
                el.classList.toggle("active", el.dataset.scheme === schemeName);
            });

            // Auto-expand the schemes container if current scheme is not the theme name
            if (state.currentTheme && state.currentScheme && state.currentScheme !== state.currentTheme) {
                const container = document.querySelector(`.schemes-container[data-theme-family="${state.currentTheme}"]`);
                if (container && container.style.display !== "block") {
                    container.style.display = "block";
                    const height = container.scrollHeight;
                    container.style.maxHeight = height + "px";
                }
            }
        }

        static applyDropdownStyles() {
            const panel = state.getElement('panel', '#theme-switcher-panel');
            const button = state.getElement('themeBtn', '#theme-switcher-button');
            if (!panel || !button) return;

            const isNoTheme = document.body.classList.contains('no-theme');
            const cs = getComputedStyle(document.documentElement);

            const colors = {
                navBg: isNoTheme ? "#394b59" : cs.getPropertyValue('--nav-grey-dark').trim() || "#394b59",
                navBtBg: isNoTheme ? "#394b59" : cs.getPropertyValue('--nav').trim() || "#394b59",
                text: isNoTheme ? "#fff" : cs.getPropertyValue('--tags').trim() || "#ffffff",
                accent: isNoTheme ? "#cc7b19" : cs.getPropertyValue('--accent').trim() || "#cc7b19",
                hoverBg: isNoTheme ? "#137cbd" : cs.getPropertyValue('--hover-bg').trim() || "transparent",
                hoverText: isNoTheme ? "#fff" : cs.getPropertyValue('--hover-text').trim() || "#fff"
            };

            panel.style.background = colors.navBg;
            button.style.background = colors.navBtBg;

            panel.querySelectorAll(".dropdown-item").forEach(item => {
                item.style.color = colors.text;
                item.onmouseenter = () => item.style.background = colors.hoverBg;
                item.onmouseleave = () => item.style.background = "transparent";
                item.addEventListener('click', () => {
                    setTimeout(() => {
                        item.style.background = "transparent";
                    }, 0);
                });
            });

            document.querySelectorAll(".coloris-input").forEach(inp => {
                inp.style.outline = `2px solid ${colors.accent}22`;
            });
        }

        static createDropdownPanel() {
            const panel = document.createElement("div");
            panel.id = "theme-switcher-panel";
            return panel;
        }

        static createThemeOptions(panel) {
            // Default theme
            const defaultBtn = this.createDropdownItem("Default", "no-theme", null);
            defaultBtn.addEventListener('click', () => {
                // Collapse all scheme containers when clicking Default
                panel.querySelectorAll('.schemes-container').forEach(container => {
                    container.style.maxHeight = "0";
                    setTimeout(() => {
                        container.style.display = "none";
                    }, 300);
                });
            });
            panel.appendChild(defaultBtn);

            // Check if we have themes loaded
            if (!state.themes || state.themes.length === 0) {
                const loading = document.createElement("div");
                loading.textContent = "Loading themes...";
                loading.style.opacity = "0.7";
                loading.style.padding = "8px";
                panel.appendChild(loading);
                return;
            }

            // Create theme buttons with collapsible scheme lists
            state.themes.forEach(theme => {
                // Main theme button (applies theme with matching-named scheme)
                const themeBtn = this.createDropdownItem(theme.name, theme.name, theme.name);
                themeBtn.classList.add('theme-main-btn');
                themeBtn.dataset.themeFamily = theme.name;
                panel.appendChild(themeBtn);

                // Collapsible container for additional schemes
                const schemesContainer = document.createElement("div");
                schemesContainer.className = "schemes-container";
                schemesContainer.dataset.themeFamily = theme.name;
                schemesContainer.style.display = "none";
                schemesContainer.style.maxHeight = "0";
                schemesContainer.style.overflow = "hidden";
                schemesContainer.style.transition = "max-height 0.3s ease-out";

                // Create buttons for schemes (excluding the matching-named one)
                theme.schemes.forEach(schemeName => {
                    // Skip the scheme that matches the theme name
                    if (schemeName === theme.name) return;

                    const schemeBtn = this.createDropdownItem(
                        `  ${schemeName.charAt(0) + schemeName.slice(1)}`, 
                        theme.name, 
                        schemeName
                    );
                    schemeBtn.style.paddingLeft = "24px";
                    schemesContainer.appendChild(schemeBtn);
                });

                panel.appendChild(schemesContainer);

                // Add click handler for theme button to toggle expansion
                themeBtn.addEventListener('click', (e) => {
                    // First apply the theme
                    ThemeManager.apply(theme.name, theme.name);
                    
                    // Then toggle expansion
                    const isExpanded = schemesContainer.style.display === "block";
                    
                    // Collapse all other scheme containers
                    panel.querySelectorAll('.schemes-container').forEach(container => {
                        if (container !== schemesContainer) {
                            container.style.display = "none";
                            container.style.maxHeight = "0";
                        }
                    });

                    // Toggle this container
                    if (isExpanded) {
                        schemesContainer.style.maxHeight = "0";
                        setTimeout(() => {
                            schemesContainer.style.display = "none";
                        }, 300);
                    } else {
                        schemesContainer.style.display = "block";
                        // Calculate and set max-height for smooth animation
                        const height = schemesContainer.scrollHeight;
                        schemesContainer.style.maxHeight = height + "px";
                    }

                    e.stopPropagation();
                });
            });

            panel.appendChild(document.createElement("hr"));
        }

        static createDropdownItem(text, themeName, schemeName) {
            const btn = document.createElement("button");
            btn.className = "dropdown-item";
            btn.dataset.theme = themeName;
            if (schemeName) btn.dataset.scheme = schemeName;
            btn.textContent = text;
            btn.onclick = () => ThemeManager.apply(themeName, schemeName);
            return btn;
        }

        static buildSnippetUI() {
            state.clearElementCache();
            const container = document.querySelector('.snippet-container');
            if (!container) {
                console.warn('Snippet container not found');
                return;
            }

            container.innerHTML = "";

            if (!state.snippets.length) {
                container.innerHTML = '<div style="opacity: 0.7">No snippets found</div>';
                return;
            }

            const fragment = document.createDocumentFragment();

            state.snippets.forEach(raw => {
                const snippet = SnippetManager.normalizeSnippet(raw);
                const elements = this.createSnippetRowElements(snippet);
                
                fragment.appendChild(elements.row);
                if (elements.varsPanel) fragment.appendChild(elements.varsPanel);
                if (elements.scopePanel) fragment.appendChild(elements.scopePanel);
            });

            // Disable all button
            const disableBtn = document.createElement("button");
            disableBtn.id = "disable-all-btn";
            disableBtn.textContent = "Disable All Snippets";
            disableBtn.onclick = () => {
                SnippetManager.disableAll();
                this.buildSnippetUI();
                this.applyDropdownStyles();
            };
            fragment.appendChild(disableBtn);

            container.appendChild(fragment);
        }

        static createSnippetRowElements(snippet) {
            const hasScopes = Object.keys(snippet.scopes).length > 1;
            const hasVars = snippet.vars && Object.keys(snippet.vars).length > 0;
            const isAccordion = hasVars || hasScopes;

            // Main row
            const row = document.createElement("div");
            row.className = "snippet-toggle-row";

            // Label section
            const label = this.createSnippetLabel(snippet, isAccordion);
            row.appendChild(label.wrapper);

            // Panels
            const varsPanel = hasVars ? this.createVarsPanel(snippet) : null;
            const scopePanel = this.createScopePanel(snippet);

            // Toggle
            const toggle = this.createSnippetToggle(snippet, hasScopes, scopePanel, varsPanel);
            row.appendChild(toggle);

            // Accordion behavior
            if (isAccordion) {
                label.wrapper.style.cursor = "pointer";
                label.wrapper.onclick = (e) => {
                    if (e.target.closest('.switch-toggle') || e.target.type === 'checkbox') {
                        return;
                    }
                    
                    const isOpen = varsPanel?.style.display === "flex" || scopePanel.style.display === "flex";
                    if (varsPanel) varsPanel.style.display = isOpen ? "none" : "flex";
                    scopePanel.style.display = isOpen ? "none" : "flex";
                    label.chevron.style.transform = isOpen ? "rotate(0deg)" : "rotate(90deg)";
                };
            }

            return { row, varsPanel, scopePanel };
        }

        static createSnippetLabel(snippet, showChevron) {
            const wrapper = document.createElement("div");

            const text = document.createElement("span");
            text.textContent = snippet.name.replace(/[-_]/g, " ");
            text.title = snippet.name;

            const chevron = document.createElement("span");
            chevron.className = "chevron";
            if (showChevron) {
                chevron.innerHTML = "▸";
            }

            wrapper.append(text, chevron);
            return { wrapper, chevron };
        }

        static createScopePanel(snippet) {
            const panel = document.createElement("div");
            panel.className = "scope-panel";

            const enabled = SnippetManager.getEnabled(snippet.name);
            const scopes = SnippetManager.getScopes(snippet.name);

            Object.keys(snippet.scopes).forEach(scopeName => {
                const label = document.createElement("label");

                const text = document.createElement("span");
                text.textContent = scopeName;

                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.dataset.snippet = snippet.name;
                cb.dataset.scope = scopeName;
                cb.checked = enabled && scopes.includes(scopeName);
                
                cb.onclick = (e) => {
                    e.stopPropagation();
                };

                label.append(text, cb);
                panel.appendChild(label);
            });

            return panel;
        }

        static createVarsPanel(snippet) {
            const panel = document.createElement("div");
            panel.className = "snippet-vars-panel";

            Object.entries(snippet.vars).forEach(([varName, meta]) => {
                const row = document.createElement("div");

                const label = document.createElement("span");
                label.textContent = meta.label || varName;

                const input = this.createVarInput(snippet, varName, meta);

                row.append(label, input);
                panel.appendChild(row);
            });

            return panel;
        }

        static createVarInput(snippet, varName, meta) {
            const wrapper = document.createElement("div");

            if (!state.currentTheme || !state.currentScheme) return wrapper;

            const storageKey = state.getKey('snippetVar', state.currentTheme, state.currentScheme, snippet.name, varName);
            let stored = state.get(storageKey);

            if (!stored && meta.default !== undefined) {
                stored = meta.type === "number" ? `${meta.default}${meta.unit || ""}` : meta.default;
            }

            if (meta.options) {
                const select = document.createElement("select");
                select.dataset.varName = varName;

                Object.entries(meta.options).forEach(([label, value]) => {
                    const option = document.createElement("option");
                    option.value = value;
                    option.textContent = label;
                    select.appendChild(option);
                });

                select.value = stored || meta.default || "";

                select.onchange = () => this.handleVarChange(snippet, varName, select.value, storageKey);
                wrapper.appendChild(select);
            } else if (meta.type === "number") {
                const input = document.createElement("input");
                input.type = "number";
                input.dataset.varName = varName;
                input.value = stored ? parseFloat(stored) : meta.default || 0;

                if (meta.min !== undefined) input.min = meta.min;
                if (meta.max !== undefined) input.max = meta.max;
                if (meta.step !== undefined) input.step = meta.step;

                const unit = document.createElement("span");
                unit.textContent = meta.unit || "";

                input.oninput = () => {
                    const val = `${input.value}${meta.unit || ""}`;
                    this.handleVarChange(snippet, varName, val, storageKey);
                };

                wrapper.append(input, unit);
            }

            return wrapper;
        }

        static handleVarChange(snippet, varName, value, storageKey) {
            const oldValue = state.get(storageKey);
            state.set(storageKey, value);

            const enabled = SnippetManager.getEnabled(snippet.name);
            if (enabled) {
                CSSVariableManager.setVar(varName, value);
            }

            window.dispatchEvent(new StorageEvent('storage', {
                key: storageKey,
                oldValue: oldValue,
                newValue: value,
                storageArea: localStorage
            }));
        }

        static createSnippetToggle(snippet, isMultiScope, scopePanel, varsPanel) {
            let toggle;
            const enabled = SnippetManager.getEnabled(snippet.name);

            const updateState = () => {
                if (!state.currentTheme) return;

                const checkboxes = Array.from(scopePanel.querySelectorAll("input[type='checkbox']"));
                const activeScopes = checkboxes.filter(c => c.checked).map(c => c.dataset.scope);
                const isEnabled = activeScopes.length > 0;

                SnippetManager.setEnabled(snippet.name, isEnabled, activeScopes);
                SnippetManager.applyDebounced(snippet, isEnabled, activeScopes);

                if (isMultiScope) {
                    toggle.style.background = isEnabled ? "var(--toggle-track-active)" : "var(--toggle-track)";
                    const circle = toggle.firstChild;
                    if (circle) circle.style.left = isEnabled ? "10px" : "1px";
                } else {
                    toggle.checked = isEnabled;
                }
            };

            scopePanel.addEventListener("change", e => {
                if (e.target.matches("input[type='checkbox']")) {
                    updateState();
                }
            });

            if (isMultiScope) {
                toggle = document.createElement("div");
                toggle.className = "switch-toggle";
                toggle.style.background = enabled ? "var(--toggle-track-active)" : "var(--toggle-track)";

                const circle = document.createElement("div");
                circle.style.left = enabled ? "10px" : "1px";

                toggle.appendChild(circle);

                toggle.onclick = (e) => {
                    e.stopPropagation();
                    
                    const checkboxes = Array.from(scopePanel.querySelectorAll("input[type='checkbox']"));
                    const anyChecked = checkboxes.some(cb => cb.checked);
                    const newState = !anyChecked;
                    
                    checkboxes.forEach(cb => cb.checked = newState);
                    updateState();
                };
            } else {
                toggle = document.createElement("input");
                toggle.type = "checkbox";
                toggle.checked = enabled;

                toggle.onchange = (e) => {
                    e.stopPropagation();
                    
                    scopePanel.querySelectorAll("input[type='checkbox']").forEach(cb => {
                        cb.checked = toggle.checked;
                    });
                    
                    updateState();
                };
            }

            return toggle;
        }
    }

    // =========================================================================
    // DATA LOADER
    // =========================================================================

    class DataLoader {
        static async fetchThemes() {
            try {
                const res = await fetch(`${CONFIG.files.themesJson}?v=${Date.now()}`);
                if (!res.ok) throw new Error("Cannot fetch themes.json");

                const data = await res.json();
                state.themes = data;

                if (!state.themes.length) {
                    state.themes = [{ name: "CMD", file: "CMD", schemes: ["default"] }];
                }
            } catch (err) {
                console.warn("fetchThemes failed", err);
                state.themes = [{ name: "CMD", file: "CMD", schemes: ["default"] }];
            }
        }
        
        static async fetchColorSchemes() {
            try {
                const res = await fetch(`${CONFIG.files.colorSchemesJson}?v=${Date.now()}`);
                if (!res.ok) throw new Error("Cannot fetch color-schemes.json");
                
                state.colorSchemes = await res.json();
            } catch (err) {
                console.warn("fetchColorSchemes failed", err);
                state.colorSchemes = {};
            }
        }

        static async fetchSnippets() {
            try {
                const res = await fetch(`${CONFIG.files.snippetsJson}?v=${Date.now()}`);
                if (!res.ok) throw new Error("Cannot fetch snippets.json");

                const files = await res.json();
                state.snippets = files.filter(f => 
                    typeof f === "string" || (typeof f === "object" && (f.file || f.name))
                );
            } catch (err) {
                console.warn("fetchSnippets failed", err);
                state.snippets = [];
            }
        }
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    class EventHandlers {
        static setupColorInput() {
            document.addEventListener('input', e => {
                if (!e.target.matches('[data-coloris]')) return;

                clearTimeout(state.saveTimeout);

                const varName = e.target.dataset.varName;
                const newValue = e.target.value.trim();

                CSSVariableManager.setVar(varName, newValue);
                ColorisManager.updateInput(e.target, newValue);
                ColorisManager.markModified(e.target, true);
                UIManager.applyDropdownStyles();

                state.saveTimeout = setTimeout(() => {
                    state.setThemeVar(varName, newValue);
                }, 200);
            });
        }

        static setupStorageSync() {
            window.addEventListener("storage", e => {
                const { key, newValue } = e;

                // Theme change
                if (key === state.getKey('theme')) {
                    const newTheme = newValue || "no-theme";
                    if (newTheme !== state.currentTheme) {
                        ThemeManager.apply(newTheme);
                    }
                    return;
                }

                // Color scheme change
                if (key === state.getKey('colorScheme')) {
                    const newScheme = newValue;
                    if (newScheme && newScheme !== state.currentScheme) {
                        ThemeManager.apply(state.currentTheme, newScheme);
                    }
                    return;
                }

                if (!state.currentTheme || !state.currentScheme) return;

                // CSS variable change
                const cssVarPrefix = `cssvar-${state.currentTheme}-${state.currentScheme}-`;
                if (key.startsWith(cssVarPrefix)) {
                    const varName = key.replace(cssVarPrefix, "");
                    
                    if (newValue) {
                        CSSVariableManager.setVar(varName, newValue);
                    } else {
                        const schemeDefault = state.colorSchemes[state.currentTheme]?.[state.currentScheme]?.[varName];
                        if (schemeDefault) {
                            CSSVariableManager.setVar(varName, schemeDefault);
                        } else {
                            const cssDefault = CSSVariableManager.getComputedVar(varName);
                            if (cssDefault) {
                                CSSVariableManager.setVar(varName, cssDefault);
                            }
                        }
                    }

                    requestAnimationFrame(() => {
                        const val = CSSVariableManager.resolveValue(varName);
                        const input = document.querySelector(`input[data-var-name='${varName}']`);
                        if (input) {
                            ColorisManager.resetInput(input, val);
                            ColorisManager.markModified(input, !!newValue);
                        }
                        UIManager.applyDropdownStyles();
                    });
                    return;
                }

                // Snippet changes
                const snippetEnabledPrefix = `snippet-enabled-${state.currentTheme}-${state.currentScheme}-`;
                const snippetScopesPrefix = `snippet-scopes-${state.currentTheme}-${state.currentScheme}-`;
                
                if (key.startsWith(snippetEnabledPrefix) || key.startsWith(snippetScopesPrefix)) {
                    const name = key.replace(snippetEnabledPrefix, "").replace(snippetScopesPrefix, "");
                    const snippet = state.snippets.find(s => 
                        SnippetManager.normalizeSnippet(s).name === name
                    );

                    if (snippet) {
                        const norm = SnippetManager.normalizeSnippet(snippet);
                        const enabled = SnippetManager.getEnabled(norm.name);
                        const scopes = SnippetManager.getScopes(norm.name);
                        SnippetManager.apply(norm, enabled, scopes);
                        
                        const row = [...document.querySelectorAll(".snippet-toggle-row")]
                            .find(r => r.querySelector("span")?.title === name);
                        
                        if (row) {
                            const toggle = row.querySelector(".switch-toggle, input[type='checkbox']");
                            const scopePanel = row.nextElementSibling?.classList.contains('scope-panel') 
                                ? row.nextElementSibling 
                                : row.nextElementSibling?.nextElementSibling;
                            
                            if (toggle) {
                                if (toggle.classList.contains("switch-toggle")) {
                                    toggle.firstChild.style.left = enabled ? "10px" : "1px";
                                    toggle.style.background = enabled 
                                        ? "var(--toggle-track-active)" 
                                        : "var(--toggle-track)";
                                } else {
                                    toggle.checked = enabled;
                                }
                            }
                            
                            if (scopePanel && scopePanel.classList.contains('scope-panel')) {
                                scopePanel.querySelectorAll("input[type='checkbox']").forEach(cb => {
                                    cb.checked = enabled && scopes.includes(cb.dataset.scope);
                                });
                            }
                        }
                        
                        UIManager.applyDropdownStyles();
                    }
                    return;
                }

                // Snippet variable changes
                const snippetVarPrefix = `snippet-var-${state.currentTheme}-${state.currentScheme}-`;
                if (key.startsWith(snippetVarPrefix)) {
                    const remainder = key.replace(snippetVarPrefix, '');
                    
                    let snippetName = null;
                    let varName = null;
                    
                    for (const s of state.snippets) {
                        const norm = SnippetManager.normalizeSnippet(s);
                        if (remainder.startsWith(norm.name + '-')) {
                            snippetName = norm.name;
                            varName = remainder.substring(norm.name.length + 1);
                            break;
                        }
                    }
                    
                    if (!snippetName || !varName || !newValue) return;
                    
                    if (SnippetManager.getEnabled(snippetName)) {
                        CSSVariableManager.setVar(varName, newValue);
                    }
                    
                    const row = [...document.querySelectorAll('.snippet-toggle-row')]
                        .find(r => r.querySelector('span')?.title === snippetName);
                    
                    if (row) {
                        let varsPanel = row.nextElementSibling;
                        if (varsPanel?.classList.contains('snippet-vars-panel')) {
                            const input = varsPanel.querySelector(`input[data-var-name='${varName}'], select[data-var-name='${varName}']`);
                            if (input) {
                                if (input.tagName === 'SELECT') {
                                    input.value = newValue;
                                } else if (input.type === 'number') {
                                    const numValue = parseFloat(newValue);
                                    if (!isNaN(numValue)) {
                                        input.value = numValue;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        static setupResetButton() {
            const resetBtn = state.getElement('resetBtn', '#theme-reset-modified');
            if (!resetBtn) return;

            resetBtn.onclick = () => {
                if (!state.currentTheme || !state.currentScheme) return;

                state.suppressSave = true;

                CONFIG.editableVars.forEach(v => {
                    const key = state.getKey('cssVar', state.currentTheme, state.currentScheme, v.name);
                    const oldValue = state.get(key);
                    state.removeThemeVar(v.name);
                    
                    const schemeDefault = state.colorSchemes[state.currentTheme]?.[state.currentScheme]?.[v.name];
                    
                    if (schemeDefault) {
                        CSSVariableManager.setVar(v.name, schemeDefault);
                    } else {
                        const cssDefault = CSSVariableManager.getComputedVar(v.name);
                        if (cssDefault) {
                            CSSVariableManager.setVar(v.name, cssDefault);
                        }
                    }

                    const input = document.querySelector(`input[data-var-name='${v.name}']`);
                    if (input) {
                        const val = CSSVariableManager.resolveValue(v.name);
                        ColorisManager.updateInput(input, val);
                        ColorisManager.markModified(input, false);
                    }
                    
                    window.dispatchEvent(new StorageEvent('storage', {
                        key: key,
                        oldValue: oldValue,
                        newValue: null,
                        storageArea: localStorage
                    }));
                });

                state.suppressSave = false;
                
                document.body.offsetHeight;
                requestAnimationFrame(() => {
                    UIManager.applyDropdownStyles();
                });
            };
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    async function createUI(navbar) {
        const container = document.createElement("div");
        container.style.position = "relative";

        const button = document.createElement("button");
        button.id = "theme-switcher-button";
        button.className = "btn btn-primary minimal d-flex align-items-center h-100";
        button.textContent = "Themes";

        const panel = UIManager.createDropdownPanel();
        UIManager.createThemeOptions(panel);

        const colorSection = createColorSection();
        panel.appendChild(colorSection.collapseBtn);
        panel.appendChild(colorSection.container);
        panel.appendChild(document.createElement("hr"));

        const snippetSection = createSnippetSection();
        panel.appendChild(snippetSection.collapseBtn);
        panel.appendChild(snippetSection.container);

        container.append(button, panel);
        navbar.querySelector(".navbar-buttons")?.appendChild(container);

        button.addEventListener("click", e => {
            e.stopPropagation();
            state.dropdownOpen = !state.dropdownOpen;
            panel.style.display = state.dropdownOpen ? "block" : "none";
        });

        document.addEventListener("pointerdown", e => {
            const picker = document.querySelector(".clr-picker");
            if (!panel.contains(e.target) && 
                !button.contains(e.target) && 
                (!picker || !picker.contains(e.target))) {
                state.dropdownOpen = false;
                panel.style.display = "none";
            }
        });
    }

    function createColorSection() {
        const collapseBtn = document.createElement("button");
        collapseBtn.id = "theme-collapse-btn";
        collapseBtn.textContent = "Custom Colors";

        const container = document.createElement("div");
        container.className = "color-container";

        CONFIG.editableVars.forEach(v => {
            const row = document.createElement("div");
            row.dataset.varName = v.name;

            const label = document.createElement("span");
            label.textContent = v.label || v.name;

            const input = document.createElement("input");
            input.type = "text";
            input.dataset.varName = v.name;
            input.setAttribute("data-coloris", "");
            input.classList.add("coloris-input");

            const revertBtn = document.createElement("button");
            revertBtn.textContent = "↺";
            revertBtn.classList.add("color-reset-btn");
            revertBtn.onclick = () => {
                if (!state.currentTheme || !state.currentScheme) return;
                
                state.removeThemeVar(v.name);
                
                const schemeDefault = state.colorSchemes[state.currentTheme]?.[state.currentScheme]?.[v.name];
                
                if (schemeDefault) {
                    CSSVariableManager.setVar(v.name, schemeDefault);
                    ColorisManager.updateInput(input, schemeDefault);
                } else {
                    const cssDefault = CSSVariableManager.getComputedVar(v.name);
                    if (cssDefault) {
                        CSSVariableManager.setVar(v.name, cssDefault);
                        ColorisManager.updateInput(input, cssDefault);
                    }
                }
                
                ColorisManager.markModified(input, false);
                
                const key = state.getKey('cssVar', state.currentTheme, state.currentScheme, v.name);
                window.dispatchEvent(new StorageEvent('storage', {
                    key: key,
                    oldValue: state.get(key),
                    newValue: null,
                    storageArea: localStorage
                }));
                
                document.body.offsetHeight;
                requestAnimationFrame(() => {
                    UIManager.applyDropdownStyles();
                });
            };

            const right = document.createElement("div");
            right.append(input, revertBtn);

            row.append(label, right);
            container.appendChild(row);
        });

        const resetBtn = document.createElement("button");
        resetBtn.id = "theme-reset-modified";
        resetBtn.textContent = "Reset All Modified";
        container.appendChild(resetBtn);

        collapseBtn.onclick = () => {
            container.style.display = container.style.display === "block" ? "none" : "block";
        };

        return { collapseBtn, container };
    }

    function createSnippetSection() {
        const collapseBtn = document.createElement("button");
        collapseBtn.id = "snippets-collapse-btn";
        collapseBtn.textContent = "CSS Snippets";

        const container = document.createElement("div");
        container.className = "snippet-container";

        collapseBtn.onclick = () => {
            container.style.display = container.style.display === "block" ? "none" : "block";
        };

        return { collapseBtn, container };
    }

    // =========================================================================
    // MAIN INITIALIZATION
    // =========================================================================

    while (!window.csLib) {
        await new Promise(r => setTimeout(r, 100));
    }

    EventHandlers.setupColorInput();
    EventHandlers.setupStorageSync();

    const themesPromise = DataLoader.fetchThemes();
    const colorSchemesPromise = DataLoader.fetchColorSchemes();
    const snippetsPromise = DataLoader.fetchSnippets();

    const observer = new MutationObserver(async (mutations, obs) => {
        const navbar = document.querySelector(".top-nav");
        if (navbar) {
            obs.disconnect();
            
            await Promise.all([themesPromise, colorSchemesPromise]);
            
            await createUI(navbar);
            EventHandlers.setupResetButton();
            
            const savedTheme = state.get(state.getKey('theme')) || state.themes[0]?.name;
            const savedScheme = state.get(state.getKey('colorScheme'));
            await ThemeManager.apply(savedTheme, savedScheme);
            
            snippetsPromise.then(() => {
                const buildUI = () => {
                    UIManager.buildSnippetUI();
                    UIManager.applyDropdownStyles();
                };
                
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(buildUI, { timeout: 2000 });
                } else {
                    setTimeout(buildUI, 0);
                }
            });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();