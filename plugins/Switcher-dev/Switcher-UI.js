(async () => {
    // Import globals from core
    const { 
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
    } = window.ThemeSwitcherCore;

    // =========================================================================
    // UI MANAGER - BEM-BASED UI CONSTRUCTION
    // =========================================================================

    class UIManager {
        // Create main dropdown panel
        static createDropdownPanel() {
            const panel = document.createElement("div");
            panel.className = "theme-switcher__panel";
            panel.setAttribute('data-open', 'false');
            return panel;
        }

        // Create theme options list
        static createThemeOptions(panel) {
            const optionsList = document.createElement('ul');
            optionsList.className = 'theme-switcher__options';
            
            // Default theme
            const defaultItem = this.createThemeOption("Default", "no-theme", null);
            defaultItem.addEventListener('click', () => {
                // Collapse all scheme lists
                panel.querySelectorAll('.theme-switcher__schemes').forEach(schemes => {
                    schemes.setAttribute('data-expanded', 'false');
                });
            });
            optionsList.appendChild(defaultItem);

            // Check if themes loaded
            if (!state.themes || state.themes.length === 0) {
                const loading = document.createElement("li");
                loading.className = 'theme-switcher__option';
                loading.textContent = "Loading themes...";
                loading.style.opacity = "0.7";
                optionsList.appendChild(loading);
                panel.appendChild(optionsList);
                return;
            }

            // Create theme items with nested schemes
            state.themes.forEach(theme => {
                const themeItem = this.createThemeOption(theme.name, theme.name, theme.name);
                themeItem.classList.add('theme-switcher__option--main');
                themeItem.setAttribute('data-theme-family', theme.name);
                optionsList.appendChild(themeItem);

                // Create nested schemes list
                const schemesList = document.createElement('ul');
                schemesList.className = 'theme-switcher__schemes';
                schemesList.setAttribute('data-theme-family', theme.name);
                schemesList.setAttribute('data-expanded', 'false');

                theme.schemes.forEach(schemeName => {
                    if (schemeName === theme.name) return; // Skip matching scheme
                    
                    const schemeItem = this.createThemeOption(
                        `${schemeName.charAt(0).toUpperCase()}${schemeName.slice(1)}`,
                        theme.name,
                        schemeName
                    );
                    schemeItem.classList.add('theme-switcher__scheme');
                    schemesList.appendChild(schemeItem);
                });

                optionsList.appendChild(schemesList);

                // Theme click handler - apply and toggle schemes
                themeItem.addEventListener('click', async (e) => {
                    await ThemeManager.apply(theme.name, theme.name);
                    
                    const isExpanded = schemesList.getAttribute('data-expanded') === 'true';
                    
                    // Collapse all other scheme lists
                    panel.querySelectorAll('.theme-switcher__schemes').forEach(other => {
                        if (other !== schemesList) {
                            other.setAttribute('data-expanded', 'false');
                        }
                    });
                    
                    // Toggle this one
                    schemesList.setAttribute('data-expanded', (!isExpanded).toString());
                });

                // Scheme click handlers
                schemesList.querySelectorAll('.theme-switcher__scheme').forEach(schemeEl => {
                    schemeEl.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const clickedScheme = schemeEl.getAttribute('data-scheme');
                        await ThemeManager.switchScheme(clickedScheme);
                    });
                });
            });

            panel.appendChild(optionsList);
        }

        // Create a single theme option
        static createThemeOption(label, themeName, schemeName) {
            const item = document.createElement("li");
            item.className = 'theme-switcher__option';
            item.textContent = label;
            item.setAttribute('data-theme', themeName);
            if (schemeName) item.setAttribute('data-scheme', schemeName);

            if (themeName === "no-theme") {
                item.addEventListener('click', () => ThemeManager.applyNoTheme());
            }

            return item;
        }

        // Create collapsible section
        static createSection(title, id, modifier = '') {
            const section = document.createElement('div');
            section.className = `theme-switcher__section${modifier ? ' theme-switcher__section--' + modifier : ''}`;
            
            const header = document.createElement('button');
            header.className = 'theme-switcher__section-header';
            header.textContent = title;
            header.setAttribute('data-expanded', 'false');
            header.setAttribute('aria-expanded', 'false');
            header.setAttribute('aria-controls', `${id}-content`);
            
            const content = document.createElement('div');
            content.className = 'theme-switcher__section-content';
            content.id = `${id}-content`;
            content.setAttribute('data-expanded', 'false');
            
            header.addEventListener('click', () => {
                this.toggleSection(header, content);
            });
            
            section.appendChild(header);
            section.appendChild(content);
            
            return { section, header, content };
        }

        // Toggle section expansion
        static toggleSection(header, content) {
            const isExpanded = header.getAttribute('data-expanded') === 'true';
            const newState = !isExpanded;
            
            header.setAttribute('data-expanded', newState.toString());
            header.setAttribute('aria-expanded', newState.toString());
            content.setAttribute('data-expanded', newState.toString());
        }

        // Create color section
        static createColorSection() {
            const { section, content } = this.createSection('Custom Colors', 'colors', 'colors');
            
            const colorsWrapper = document.createElement('div');
            colorsWrapper.className = 'theme-switcher__colors';
            
            CONFIG.editableVars.forEach(varConfig => {
                const row = this.createColorRow(varConfig);
                colorsWrapper.appendChild(row);
            });
            
            const resetAllBtn = document.createElement('button');
            resetAllBtn.className = 'theme-switcher__reset-all';
            resetAllBtn.textContent = 'Reset All Modified';
            resetAllBtn.addEventListener('click', () => EventHandlers.handleResetAllColors());
            colorsWrapper.appendChild(resetAllBtn);
            
            content.appendChild(colorsWrapper);
            
            return section;
        }

        // Create color row
        static createColorRow(varConfig) {
            const row = document.createElement('div');
            row.className = 'theme-switcher__color-row';
            row.setAttribute('data-var-name', varConfig.name);
            row.setAttribute('data-modified', 'false');

            const label = document.createElement('span');
            label.className = 'theme-switcher__color-label';
            label.textContent = varConfig.label || varConfig.name;

            const controls = document.createElement('div');
            controls.className = 'theme-switcher__color-controls';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'theme-switcher__color-input';
            input.setAttribute('data-coloris', '');
            input.dataset.varName = varConfig.name;

            const resetBtn = document.createElement('button');
            resetBtn.className = 'theme-switcher__color-reset';
            resetBtn.textContent = '↺';
            resetBtn.title = 'Reset to default';
            resetBtn.addEventListener('click', async () => {
                await EventHandlers.handleColorReset(varConfig.name, input);
            });

            controls.appendChild(input);
            controls.appendChild(resetBtn);

            row.appendChild(label);
            row.appendChild(controls);

            return row;
        }

        // Create snippets section
        static createSnippetsSection() {
            const { section, content } = this.createSection('CSS Snippets', 'snippets', 'snippets');
            
            const snippetsWrapper = document.createElement('div');
            snippetsWrapper.className = 'theme-switcher__snippets';
            
            content.appendChild(snippetsWrapper);
            
            return section;
        }

        // Build snippet UI dynamically
        static buildSnippetUI() {
            state.clearElementCache();
            const container = document.querySelector('.theme-switcher__snippets');
            if (!container) {
                console.warn('Snippet container not found');
                return;
            }

            container.innerHTML = "";

            if (!state.snippets.length) {
                container.innerHTML = '<div style="opacity: 0.7; padding: 8px;">No snippets found</div>';
                return;
            }

            const fragment = document.createDocumentFragment();

            state.snippets.forEach(raw => {
                const snippet = SnippetManager.normalizeSnippet(raw);
                
                // Skip if normalization failed
                if (!snippet) {
                    return;
                }
                
                const snippetEl = this.createSnippet(snippet);
                fragment.appendChild(snippetEl);
            });

            // Disable all button
            const disableBtn = document.createElement("button");
            disableBtn.className = "theme-switcher__disable-all";
            disableBtn.textContent = "Disable All Snippets";
            disableBtn.addEventListener('click', async () => {
                await SnippetManager.disableAll();
                this.buildSnippetUI();
                this.applyDropdownStyles();
            });
            fragment.appendChild(disableBtn);

            container.appendChild(fragment);
        }

        // Create a snippet element
        static createSnippet(snippet) {
            const hasScopes = Object.keys(snippet.scopes).length > 1;
            const hasVars = snippet.vars && Object.keys(snippet.vars).length > 0;
            const hasOptions = hasVars || hasScopes;

            const container = document.createElement('div');
            container.className = 'theme-switcher__snippet';
            container.setAttribute('data-snippet-id', snippet.name);
            
            // Header
            const header = document.createElement('div');
            header.className = 'theme-switcher__snippet-header';
            
            const info = document.createElement('div');
            info.className = 'theme-switcher__snippet-info';
            
            // Name - use the actual snippet name from the data
            const name = document.createElement('span');
            name.className = 'theme-switcher__snippet-name';
            // Display the name with better formatting (replace dashes/underscores with spaces and capitalize)
            const displayName = snippet.name
                .replace(/[-_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            name.textContent = displayName;
            name.title = snippet.name; // Keep original as tooltip
            info.appendChild(name);
            
            // Chevron
            let chevron = null;
            if (hasOptions) {
                chevron = document.createElement('span');
                chevron.className = 'theme-switcher__snippet-chevron';
                chevron.textContent = '▸';
                chevron.setAttribute('data-expanded', 'false');
                info.appendChild(chevron);
            }
            
            header.appendChild(info);
            
            // Toggle switch (on the far right)
            const enabled = SnippetManager.getEnabled(snippet.name);
            const toggle = this.createSnippetToggle(snippet, enabled, hasScopes);
            header.appendChild(toggle);
            
            container.appendChild(header);
            
            // Expandable panels
            if (hasOptions) {
                const panelsContainer = document.createElement('div');
                panelsContainer.className = 'theme-switcher__snippet-panel';
                panelsContainer.setAttribute('data-expanded', 'false');
                
                if (hasScopes) {
                    const scopePanel = this.createScopePanel(snippet);
                    panelsContainer.appendChild(scopePanel);
                }
                
                if (hasVars) {
                    const varsPanel = this.createVarsPanel(snippet);
                    panelsContainer.appendChild(varsPanel);
                }
                
                container.appendChild(panelsContainer);
                
                // Click to expand
                header.addEventListener('click', (e) => {
                    if (e.target.closest('.theme-switcher__toggle')) return;
                    
                    const isExpanded = panelsContainer.getAttribute('data-expanded') === 'true';
                    panelsContainer.setAttribute('data-expanded', (!isExpanded).toString());
                    if (chevron) {
                        chevron.setAttribute('data-expanded', (!isExpanded).toString());
                    }
                });
            }
            
            return container;
        }

        // Create snippet toggle switch
        static createSnippetToggle(snippet, enabled, isMultiScope) {
            let toggle;
            
            if (isMultiScope) {
                toggle = document.createElement('div');
                toggle.className = 'theme-switcher__toggle';
                toggle.setAttribute('data-active', enabled.toString());
                toggle.setAttribute('data-snippet-id', snippet.name);

                const thumb = document.createElement('div');
                thumb.className = 'theme-switcher__toggle-thumb';
                toggle.appendChild(thumb);

                toggle.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    const snippetContainer = document.querySelector(
                        `.theme-switcher__snippet[data-snippet-id="${snippet.name}"]`
                    );
                    if (!snippetContainer) return;
                    
                    const scopePanel = snippetContainer.querySelector('.theme-switcher__scope-panel');
                    const checkboxes = scopePanel.querySelectorAll('input[type="checkbox"]');
                    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
                    const newState = !anyChecked;
                    
                    // Toggle all checkboxes
                    checkboxes.forEach(cb => cb.checked = newState);
                    
                    // Gather selected scopes
                    const selectedScopes = newState ? Array.from(checkboxes).map(cb => cb.dataset.scope) : [];
                    
                    // Update storage and apply
                    await SnippetManager.setEnabled(snippet.name, newState);
                    await SnippetManager.setScopes(snippet.name, selectedScopes);
                    await SnippetManager.apply(snippet, newState, selectedScopes);
                    
                    // Update toggle visual state
                    toggle.setAttribute('data-active', newState.toString());
                });
            } else {
                // Single scope - use checkbox
                toggle = document.createElement('input');
                toggle.type = 'checkbox';
                toggle.className = 'theme-switcher__toggle-checkbox';
                toggle.checked = enabled;

                toggle.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    
                    const snippetContainer = document.querySelector(
                        `.theme-switcher__snippet[data-snippet-id="${snippet.name}"]`
                    );
                    if (!snippetContainer) return;
                    
                    const scopePanel = snippetContainer.querySelector('.theme-switcher__scope-panel');
                    if (scopePanel) {
                        const checkboxes = scopePanel.querySelectorAll('input[type="checkbox"]');
                        
                        // Update all scope checkboxes
                        checkboxes.forEach(cb => cb.checked = toggle.checked);
                        
                        // Gather selected scopes
                        const selectedScopes = toggle.checked 
                            ? Array.from(checkboxes).map(cb => cb.dataset.scope)
                            : [];
                        
                        // Update storage and apply
                        await SnippetManager.setEnabled(snippet.name, toggle.checked);
                        await SnippetManager.setScopes(snippet.name, selectedScopes);
                        await SnippetManager.apply(snippet, toggle.checked, selectedScopes);
                    } else {
                        // No scope panel - just use default scope
                        const defaultScope = Object.keys(snippet.scopes)[0] || 'all';
                        const selectedScopes = toggle.checked ? [defaultScope] : [];
                        
                        // Update storage and apply
                        await SnippetManager.setEnabled(snippet.name, toggle.checked);
                        await SnippetManager.setScopes(snippet.name, selectedScopes);
                        await SnippetManager.apply(snippet, toggle.checked, selectedScopes);
                    }
                });
            }

            return toggle;
        }

        // Create scope selection panel
        static createScopePanel(snippet) {
            const panel = document.createElement('div');
            panel.className = 'theme-switcher__scope-panel';
            
            const enabled = SnippetManager.getEnabled(snippet.name);
            const scopes = SnippetManager.getScopes(snippet.name);

            Object.keys(snippet.scopes).forEach(scopeName => {
                const label = document.createElement('label');
                label.className = 'theme-switcher__scope-option';

                const text = document.createElement('span');
                text.className = 'theme-switcher__scope-label';
                text.textContent = scopeName;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'theme-switcher__scope-checkbox';
                checkbox.dataset.snippet = snippet.name;
                checkbox.dataset.scope = scopeName;
                checkbox.checked = enabled && scopes.includes(scopeName);
                
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                });

                checkbox.addEventListener('change', async () => {
                    // Gather all checked scopes
                    const snippetContainer = document.querySelector(
                        `.theme-switcher__snippet[data-snippet-id="${snippet.name}"]`
                    );
                    if (!snippetContainer) return;
                    
                    const scopePanel = snippetContainer.querySelector('.theme-switcher__scope-panel');
                    const allCheckboxes = scopePanel.querySelectorAll('input[type="checkbox"]');
                    const selectedScopes = Array.from(allCheckboxes)
                        .filter(cb => cb.checked)
                        .map(cb => cb.dataset.scope);
                    
                    const newEnabled = selectedScopes.length > 0;
                    
                    // Update storage and apply
                    await SnippetManager.setEnabled(snippet.name, newEnabled);
                    await SnippetManager.setScopes(snippet.name, selectedScopes);
                    await SnippetManager.apply(snippet, newEnabled, selectedScopes);
                    
                    // Update toggle visual state
                    const toggle = snippetContainer.querySelector('.theme-switcher__toggle');
                    if (toggle) {
                        toggle.setAttribute('data-active', newEnabled.toString());
                    }
                });

                label.appendChild(text);
                label.appendChild(checkbox);
                panel.appendChild(label);
            });

            return panel;
        }

        // Create variables panel
        static createVarsPanel(snippet) {
            const panel = document.createElement('div');
            panel.className = 'theme-switcher__vars-panel';

            Object.entries(snippet.vars).forEach(([varName, meta]) => {
                const row = document.createElement('div');
                row.className = 'theme-switcher__var-row';

                const label = document.createElement('span');
                label.className = 'theme-switcher__var-label';
                label.textContent = meta.label || varName;

                const controls = document.createElement('div');
                controls.className = 'theme-switcher__var-controls';

                const input = this.createVarInput(snippet, varName, meta);
                controls.appendChild(input);

                row.appendChild(label);
                row.appendChild(controls);
                panel.appendChild(row);
            });

            return panel;
        }

        // Create variable input
        static createVarInput(snippet, varName, meta) {
            if (!state.currentTheme || !state.currentScheme) {
                return document.createElement('div');
            }

            const key = state.getKey('snippetVar', state.currentTheme, state.currentScheme, snippet.name, varName);
            let savedValue = state.get(key);

            let input;
            if (meta.type === 'select') {
                input = document.createElement('select');
                input.className = 'theme-switcher__var-select';
                meta.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    input.appendChild(option);
                });
                input.value = savedValue || meta.default || meta.options[0];
            } else {
                input = document.createElement('input');
                input.type = meta.type || 'number';
                input.className = 'theme-switcher__var-input';
                
                if (savedValue) {
                    input.value = savedValue.replace(meta.unit || '', '');
                } else {
                    input.value = meta.default !== undefined ? meta.default : '';
                }
            }

            input.addEventListener('change', async () => {
                let value = input.value;
                if (meta.type === 'number' && meta.unit) {
                    value = `${value}${meta.unit}`;
                }
                
                await SnippetManager.setVar(snippet.name, varName, value);
                CSSVariableManager.setVar(varName, value);
            });

            return input;
        }

        // Create divider
        static createDivider() {
            const divider = document.createElement('hr');
            divider.className = 'theme-switcher__divider';
            return divider;
        }

        // Highlight active theme
        static highlightActiveTheme(themeName) {
            document.querySelectorAll('.theme-switcher__option--main').forEach(el => {
                const isActive = el.getAttribute('data-theme') === themeName;
                el.setAttribute('data-active', isActive.toString());
            });
        }

        // Highlight active scheme
        static highlightActiveScheme(schemeName) {
            document.querySelectorAll('.theme-switcher__scheme').forEach(el => {
                const isActive = el.getAttribute('data-scheme') === schemeName;
                el.setAttribute('data-active', isActive.toString());
            });

            // Auto-expand schemes container if current scheme is not the theme name
            if (state.currentTheme && state.currentScheme && state.currentScheme !== state.currentTheme) {
                const container = document.querySelector(
                    `.theme-switcher__schemes[data-theme-family="${state.currentTheme}"]`
                );
                if (container) {
                    container.setAttribute('data-expanded', 'true');
                }
            }
        }

        // Update button label
        static updateButtonLabel(text) {
            const btn = document.getElementById('theme-switcher-button');
            if (btn) btn.textContent = text;
        }

        // Update all color inputs
        static updateAllColorInputs() {
            for (const v of CONFIG.editableVars) {
                const input = document.querySelector(`.theme-switcher__color-input[data-var-name='${v.name}']`);
                if (input) {
                    const val = CSSVariableManager.resolveValue(v.name);
                    const saved = state.getThemeVar(v.name);
                    
                    ColorisManager.resetInput(input, val);
                    
                    setTimeout(() => {
                        const updatedInput = document.querySelector(
                            `.theme-switcher__color-input[data-var-name='${v.name}']`
                        );
                        if (updatedInput) {
                            ColorisManager.markModified(updatedInput, !!saved);
                        }
                    }, 50);
                }
            }
        }

        // Apply dropdown styles (dynamic theming)
        static applyDropdownStyles() {
            const panel = document.querySelector('.theme-switcher__panel');
            const button = document.getElementById('theme-switcher-button');
            if (!panel || !button) return;
            
            const isNoTheme = !state.currentTheme || state.currentTheme === 'no-theme';
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
            
            panel.querySelectorAll('.theme-switcher__option').forEach(item => {
                item.style.color = colors.text;
                item.onmouseenter = () => item.style.background = colors.hoverBg;
                item.onmouseleave = () => item.style.background = "transparent";
                item.addEventListener('click', () => {
                    setTimeout(() => {
                        item.style.background = "transparent";
                    }, 0);
                });
            });
            
            document.querySelectorAll('.theme-switcher__color-input').forEach(inp => {
                inp.style.outline = `2px solid ${colors.accent}22`;
            });
        }

        // Show/hide theme-specific elements
        static hideThemeElements() {
            const colorSection = document.querySelector('.theme-switcher__section--colors');
            if (colorSection) colorSection.style.display = 'none';
            
            const snippetSection = document.querySelector('.theme-switcher__section--snippets');
            if (snippetSection) snippetSection.style.display = 'none';

            const separators = document.querySelectorAll('.theme-switcher__panel .theme-switcher__divider');
            separators.forEach(hr => hr.style.display = 'none');
        }

        static showThemeElements() {
            const colorSection = document.querySelector('.theme-switcher__section--colors');
            if (colorSection) colorSection.style.display = 'block';
            
            const snippetSection = document.querySelector('.theme-switcher__section--snippets');
            if (snippetSection) snippetSection.style.display = 'block';
            
            const separators = document.querySelectorAll('.theme-switcher__panel .theme-switcher__divider');
            separators.forEach(hr => hr.style.display = 'block');
        }
    }

    // =========================================================================
    // UI CREATION
    // =========================================================================

    async function createUI(navbar) {
        const container = document.createElement("div");
        container.className = "theme-switcher";

        const button = document.createElement("button");
        button.id = "theme-switcher-button";
        button.className = "btn btn-primary minimal d-flex align-items-center h-100";
        button.textContent = "Themes";

        const panel = UIManager.createDropdownPanel();
        UIManager.createThemeOptions(panel);

        panel.appendChild(UIManager.createDivider());

        const colorSection = UIManager.createColorSection();
        panel.appendChild(colorSection);

        panel.appendChild(UIManager.createDivider());

        const snippetSection = UIManager.createSnippetsSection();
        panel.appendChild(snippetSection);

        container.appendChild(button);
        container.appendChild(panel);
        navbar.querySelector(".navbar-buttons")?.appendChild(container);

        button.addEventListener("click", e => {
            e.stopPropagation();
            const isOpen = panel.getAttribute('data-open') === 'true';
            panel.setAttribute('data-open', (!isOpen).toString());
        });

        document.addEventListener("pointerdown", e => {
            const picker = document.querySelector(".clr-picker");
            if (!panel.contains(e.target) && 
                !button.contains(e.target) && 
                (!picker || !picker.contains(e.target))) {
                panel.setAttribute('data-open', 'false');
            }
        });
    }

    // =========================================================================
    // MAIN INITIALIZATION
    // =========================================================================

    console.log('[Switcher] Starting UI initialization...');

    while (!window.csLib) {
        await new Promise(r => setTimeout(r, 100));
    }
    console.log('[Switcher] csLib loaded');

    await storage.initialize();
    console.log('[Switcher] Storage initialized');

    UIController.initialize();

    EventHandlers.setupColorInput();

    const themesPromise = DataLoader.fetchThemes();
    const colorSchemesPromise = DataLoader.fetchColorSchemes();
    const snippetsPromise = DataLoader.fetchSnippets();

    csLib.waitForElement(".top-nav", async (navbar) => {
        console.log('[Switcher] Navbar found');
        
        await Promise.all([themesPromise, colorSchemesPromise]);
        console.log('[Switcher] Themes and color schemes loaded');
        
        if (!state.themes || state.themes.length === 0) {
            console.error('[Switcher] No themes loaded! Check themes.json file.');
            return;
        }
        
        await createUI(navbar);
        await ColorisManager.initialize();
        
        EventHandlers.setupResetButton();
        
        const savedTheme = state.get(state.getKey('theme'));
        const savedScheme = state.get(state.getKey('colorScheme'));
        const themeToApply = savedTheme || state.themes[0]?.name;
        
        if (themeToApply) {
            console.log('[Switcher] Applying theme:', themeToApply);
            await ThemeManager.apply(themeToApply, savedScheme);
        } else {
            console.error('[Switcher] No theme to apply!');
        }
        
        snippetsPromise.then(async () => {
            console.log('[Switcher] Building snippet UI');
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

        console.log('[Switcher] Initialization complete');
    });

    // Export UIManager globally for access from core
    window.UIManager = UIManager;
})();