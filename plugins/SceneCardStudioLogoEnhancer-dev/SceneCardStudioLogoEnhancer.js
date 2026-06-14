(function () {
    'use strict';

    const PLUGIN_ID = 'SceneCardStudioLogoEnhancer';
    const LOGO_SIZE = 40;
    const LOGO_GAP = 22;
    const defaultStudioOverrides = {
        "giorgio grandi": {
            force: ["logo-wide", "logo-skinny"],
            remove: ["logo-fat"]
        },
        "futanaria": {
            force: ["logo-wide", "logo-fat"],
            remove: ["logo-skinny"]
        },
        "tushy": {
            force: ["logo-wide", "logo-fat"],
            remove: ["logo-skinny"]
        },
        "red light district": {
            force: ["logo-wide", "logo-skinny"],
            remove: ["logo-fat"]
        }
    };

    const defaultConfig = {
        useInitials: true,
        persistentColors: true,
        blurredBackground: true,
        studioOverrides: JSON.stringify(defaultStudioOverrides)
    };

    let config = {
        useInitials: true,
        persistentColors: true,
        blurredBackground: true,
        studioOverrides: {}
    };

    const studioColorCache = new Map();

    // =====================================================================
    // INITIALIZATION
    // =====================================================================
    async function init() {
        await reloadConfig();
        applyBlurStyles();
        console.log('[Studio Logo Enhancer] Starting with config:', config);

        const savedConfig = await csLib.getConfiguration(PLUGIN_ID, {});
        if (!savedConfig.studioOverrides) {
            await csLib.setConfiguration(PLUGIN_ID, {
                useInitials: config.useInitials,
                persistentColors: config.persistentColors,
                studioOverrides: defaultConfig.studioOverrides
            });
            console.log('[Studio Logo Enhancer] Initialized default studio overrides');
        }

        processExistingCards();
        setupPageListeners();

        console.log('[Studio Logo Enhancer] Initialized successfully');
    }

    async function reloadConfig() {
        const savedConfig = await csLib.getConfiguration(PLUGIN_ID, {});

        config.useInitials = savedConfig.useInitials ?? defaultConfig.useInitials;
        config.persistentColors = savedConfig.persistentColors ?? defaultConfig.persistentColors;
        config.blurredBackground = savedConfig.blurredBackground ?? defaultConfig.blurredBackground;

        try {
            config.studioOverrides = savedConfig.studioOverrides
                ? JSON.parse(savedConfig.studioOverrides)
                : JSON.parse(defaultConfig.studioOverrides);
        } catch (e) {
            console.error('[Studio Logo Enhancer] Error parsing studioOverrides:', e);
            config.studioOverrides = JSON.parse(defaultConfig.studioOverrides);
        }
    }

    // =====================================================================
    // COLOR / PLACEHOLDER HELPERS
    // =====================================================================
    function colorForStudio(name) {
        if (!config.persistentColors) {
            return `hsl(${Math.random() * 360}, 68%, 55%)`;
        }
        if (studioColorCache.has(name)) {
            return studioColorCache.get(name);
        }
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = (hash * 31 + name.charCodeAt(i)) | 0;
        }
        const hue = Math.abs(hash) % 360;
        const color = `hsl(${hue}, 68%, 55%)`;
        studioColorCache.set(name, color);
        return color;
    }

    function placeholderClass() {
        return config.useInitials ? 'placeholder-studio-svg' : 'placeholder-studio-name';
    }

    function createPlaceholder(name) {
        const text = (name || "Unknown").trim();

        if (config.useInitials) {
            const color = colorForStudio(text);
            const initials = text
                .split(/\s+/)
                .map(w => w[0] || "")
                .join("")
                .toUpperCase()
                .slice(0, 2);

            const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_SIZE} ${LOGO_SIZE}">
                    <rect width="90%" height="90%" fill="${color}" rx="4" ry="4"/>
                    <text x="45%" y="45%" 
                          font-family="sans-serif" 
                          font-size="${Math.floor(LOGO_SIZE * 0.45)}" 
                          fill="white" 
                          text-anchor="middle" 
                          dominant-baseline="central">${initials}</text>
                </svg>
            `.trim();

            return "data:image/svg+xml;base64," + btoa(svg);

        } else {
            const words = text.split(/\s+/);
            let lines = [];
            let current = "";

            for (const w of words) {
                const test = current ? current + " " + w : w;
                if (test.length > 8 && current) {
                    lines.push(current);
                    current = w;
                } else {
                    current = test;
                }
            }
            if (current) lines.push(current);

            if (lines.length > 3) {
                lines = [lines[0], lines[1], lines.slice(2).join(" ")];
            }

            const maxLen = Math.max(...lines.map(l => l.length));
            const fontSize = maxLen <= 6 ? 10 :
                maxLen <= 11 ? 7 :
                    maxLen <= 12 ? 7 :
                        maxLen <= 14 ? 5 :
                            maxLen <= 16 ? 5 : 7;

            const lineHeight = fontSize + 2;
            const totalHeight = lines.length * lineHeight;
            const startY = (LOGO_SIZE - totalHeight) / 2 + fontSize;

            const textSvg = lines.map((line, i) =>
                `<text x="50%" y="${startY + i * lineHeight}" 
                       font-family="sans-serif" 
                       font-size="${fontSize}" 
                       fill="white" 
                       text-anchor="middle">${line}</text>`
            ).join("");

            const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_SIZE} ${LOGO_SIZE}">
                    <rect width="100%" height="100%" fill="transparent" rx="4" ry="4"/>
                    ${textSvg}
                </svg>
            `.trim();

            return "data:image/svg+xml;base64," + btoa(svg);
        }
    }

    // =====================================================================
    // LOGO CLASSIFICATION
    // =====================================================================
    function normalizeStudioName(name) {
        return (name || "")
            .toLowerCase()
            .replace(/logo$/i, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function applyStudioOverride(img) {
        const studio = normalizeStudioName(
            img.getAttribute('alt') ||
            img.closest('a')?.getAttribute('title')
        );
        if (!studio) return;
        const override = config.studioOverrides[studio];
        if (!override) return;
        if (override.remove) img.classList.remove(...override.remove);
        if (override.force) img.classList.add(...override.force);
    }

    function classifyLogo(img) {
        img.onload = () => {
            const w = img.naturalWidth || LOGO_SIZE;
            const h = img.naturalHeight || LOGO_SIZE;
            const ratio = w / h;
            const fill = Math.min(w, h) / Math.max(w, h);

            img.classList.remove(
                'logo-wide', 'logo-tall', 'logo-square',
                'logo-skinny', 'logo-fat'
            );

            if (ratio > 1.1) {
                img.classList.add('logo-wide');
            } else if (ratio < 0.75) {
                img.classList.add('logo-tall');
            } else {
                img.classList.add('logo-square');
            }

            if (fill < 0.28) {
                img.classList.add('logo-skinny');
            } else if (fill > 0.4) {
                img.classList.add('logo-fat');
            }

            applyStudioOverride(img);
        };

        if (img.complete && img.naturalWidth) {
            img.onload();
        }
    }

    // =====================================================================
    // LINE COUNTING
    // =====================================================================
    function tagActualLines(card, el) {
        requestAnimationFrame(() => {
            const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
            const w = el.getBoundingClientRect().width;
            el.style.width = `${w}px`;
            const h = el.getBoundingClientRect().height;
            el.style.width = '';
            const lines = Math.max(1, Math.round(h / lh));
            [...card.classList].forEach(c => {
                if (c.startsWith('lines-actual-')) card.classList.remove(c);
            });
            card.classList.add(`lines-actual-${lines}`);
        });
    }

    // =====================================================================
    // POPOVER INTEGRATION
    // Works for both scene and gallery cards, with or without a studio.
    //
    // With studio:    titleDate is the .title-date div built by the enhancer.
    //                 The date element is already inside it.
    // Without studio: titleDate is null. We locate the date in .card-section
    //                 and insert the row there instead.
    // =====================================================================
    function processCardPopovers(card, type, titleDate) {
        const btnGroup = card.querySelector('.card-popovers.btn-group');
        if (!btnGroup) return;

        const hr = btnGroup.previousElementSibling;
        if (hr && hr.tagName === 'HR') {
            hr.classList.add('card-popovers-hr-removed');
        }

        btnGroup.classList.add('inline-popovers');

        const dateSel = type === 'scene' ? '.scene-card__date' : '.gallery-card__date';
        const existingDate = titleDate.querySelector(dateSel);

        const dateRow = document.createElement('div');
        dateRow.className = 'card-date-row';

        if (existingDate) {
            existingDate.parentNode.insertBefore(dateRow, existingDate);
            dateRow.appendChild(existingDate);

            const sep = document.createElement('span');
            sep.className = 'card-date-separator';
            sep.textContent = '|';
            dateRow.appendChild(sep);
        } else {
            titleDate.prepend(dateRow);
        }

        dateRow.appendChild(btnGroup);

    }

    // =====================================================================
    // CARD ENHANCEMENT (logo + popovers combined)
    // =====================================================================

    function applyBlurredBackground(card) {
        if (!config.blurredBackground) return;

        const preview = card.querySelector('.scene-card-preview');
        const img = card.querySelector('.scene-card-preview-image');
        if (!preview || !img) return;
        if (preview.querySelector('.scene-card-blurred-bg')) return;

        const bg = document.createElement('img');
        bg.className = 'scene-card-blurred-bg';
        bg.setAttribute('aria-hidden', 'true');
        bg.setAttribute('alt', '');

        // Stash lazy-loads the src, so watch for it being set after insertion
        const syncSrc = () => {
            const src = img.getAttribute('src') || '';
            if (src && bg.getAttribute('src') !== src) bg.setAttribute('src', src);
        };

        syncSrc(); // grab it immediately if already loaded

        new MutationObserver(syncSrc).observe(img, {
            attributes: true,
            attributeFilter: ['src']
        });

        preview.insertBefore(bg, preview.firstChild);
    }

    const BLUR_STYLE_ID = 'scene-card-blur-object-fit';

    function applyBlurStyles() {
        const existing = document.getElementById(BLUR_STYLE_ID);
        if (config.blurredBackground) {
            if (existing) return; // already injected
            const style = document.createElement('style');
            style.id = BLUR_STYLE_ID;
            style.textContent = `
            .scene-card-preview-video { object-fit: contain; }
            .scene-card-preview .scene-card-preview-image { object-fit: contain; position: relative; }
            .scene-card-preview-image, .scene-card-preview-video,
            .scene-marker-card-preview-image, .scene-marker-card-preview-video { object-position: center; }
        `;
            document.head.appendChild(style);
        } else {
            existing?.remove();
        }
    }

    function enhanceSceneOrGallery(card, type) {
        if (card.dataset.studioLogoProcessed) return;
        card.dataset.studioLogoProcessed = "true";

        const section = card.querySelector('.card-section');
        if (!section) return;

        const overlay = card.querySelector('.studio-overlay');

        const header = document.createElement('div');
        header.className = 'card-header-row';

        const titleDate = document.createElement('div');
        titleDate.className = 'title-date';

        if (overlay) {
            let link = overlay.querySelector('a');
            let studioName = link?.getAttribute('title')?.trim() ||
                link?.textContent?.trim() ||
                overlay.querySelector('img')?.alt?.trim() ||
                "Unknown";

            let img = overlay.querySelector('img')?.cloneNode(true);
            overlay.remove();

            if (!img) {
                img = document.createElement('img');
                img.src = createPlaceholder(studioName);
                img.alt = studioName;
                img.classList.add(placeholderClass());
            }

            classifyLogo(img);

            const thumb = document.createElement('div');
            thumb.className = 'studio-thumb';

            const linkElem = document.createElement('a');
            linkElem.href = link?.href || '#';
            linkElem.appendChild(img);
            thumb.appendChild(linkElem);

            header.appendChild(thumb);
            card.classList.add('has-studio');
        } else {
            card.classList.add('no-studio');
        }

        const titleHeading = section.querySelector('.card-section-title');
        const title = titleHeading?.parentElement?.tagName === 'A' ? titleHeading.parentElement : titleHeading;
        const dateSel = type === 'scene' ? '.scene-card__date' : '.gallery-card__date';
        const date = section.querySelector(dateSel);

        if (title) titleDate.appendChild(title);
        if (date) titleDate.appendChild(date);

        header.appendChild(titleDate);
        section.prepend(header);

        // Utility classes for CSS hooks
        const desc = section.querySelector('.scene-card__description, .gallery-card__description');
        if (!desc || !desc.textContent.trim()) {
            card.classList.add('no-description');
        }

        card.classList.add(date && date.textContent.trim() ? 'has-date' : 'no-date');

        const titleEl = section.querySelector('.card-section-title .TruncatedText') ||
            section.querySelector('.card-section-title');
        if (titleEl) {
            tagActualLines(card, titleEl);
            try {
                new ResizeObserver(() => tagActualLines(card, titleEl)).observe(titleEl);
            } catch (e) { }
        }

        processCardPopovers(card, type, titleDate);
        applyBlurredBackground(card);
    }

    function enhanceGroupCard(card) {
        if (card.dataset.studioLogoProcessed) return;
        card.dataset.studioLogoProcessed = "true";

        const titleEl = card.querySelector('.card-section-title .TruncatedText') ||
            card.querySelector('.card-section-title');
        if (titleEl) {
            tagActualLines(card, titleEl);
            try {
                new ResizeObserver(() => tagActualLines(card, titleEl)).observe(titleEl);
            } catch (e) {
                // ResizeObserver not supported
            }
        }
    }

    // =====================================================================
    // STUDIO PAGE / SCENE PAGE / GALLERY PAGE LOGO REPLACEMENTS
    // =====================================================================
    function replaceMissingStudioImages(scope = document) {
        scope.querySelectorAll('.studio-card-image').forEach(img => {
            if (img.dataset.studioLogoProcessed) return;

            const src = img.getAttribute('src') || "";
            if (!src.includes("default=true")) return;

            const card = img.closest('.studio-card');
            if (!card) return;

            const title = card.querySelector('.card-section-title .TruncatedText');
            const name = title ? title.textContent.trim() : "Unknown";

            img.src = createPlaceholder(name);
            img.srcset = '';
            img.removeAttribute('srcset');
            img.removeAttribute('loading');
            img.dataset.studioLogoProcessed = "true";
        });
    }

    function replaceStudioPageLogo() {
        const img = document.querySelector('#studio-page .detail-header-image img.logo');
        if (!img || img.dataset.studioLogoProcessed) return;

        const src = img.getAttribute('src') || "";
        if (!src.includes("default=true")) return;

        const nameEl = document.querySelector('.studio-name');
        const name = nameEl ? nameEl.textContent.trim() : "Unknown";

        img.src = createPlaceholder(name);
        img.removeAttribute('srcset');
        img.classList.add(placeholderClass());
        img.dataset.studioLogoProcessed = "true";
    }

    function replaceScenePageStudioLogo() {
        const h1 = document.querySelector('.scene-header-container h1.studio-logo');
        if (!h1 || h1.dataset.studioLogoProcessed) return;

        // A real logo img (not injected by us) means a studio has an actual image
        const existingImg = h1.querySelector('img');
        if (existingImg && !existingImg.getAttribute('src')?.includes("default=true")) return;

        const nameEl = document.querySelector('.scene-header-container .studio-name');
        const name = nameEl?.textContent.trim() || "Unknown";

        const anchor = h1.querySelector('a');
        if (!anchor) return;

        // Clear entire anchor contents and inject our placeholder img
        anchor.innerHTML = '';

        const img = document.createElement('img');
        img.src = createPlaceholder(name);
        img.alt = name;
        img.classList.add(placeholderClass());
        anchor.appendChild(img);

        h1.dataset.studioLogoProcessed = "true";
        classifyLogo(img);
    }

    function replaceGalleryPageStudioLogo() {
        const h1 = document.querySelector('.gallery-header-container h1.studio-logo');
        if (!h1 || h1.dataset.studioLogoProcessed) return;

        // A real logo img (not injected by us) means a studio has an actual image
        const existingImg = h1.querySelector('img');
        if (existingImg && !existingImg.getAttribute('src')?.includes("default=true")) return;

        const nameEl = document.querySelector('.gallery-header-container .studio-name');
        const name = nameEl?.textContent.trim() || "Unknown";

        const anchor = h1.querySelector('a');
        if (!anchor) return;

        // Clear entire anchor contents and inject our placeholder img
        anchor.innerHTML = '';

        const img = document.createElement('img');
        img.src = createPlaceholder(name);
        img.alt = name;
        img.classList.add(placeholderClass());
        anchor.appendChild(img);

        h1.dataset.studioLogoProcessed = "true";
        classifyLogo(img);
    }

    // =====================================================================
    // BULK PROCESSING & OBSERVERS
    // =====================================================================
    function processExistingCards() {
        document.querySelectorAll('.scene-card').forEach(n => {
            enhanceSceneOrGallery(n, 'scene');
        });
        document.querySelectorAll('.gallery-card').forEach(n => {
            enhanceSceneOrGallery(n, 'gallery');
        });
        document.querySelectorAll('.group-card').forEach(n => {  // ← added
            enhanceGroupCard(n);
        });
        document.querySelectorAll('.scene-marker-card').forEach(n => {
            applyBlurredBackground(n);
        });
        replaceMissingStudioImages();
        replaceStudioPageLogo();
        replaceScenePageStudioLogo();
        replaceGalleryPageStudioLogo();
    }

    function setupPageListeners() {
        csLib.PathElementListener('/scenes', '.scene-card', (card) => {
            enhanceSceneOrGallery(card, 'scene');
        });

        csLib.PathElementListener('/galleries', '.gallery-card', (card) => {
            enhanceSceneOrGallery(card, 'gallery');
        });

        csLib.PathElementListener('/groups', '.group-card', (card) => {  // ← added
            enhanceGroupCard(card);
        });

        csLib.PathElementListener('/studios/', '#studio-page', () => {
            csLib.waitForElement(
                '#studio-page .detail-header-image img.logo',
                replaceStudioPageLogo
            );
        });

        csLib.PathElementListener('/scenes/', '.scene-header-container', () => {
            csLib.waitForElement(
                '.scene-header-container h1.studio-logo',
                replaceScenePageStudioLogo
            );
        });

        csLib.PathElementListener('/galleries/', '.gallery-header-container', () => {
            csLib.waitForElement(
                '.gallery-header-container h1.studio-logo',
                replaceGalleryPageStudioLogo
            );
        });

        csLib.PathElementListener('/scenes/markers', '.scene-marker-card', (card) => {
            applyBlurredBackground(card);
        });

        // Fallback mutation observer for dynamically added content
        new MutationObserver(mutations => {
            for (const m of mutations) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;

                    if (node.classList?.contains('scene-card')) {
                        enhanceSceneOrGallery(node, 'scene');
                    }
                    if (node.classList?.contains('gallery-card')) {
                        enhanceSceneOrGallery(node, 'gallery');
                    }
                    if (node.classList?.contains('group-card')) {  // ← added
                        enhanceGroupCard(node);
                    }
                    if (node.classList?.contains('scene-marker-card')) {
                        applyBlurredBackground(node);
                    }

                    if (node.querySelectorAll) {
                        node.querySelectorAll('.scene-card').forEach(n => {
                            enhanceSceneOrGallery(n, 'scene');
                        });
                        node.querySelectorAll('.gallery-card').forEach(n => {
                            enhanceSceneOrGallery(n, 'gallery');
                        });
                        node.querySelectorAll('.scene-marker-card').forEach(n => {
                            applyBlurredBackground(n);
                        });
                        node.querySelectorAll('.group-card').forEach(n => {  // ← added
                            enhanceGroupCard(n);
                        });
                        replaceMissingStudioImages(node);
                    }
                });
            }
        }).observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // =====================================================================
    // BOOTSTRAP
    // =====================================================================
    function waitForDependencies() {
        if (typeof csLib !== 'undefined') {
            init().catch(err => {
                console.error('[Studio Logo Enhancer] Initialization failed:', err);
            });
        } else {
            console.log('[Studio Logo Enhancer] Waiting for csLib...');
            setTimeout(waitForDependencies, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForDependencies);
    } else {
        waitForDependencies();
    }

    console.log('[Studio Logo Enhancer] Script loaded, waiting for dependencies...');
})();