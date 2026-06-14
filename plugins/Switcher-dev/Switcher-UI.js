(async () => {
    // Import globals from core
    const {
        CONFIG,
        storage,
        state,
        CSSVariableManager,
        ColorisManager,
        DataLoader,
        SwatchPinManager,
        ThemeManager,
        SnippetManager,
        FavoritesManager,
        UIController,
        EventHandlers,
        crossTabSync
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

        // Update pin button for a single row based on its current input value
        static updatePinState(varName) {
            const row = document.querySelector(`.theme-switcher__color-row[data-var-name='${varName}']`);
            if (!row) return;
            const input = row.querySelector('.theme-switcher__color-input');
            const pinBtn = row.querySelector('.theme-switcher__color-pin');
            if (!input || !pinBtn) return;

            const color = input.value || CSSVariableManager.resolveValue(varName);
            const pinned = color ? SwatchPinManager.isColorPinned(color) : false;
            pinBtn.setAttribute('data-pinned', pinned.toString());
            pinBtn.title = pinned ? 'Unpin from color picker swatches' : 'Pin to color picker swatches';

            // The CSS gates pin visibility on [data-modified="true"], but a pinned color
            // should surface even on unmodified vars (e.g. --rating-color-20 following --accent).
            // When pinned, override visibility inline; when not, let CSS take back control.
            if (pinned) {
                pinBtn.style.visibility = 'visible';
                pinBtn.style.pointerEvents = 'auto';
            } else {
                pinBtn.style.removeProperty('visibility');
                pinBtn.style.removeProperty('pointer-events');
            }
        }

        // Refresh pin state for all rows (e.g. after pin/unpin, since two vars can share a value)
        static refreshAllPinStates() {
            CONFIG.editableVars.forEach(v => this.updatePinState(v.name));
            CONFIG.globalVarGroups.flatMap(g => g.vars).forEach(v => this.updatePinState(v.name));
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

            CONFIG.globalVarGroups.forEach(group => {
                colorsWrapper.appendChild(this.createVarGroup(group));
            });

            // Separator shown only when snippets are pinned into this section
            const pinnedSeparator = document.createElement('hr');
            pinnedSeparator.className = 'theme-switcher__pinned-separator';
            pinnedSeparator.style.display = 'none';
            colorsWrapper.appendChild(pinnedSeparator);

            const pinnedArea = document.createElement('div');
            pinnedArea.className = 'theme-switcher__pinned-snippets';
            colorsWrapper.appendChild(pinnedArea);

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

            const pinBtn = document.createElement('button');
            pinBtn.className = 'theme-switcher__color-pin';
            pinBtn.textContent = '🖈';
            pinBtn.setAttribute('data-pinned', 'false');
            pinBtn.title = 'Pin to color picker swatches';
            pinBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                // input.value is always a concrete hex now (global vars are initialised
                // from JSON defaults, never left as raw var() strings)
                const color = input.value || CSSVariableManager.resolveValue(varConfig.name);
                if (!color) return;
                if (SwatchPinManager.isColorPinned(color)) {
                    await SwatchPinManager.unpin(color);
                } else {
                    await SwatchPinManager.pin(color);
                }
                ColorisManager.updateSwatches();
                // Re-evaluate pin state for ALL rows (another var may share the same value)
                UIManager.refreshAllPinStates();
            });

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

            controls.appendChild(pinBtn);
            controls.appendChild(input);
            controls.appendChild(resetBtn);

            row.appendChild(label);
            row.appendChild(controls);

            return row;
        }

        static createVarGroup(groupDef) {
            const group = document.createElement('div');
            group.className = 'theme-switcher__rating-colors-group';

            const header = document.createElement('div');
            header.className = 'theme-switcher__snippet-header theme-switcher__rating-colors-header';

            const info = document.createElement('div');
            info.className = 'theme-switcher__snippet-info';

            const name = document.createElement('span');
            name.className = 'theme-switcher__snippet-name';
            name.textContent = groupDef.label;
            info.appendChild(name);

            const chevron = document.createElement('span');
            chevron.className = 'theme-switcher__snippet-chevron';
            chevron.textContent = '▸';
            chevron.setAttribute('data-expanded', 'false');
            info.appendChild(chevron);

            header.appendChild(info);
            group.appendChild(header);

            const panel = document.createElement('div');
            panel.className = 'theme-switcher__snippet-panel theme-switcher__rating-colors-panel';
            panel.setAttribute('data-expanded', 'false');

            groupDef.vars.forEach(varConfig => {
                const row = this.createColorRow(varConfig);
                row.setAttribute('data-scope', groupDef.scope);
                panel.appendChild(row);
            });

            const resetBtn = document.createElement('button');
            resetBtn.className = 'theme-switcher__reset-all theme-switcher__reset-global';
            resetBtn.textContent = groupDef.resetLabel;
            resetBtn.addEventListener('click', () => EventHandlers.handleResetGroup(groupDef.id));
            panel.appendChild(resetBtn);

            group.appendChild(panel);

            header.addEventListener('click', () => {
                const isExpanded = panel.getAttribute('data-expanded') === 'true';
                panel.setAttribute('data-expanded', (!isExpanded).toString());
                chevron.setAttribute('data-expanded', (!isExpanded).toString());
            });

            return group;
        }

        // Create snippets section with search input and a separate list container
        static createSnippetsSection() {
            const { section, content } = this.createSection('CSS Snippets', 'snippets', 'snippets');

            const snippetsWrapper = document.createElement('div');
            snippetsWrapper.className = 'theme-switcher__snippets';

            // Search input — lives outside the list so it survives buildSnippetUI rebuilds
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'theme-switcher__snippet-search';
            searchInput.placeholder = 'Search snippets…';
            searchInput.addEventListener('input', () => {
                UIManager.filterSnippets(searchInput.value.trim().toLowerCase());
            });
            snippetsWrapper.appendChild(searchInput);

            // List container — this is what buildSnippetUI clears and rebuilds
            const list = document.createElement('div');
            list.className = 'theme-switcher__snippets-list';
            snippetsWrapper.appendChild(list);

            content.appendChild(snippetsWrapper);

            return section;
        }

        static createFavoritesSection() {
            const { section, content } = this.createSection('Favorites', 'favorites', 'favorites');

            const wrapper = document.createElement('div');
            wrapper.className = 'theme-switcher__favorites';

            const saveRow = document.createElement('div');
            saveRow.className = 'theme-switcher__favorites-save-row';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'theme-switcher__favorites-name-input';
            nameInput.placeholder = 'Save current state as…';
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveBtn.click();
            });

            const saveBtn = document.createElement('button');
            saveBtn.className = 'theme-switcher__favorites-save-btn';
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', async () => {
                const name = nameInput.value.trim();
                if (!name) return;
                const saved = await FavoritesManager.save(name);
                if (!saved) {
                    saveBtn.textContent = 'Nothing modified!';
                    setTimeout(() => saveBtn.textContent = 'Save', 2000);
                    return;
                }
                nameInput.value = '';
                UIManager.buildFavoritesUI();
            });

            saveRow.appendChild(nameInput);
            saveRow.appendChild(saveBtn);
            wrapper.appendChild(saveRow);

            const listEl = document.createElement('div');
            listEl.className = 'theme-switcher__favorites-list';
            wrapper.appendChild(listEl);

            content.appendChild(wrapper);
            return section;
        }

        // Render the saved favorites list
        static buildFavoritesUI() {
            const listEl = document.querySelector('.theme-switcher__favorites-list');
            if (!listEl) return;

            listEl.innerHTML = '';
            const favorites = FavoritesManager.getAll();

            if (!favorites.length) {
                const empty = document.createElement('div');
                empty.className = 'theme-switcher__favorites-empty';
                empty.textContent = 'No favorites saved yet';
                listEl.appendChild(empty);
                return;
            }

            favorites.forEach(fav => {
                const row = document.createElement('div');
                row.className = 'theme-switcher__favorite-row';

                // Mini color swatches for at-a-glance preview
                const swatches = document.createElement('div');
                swatches.className = 'theme-switcher__favorite-swatches';
                ['--body', '--card', '--nav', '--accent'].forEach(v => {
                    if (fav.colors[v]) {
                        const swatch = document.createElement('span');
                        swatch.className = 'theme-switcher__favorite-swatch';
                        swatch.style.background = fav.colors[v];
                        swatch.title = `${v}: ${fav.colors[v]}`;
                        swatches.appendChild(swatch);
                    }
                });

                const name = document.createElement('span');
                name.className = 'theme-switcher__favorite-name';
                name.textContent = fav.name;

                const applyBtn = document.createElement('button');
                applyBtn.className = 'theme-switcher__favorite-apply';
                applyBtn.textContent = 'Apply';
                applyBtn.addEventListener('click', async () => {
                    await FavoritesManager.apply(fav.name);
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'theme-switcher__favorite-delete';
                deleteBtn.textContent = '✕';
                deleteBtn.title = 'Delete';
                deleteBtn.addEventListener('click', async () => {
                    await FavoritesManager.delete(fav.name);
                    ColorisManager.updateSwatches(); // <-- add
                    UIManager.buildFavoritesUI();
                });

                row.appendChild(swatches);
                row.appendChild(name);
                row.appendChild(applyBtn);
                row.appendChild(deleteBtn);
                listEl.appendChild(row);
            });
        }

        // Toggle pin state for a snippet (move between Snippets and Custom Colors sections).
        // Simplified: just toggle storage and rebuild — avoids fragile DOM surgery that
        // breaks when snippets are nested inside category groups.
        static async toggleSnippetPin(snippet, snippetEl, pinBtn) {
            const key = `pinned-snippet-${snippet.name}`;
            const isPinned = storage.config[key] === true;
            const newPinned = !isPinned;

            if (newPinned) {
                await storage.set(key, true);
            } else {
                await storage.remove(key);
            }

            UIManager.buildSnippetUI();
            UIManager.updatePinnedSeparator();

            // Broadcast to other tabs
            crossTabSync.broadcast('snippet-pin-change', {
                snippetName: snippet.name,
                pinned: newPinned
            });
        }

        // Show the pinned separator only when there are pinned snippets
        static updatePinnedSeparator() {
            const pinnedArea = document.querySelector('.theme-switcher__pinned-snippets');
            const separator = document.querySelector('.theme-switcher__pinned-separator');
            if (!separator) return;
            const hasPinned = pinnedArea && pinnedArea.children.length > 0;
            separator.style.display = hasPinned ? 'block' : 'none';
        }

        // Build snippet UI dynamically, grouped by category when present
        static buildSnippetUI() {
            state.clearElementCache();
            const container = document.querySelector('.theme-switcher__snippets-list');
            if (!container) {
                console.warn('Snippet list container not found');
                return;
            }

            container.innerHTML = "";

            if (!state.snippets.length) {
                container.innerHTML = '<div style="opacity: 0.7; padding: 8px;">No snippets found</div>';
                return;
            }

            const fragment = document.createDocumentFragment();

            // Normalize all snippets up front
            const normalized = state.snippets
                .map(raw => SnippetManager.normalizeSnippet(raw))
                .filter(Boolean);

            // Decide whether to group: only if at least one snippet has a category
            const hasCategories = normalized.some(s => s.category);

            if (hasCategories) {
                // Group snippets by category, preserving order of first appearance
                const groups = new Map();
                normalized.forEach(snippet => {
                    const cat = snippet.category || 'MISC';
                    if (!groups.has(cat)) groups.set(cat, []);
                    groups.get(cat).push(snippet);
                });

                // Render named categories first, then "MISC" last
                const orderedKeys = [...groups.keys()].filter(k => k !== 'MISC');
                if (groups.has('MISC')) orderedKeys.push('MISC');

                orderedKeys.forEach(categoryName => {
                    const groupEl = this.createSnippetCategoryGroup(categoryName, groups.get(categoryName));
                    fragment.appendChild(groupEl);
                });
            } else {
                // Flat list — original behaviour when no categories are defined
                normalized.forEach(snippet => {
                    fragment.appendChild(this.createSnippet(snippet));
                });
            }

            // Disable all button
            const disableBtn = document.createElement("button");
            disableBtn.className = "theme-switcher__disable-all";
            disableBtn.textContent = "Disable All Snippets";
            disableBtn.addEventListener('click', async () => {
                await SnippetManager.disableAll();
                this.buildSnippetUI();
                this.applyDropdownStyles();
                window.ThemeSwitcherCore.crossTabSync.broadcast('all-snippets-disabled', {});
            });
            fragment.appendChild(disableBtn);

            container.appendChild(fragment);

            // Move any pinned snippets into the Custom Colors section
            const pinnedArea = document.querySelector('.theme-switcher__pinned-snippets');
            if (pinnedArea) {
                pinnedArea.innerHTML = '';
                normalized.forEach(snippet => {
                    if (storage.config[`pinned-snippet-${snippet.name}`] === true) {
                        const snippetEl = container.querySelector(
                            `.theme-switcher__snippet[data-snippet-id="${snippet.name}"]`
                        );
                        if (snippetEl) {
                            snippetEl.classList.add('theme-switcher__snippet--pinned');
                            pinnedArea.appendChild(snippetEl);
                        }
                    }
                });
            }
            UIManager.updatePinnedSeparator();

            // Re-apply any active search filter so results stay consistent after a rebuild
            const searchInput = document.querySelector('.theme-switcher__snippet-search');
            if (searchInput && searchInput.value.trim()) {
                this.filterSnippets(searchInput.value.trim().toLowerCase());
            }
        }

        // Create a collapsible category group containing the given snippet elements
        static createSnippetCategoryGroup(categoryName, snippets) {
            const group = document.createElement('div');
            group.className = 'theme-switcher__snippet-category';
            group.setAttribute('data-category', categoryName);

            const header = document.createElement('div');
            header.className = 'theme-switcher__snippet-category-header';

            const chevron = document.createElement('span');
            chevron.className = 'theme-switcher__snippet-chevron';
            chevron.textContent = '▸';
            chevron.setAttribute('data-expanded', 'false');

            const label = document.createElement('span');
            label.className = 'theme-switcher__snippet-category-name';
            label.textContent = categoryName;

            header.appendChild(chevron);
            header.appendChild(label);
            group.appendChild(header);

            const body = document.createElement('div');
            body.className = 'theme-switcher__snippet-category-body';
            body.setAttribute('data-expanded', 'false');

            snippets.forEach(snippet => {
                body.appendChild(this.createSnippet(snippet));
            });

            group.appendChild(body);

            header.addEventListener('click', () => {
                const isExpanded = body.getAttribute('data-expanded') === 'true';
                body.setAttribute('data-expanded', (!isExpanded).toString());
                chevron.setAttribute('data-expanded', (!isExpanded).toString());
            });

            return group;
        }

        // Filter visible snippets by query string.
        // Hides non-matching snippets; hides/shows category groups based on whether
        // they have any visible children; auto-expands matching groups while searching.
        static filterSnippets(query) {
            const container = document.querySelector('.theme-switcher__snippets-list');
            if (!container) return;

            const categoryGroups = container.querySelectorAll('.theme-switcher__snippet-category');

            // On the first keystroke (empty → non-empty), snapshot which groups are open
            if (query && !UIManager._searchSnapshot) {
                UIManager._searchSnapshot = new Set();
                categoryGroups.forEach(group => {
                    const body = group.querySelector('.theme-switcher__snippet-category-body');
                    if (body?.getAttribute('data-expanded') === 'true') {
                        UIManager._searchSnapshot.add(group.getAttribute('data-category'));
                    }
                });
            }

            // Show/hide individual snippet rows
            container.querySelectorAll('.theme-switcher__snippet').forEach(el => {
                const id = el.getAttribute('data-snippet-id') || '';
                const displayName = id.replace(/[-_]/g, ' ').toLowerCase();
                el.style.display = (!query || displayName.includes(query)) ? '' : 'none';
            });

            // Update category group visibility and expansion
            categoryGroups.forEach(group => {
                const snippets = group.querySelectorAll('.theme-switcher__snippet');
                const anyVisible = Array.from(snippets).some(el => el.style.display !== 'none');
                const body = group.querySelector('.theme-switcher__snippet-category-body');
                const chevron = group.querySelector('.theme-switcher__snippet-chevron');

                group.style.display = anyVisible ? '' : 'none';

                if (!body || !chevron) return;

                if (query) {
                    // While searching: expand groups that have matches
                    if (anyVisible) {
                        body.setAttribute('data-expanded', 'true');
                        chevron.setAttribute('data-expanded', 'true');
                    }
                } else {
                    // Search cleared: restore pre-search snapshot
                    const categoryName = group.getAttribute('data-category');
                    const wasOpen = UIManager._searchSnapshot?.has(categoryName) ?? false;
                    body.setAttribute('data-expanded', wasOpen.toString());
                    chevron.setAttribute('data-expanded', wasOpen.toString());
                }
            });

            // Discard snapshot once search is fully cleared
            if (!query) {
                UIManager._searchSnapshot = null;
            }
        }

        // Create a snippet element
        static createSnippet(snippet) {
            const hasScopes = Object.keys(snippet.scopes).length > 1;
            const hasVars = snippet.vars && Object.keys(snippet.vars).length > 0;
            const hasScopePanel = hasScopes || snippet.hasGlobal;
            const hasOptions = hasVars || hasScopePanel;

            const container = document.createElement('div');
            container.className = 'theme-switcher__snippet';
            container.setAttribute('data-snippet-id', snippet.name);

            // Header
            const header = document.createElement('div');
            header.className = 'theme-switcher__snippet-header';

            const info = document.createElement('div');
            info.className = 'theme-switcher__snippet-info';

            // Pin button
            const isPinned = storage.config[`pinned-snippet-${snippet.name}`] === true;
            const pinBtn = document.createElement('button');
            pinBtn.className = 'theme-switcher__snippet-pin';
            pinBtn.title = isPinned ? 'Unpin from Custom Colors' : 'Pin to Custom Colors';
            pinBtn.setAttribute('data-pinned', isPinned.toString());
            pinBtn.textContent = '🖈';
            pinBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await UIManager.toggleSnippetPin(snippet, container, pinBtn);
            });
            info.appendChild(pinBtn);

            // Name
            const name = document.createElement('span');
            name.className = 'theme-switcher__snippet-name';
            const displayName = snippet.name
                .replace(/[_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            name.textContent = displayName;
            name.title = snippet.name;
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

            // Toggle switch
            const enabled = SnippetManager.getEnabled(snippet.name);
            const toggle = this.createSnippetToggle(snippet, enabled, hasScopes);
            header.appendChild(toggle);

            container.appendChild(header);

            // Expandable panels
            if (hasOptions) {
                const panelsContainer = document.createElement('div');
                panelsContainer.className = 'theme-switcher__snippet-panel';
                panelsContainer.setAttribute('data-expanded', 'false');

                if (hasScopePanel) {
                    const scopePanel = this.createScopePanel(snippet);
                    panelsContainer.appendChild(scopePanel);
                }

                if (hasVars) {
                    const varsPanel = this.createVarsPanel(snippet);
                    panelsContainer.appendChild(varsPanel);
                }

                container.appendChild(panelsContainer);

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
                    const allCheckboxes = scopePanel.querySelectorAll('input[type="checkbox"]');
                    const anyChecked = Array.from(allCheckboxes).some(cb => cb.checked);
                    const newState = !anyChecked;

                    // Sweep all checkboxes including global
                    allCheckboxes.forEach(cb => cb.checked = newState);

                    // Gather only scope checkboxes (global has no dataset.scope)
                    const selectedScopes = newState
                        ? Array.from(scopePanel.querySelectorAll(
                            '.theme-switcher__scope-checkbox:not(.theme-switcher__scope-checkbox--global)'
                        )).map(cb => cb.dataset.scope)
                        : [];

                    await SnippetManager.setEnabled(snippet.name, newState);
                    await SnippetManager.setScopes(snippet.name, selectedScopes);
                    await SnippetManager.setGlobal(snippet.name, newState);
                    await SnippetManager.apply(snippet, newState, selectedScopes, newState);

                    toggle.setAttribute('data-active', newState.toString());

                    window.ThemeSwitcherCore.crossTabSync.broadcast('snippet-change', {
                        theme: window.ThemeSwitcherCore.state.currentTheme,
                        scheme: window.ThemeSwitcherCore.state.currentScheme,
                        snippetName: snippet.name,
                        enabled: newState,
                        scopes: selectedScopes,
                        global: newState
                    });
                });
            } else {
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
                        // Sweep all checkboxes including global
                        scopePanel.querySelectorAll('input[type="checkbox"]')
                            .forEach(cb => cb.checked = toggle.checked);

                        // Gather only scope checkboxes
                        const selectedScopes = toggle.checked
                            ? Array.from(scopePanel.querySelectorAll(
                                '.theme-switcher__scope-checkbox:not(.theme-switcher__scope-checkbox--global)'
                            )).map(cb => cb.dataset.scope)
                            : [];

                        await SnippetManager.setEnabled(snippet.name, toggle.checked);
                        await SnippetManager.setScopes(snippet.name, selectedScopes);
                        await SnippetManager.setGlobal(snippet.name, toggle.checked);
                        await SnippetManager.apply(snippet, toggle.checked, selectedScopes, toggle.checked);

                        window.ThemeSwitcherCore.crossTabSync.broadcast('snippet-change', {
                            theme: window.ThemeSwitcherCore.state.currentTheme,
                            scheme: window.ThemeSwitcherCore.state.currentScheme,
                            snippetName: snippet.name,
                            enabled: toggle.checked,
                            scopes: selectedScopes,
                            global: toggle.checked
                        });
                    } else {
                        // No scope panel — use default scope and current global state
                        const defaultScope = Object.keys(snippet.scopes)[0] || 'all';
                        const selectedScopes = toggle.checked ? [defaultScope] : [];
                        const currentGlobal = SnippetManager.getGlobal(snippet.name);

                        await SnippetManager.setEnabled(snippet.name, toggle.checked);
                        await SnippetManager.setScopes(snippet.name, selectedScopes);
                        await SnippetManager.apply(snippet, toggle.checked, selectedScopes, currentGlobal);

                        window.ThemeSwitcherCore.crossTabSync.broadcast('snippet-change', {
                            theme: window.ThemeSwitcherCore.state.currentTheme,
                            scheme: window.ThemeSwitcherCore.state.currentScheme,
                            snippetName: snippet.name,
                            enabled: toggle.checked,
                            scopes: selectedScopes,
                            global: currentGlobal
                        });
                    }
                });
            }

            return toggle;
        }

        // Create scope selection panel
        static createScopePanel(snippet) {
            const panel = document.createElement('div');
            panel.className = 'theme-switcher__scope-panel';

            const hasScopes = Object.keys(snippet.scopes).length > 1;
            const enabled = SnippetManager.getEnabled(snippet.name);
            const scopes = SnippetManager.getScopes(snippet.name);

            // Global styles checkbox
            if (snippet.hasGlobal) {
                const globalEnabled = SnippetManager.getGlobal(snippet.name);

                const label = document.createElement('label');
                label.className = 'theme-switcher__scope-option theme-switcher__scope-option--global';

                const text = document.createElement('span');
                text.className = 'theme-switcher__scope-label';
                text.textContent = 'Global styles / Hover behavior';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'theme-switcher__scope-checkbox theme-switcher__scope-checkbox--global';
                checkbox.dataset.snippet = snippet.name;
                checkbox.checked = enabled && globalEnabled;

                checkbox.addEventListener('click', e => e.stopPropagation());
                checkbox.addEventListener('change', async () => {
                    const snippetContainer = document.querySelector(
                        `.theme-switcher__snippet[data-snippet-id="${snippet.name}"]`
                    );
                    if (!snippetContainer) return;

                    const scopePanel = snippetContainer.querySelector('.theme-switcher__scope-panel');

                    const selectedScopes = Array.from(scopePanel.querySelectorAll(
                        '.theme-switcher__scope-checkbox:not(.theme-switcher__scope-checkbox--global)'
                    )).filter(cb => cb.checked).map(cb => cb.dataset.scope);

                    const newEnabled = selectedScopes.length > 0 || checkbox.checked;

                    await SnippetManager.setEnabled(snippet.name, newEnabled);
                    await SnippetManager.setScopes(snippet.name, selectedScopes);
                    await SnippetManager.setGlobal(snippet.name, checkbox.checked);
                    await SnippetManager.apply(snippet, newEnabled, selectedScopes, checkbox.checked);

                    const toggle = snippetContainer.querySelector('.theme-switcher__toggle');
                    if (toggle) toggle.setAttribute('data-active', newEnabled.toString());

                    const checkboxToggle = snippetContainer.querySelector('.theme-switcher__toggle-checkbox');
                    if (checkboxToggle) checkboxToggle.checked = newEnabled;

                    window.ThemeSwitcherCore.crossTabSync.broadcast('snippet-change', {
                        theme: window.ThemeSwitcherCore.state.currentTheme,
                        scheme: window.ThemeSwitcherCore.state.currentScheme,
                        snippetName: snippet.name,
                        enabled: newEnabled,
                        scopes: selectedScopes,
                        global: checkbox.checked
                    });
                });

                label.appendChild(text);
                label.appendChild(checkbox);
                panel.appendChild(label);
            }

            // Scope checkboxes
            if (hasScopes) {
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

                    checkbox.addEventListener('click', e => e.stopPropagation());
                    checkbox.addEventListener('change', async () => {
                        const snippetContainer = document.querySelector(
                            `.theme-switcher__snippet[data-snippet-id="${snippet.name}"]`
                        );
                        if (!snippetContainer) return;

                        const scopePanel = snippetContainer.querySelector('.theme-switcher__scope-panel');

                        const selectedScopes = Array.from(scopePanel.querySelectorAll(
                            '.theme-switcher__scope-checkbox:not(.theme-switcher__scope-checkbox--global)'
                        )).filter(cb => cb.checked).map(cb => cb.dataset.scope);

                        const globalCheckbox = scopePanel.querySelector('.theme-switcher__scope-checkbox--global');
                        const globalChecked = globalCheckbox ? globalCheckbox.checked : false;
                        const currentGlobal = SnippetManager.getGlobal(snippet.name);

                        const newEnabled = selectedScopes.length > 0 || globalChecked;

                        await SnippetManager.setEnabled(snippet.name, newEnabled);
                        await SnippetManager.setScopes(snippet.name, selectedScopes);
                        await SnippetManager.apply(snippet, newEnabled, selectedScopes, currentGlobal);

                        const toggle = snippetContainer.querySelector('.theme-switcher__toggle');
                        if (toggle) toggle.setAttribute('data-active', newEnabled.toString());

                        const checkboxToggle = snippetContainer.querySelector('.theme-switcher__toggle-checkbox');
                        if (checkboxToggle) checkboxToggle.checked = newEnabled;

                        window.ThemeSwitcherCore.crossTabSync.broadcast('snippet-change', {
                            theme: window.ThemeSwitcherCore.state.currentTheme,
                            scheme: window.ThemeSwitcherCore.state.currentScheme,
                            snippetName: snippet.name,
                            enabled: newEnabled,
                            scopes: selectedScopes,
                            global: currentGlobal
                        });
                    });

                    label.appendChild(text);
                    label.appendChild(checkbox);
                    panel.appendChild(label);
                });
            }

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

            if (window.Coloris) {
                panel.querySelectorAll('[data-coloris]').forEach(el => Coloris({ el }));
            }

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
                input.dataset.snippet = snippet.name;
                input.dataset.varName = varName;
                meta.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    input.appendChild(option);
                });
                input.value = savedValue || meta.default || meta.options[0];
            } else if (meta.type === 'color') {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'theme-switcher__color-input theme-switcher__var-input';
                input.setAttribute('data-coloris', '');
                input.dataset.snippet = snippet.name;
                input.dataset.varName = varName;

                const rawValue = savedValue || meta.default || '';
                const varRef = rawValue.match(/^var\(\s*(--[^,\s)]+)/);
                const initialValue = varRef
                    ? CSSVariableManager.resolveValue(varRef[1]) || rawValue
                    : rawValue;

                if (initialValue) {
                    input.value = initialValue;
                    input.style.background = initialValue;
                }

                const resetBtn = document.createElement('button');
                resetBtn.className = 'theme-switcher__color-reset';
                resetBtn.textContent = '↺';
                resetBtn.title = 'Reset to default';
                resetBtn.addEventListener('click', async () => {
                    const val = meta.default || '';
                    await SnippetManager.setVar(snippet.name, varName, val);
                    CSSVariableManager.setVar(varName, val);
                    ColorisManager.resetInput(input, val);
                });

                // coloris:pick fires once on final pick — use for persistence + broadcast
                input.addEventListener('coloris:pick', async (e) => {
                    const color = e.detail.color;
                    await SnippetManager.setVar(snippet.name, varName, color);
                    window.ThemeSwitcherCore.crossTabSync.broadcast('snippet-var-change', {
                        theme: window.ThemeSwitcherCore.state.currentTheme,
                        scheme: window.ThemeSwitcherCore.state.currentScheme,
                        snippetName: snippet.name,
                        varName: varName,
                        value: color,
                        meta: meta
                    });
                });

                // Return a wrapper so the reset button travels with the input
                const wrapper = document.createElement('div');
                wrapper.className = 'theme-switcher__var-color-wrapper';
                wrapper.appendChild(input);
                wrapper.appendChild(resetBtn);
                return wrapper;
            } else {
                input = document.createElement('input');
                input.type = meta.type || 'number';
                input.className = 'theme-switcher__var-input';
                input.dataset.snippet = snippet.name;
                input.dataset.varName = varName;

                if (meta.type === 'number' || !meta.type) {
                    if (meta.min !== undefined) input.min = meta.min;
                    if (meta.max !== undefined) input.max = meta.max;
                    input.step = meta.step ?? 1;
                }

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

                // Broadcast to other tabs with theme/scheme context
                window.ThemeSwitcherCore.crossTabSync.broadcast('snippet-var-change', {
                    theme: window.ThemeSwitcherCore.state.currentTheme,
                    scheme: window.ThemeSwitcherCore.state.currentScheme,
                    snippetName: snippet.name,
                    varName: varName,
                    value: value,
                    meta: meta
                });
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
                const input = document.querySelector(
                    `.theme-switcher__color-input[data-var-name='${v.name}']`
                );
                if (input) {
                    const val = CSSVariableManager.resolveValue(v.name);
                    const saved = state.getThemeVar(v.name);

                    ColorisManager.resetInput(input, val);

                    setTimeout(() => {
                        const updatedInput = document.querySelector(
                            `.theme-switcher__color-input[data-var-name='${v.name}']`
                        );
                        if (updatedInput) {
                            // Explicit user override, OR derived var following a modified parent
                            const { isModified: derivedModified } =
                                CSSVariableManager.resolveDerivedSchemeVar(v.name);
                            ColorisManager.markModified(updatedInput, !!saved || derivedModified);
                        }
                    }, 50);

                    setTimeout(() => {
                        UIManager.refreshAllPinStates();
                    }, 100);
                }
            }

            for (const group of CONFIG.globalVarGroups) {
                for (const v of group.vars) {
                    const input = document.querySelector(
                        `.theme-switcher__color-input[data-var-name='${v.name}']`
                    );
                    if (!input) continue;

                    const isGlobal = group.scope === 'global';
                    const val = isGlobal
                        ? CSSVariableManager.resolveGlobalValue(v.name)
                        : CSSVariableManager.resolveValue(v.name);
                    const saved = isGlobal
                        ? state.getGlobalVar(v.name)
                        : state.getThemeVar(v.name);

                    ColorisManager.resetInput(input, val);

                    setTimeout(() => {
                        const updatedInput = document.querySelector(
                            `.theme-switcher__color-input[data-var-name='${v.name}']`
                        );
                        if (updatedInput) {
                            const { isModified: derivedModified } = isGlobal
                                ? CSSVariableManager.resolveDerivedGlobalVar(v.name)
                                : CSSVariableManager.resolveDerivedSchemeVar(v.name);
                            ColorisManager.markModified(updatedInput, !!saved || derivedModified);
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

            //Claude responded: The only active line left is hoverBg, and it's still doing the same no-theme conditional pattern as everything else.
            //The only active line left is hoverBg, and it's still doing the same no-theme conditional pattern as everything else. Since your CSS already handles theming 
            //dynamically via CSS variables, hoverBg could move there too — add a --ts-bg-option-hover variable to :root with a fallback for the no-theme case, 
            //set it to var(--hover-bg, #137cbd) in the theme context, and replace the inline item.style.background with a CSS hover rule.
            //If you do that, applyDropdownStyles reduces to just the event listeners for resetting background on click and mouseleave — at which point those 
            //could also be replaced with pure CSS (:hover selector). The whole method could be deleted.
            //The one reason to keep some JS hover handling is the click reset (setTimeout background = transparent) — that's working around a browser quirk where 
            //the hover state can persist briefly after click. But even that can be handled in CSS with :active.
            //So yes, fully simplifiable — move hoverBg to CSS and the method goes away entirely. Whether that's worth doing depends on how much you want to keep 
            //in CSS vs JS. The current state works fine, it's just slightly inconsistent with the direction you've already taken by moving panel background to CSS.

            const colors = {
                //navBg: isNoTheme ? "#394b59" : cs.getPropertyValue('--nav-grey-dark').trim() || "#394b59",
                //navBtBg: isNoTheme ? "#394b59" : cs.getPropertyValue('--nav').trim() || "#394b59",
                //text: isNoTheme ? "#fff" : cs.getPropertyValue('--tags').trim() || "#ffffff",
                //accent: isNoTheme ? "#cc7b19" : cs.getPropertyValue('--accent').trim() || "#cc7b19",
                hoverBg: isNoTheme ? "#137cbd" : cs.getPropertyValue('--hover-bg').trim() || "transparent",
                //hoverText: isNoTheme ? "#fff" : cs.getPropertyValue('--hover-text').trim() || "#fff"
            };

            //panel.style.background = colors.navBg;
            //button.style.background = colors.navBtBg;

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
        }

        // Show/hide theme-specific elements
        static hideThemeElements() {
            const colorSection = document.querySelector('.theme-switcher__section--colors');
            if (colorSection) colorSection.style.display = 'none';

            const snippetSection = document.querySelector('.theme-switcher__section--snippets');
            if (snippetSection) snippetSection.style.display = 'none';

            const favSection = document.querySelector('.theme-switcher__section--favorites');
            if (favSection) favSection.style.display = 'none';

            const separators = document.querySelectorAll('.theme-switcher__panel .theme-switcher__divider');
            separators.forEach(hr => hr.style.display = 'none');
        }

        static showThemeElements() {
            const colorSection = document.querySelector('.theme-switcher__section--colors');
            if (colorSection) colorSection.style.display = 'block';

            const snippetSection = document.querySelector('.theme-switcher__section--snippets');
            if (snippetSection) snippetSection.style.display = 'block';

            const favSection = document.querySelector('.theme-switcher__section--favorites');
            if (favSection) favSection.style.display = 'block';

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

        panel.appendChild(UIManager.createDivider());

        const favoritesSection = UIManager.createFavoritesSection();
        panel.appendChild(favoritesSection);

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

    crossTabSync.initialize();

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
                UIManager.buildFavoritesUI();
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