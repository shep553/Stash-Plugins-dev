(function () {
    'use strict';

    const PLUGIN_ID = 'StudioLogoEnhancer';
    const LOGO_SIZE = 40;
    const LOGO_GAP = 22;
    const defaultStudioOverrides = {
        "giorgio grandi": { force: ["logo-wide", "logo-skinny"], remove: ["logo-fat"] },
        "futanaria": { force: ["logo-wide", "logo-fat"], remove: ["logo-skinny"] },
        "tushy": { force: ["logo-wide", "logo-fat"], remove: ["logo-skinny"] },
        "red light district": { force: ["logo-wide", "logo-skinny"], remove: ["logo-fat"] }
    };
    const defaultConfig = { 
        useInitials: true, 
        persistentColors: true,
        studioOverrides: JSON.stringify(defaultStudioOverrides)
    };
    
    let config = { 
        useInitials: true,
        persistentColors: true,
        studioOverrides: {}
    };
    const studioColorCache = new Map();

    async function init() {
        await reloadConfig();
        console.log('[Studio Logo Enhancer] Starting with config:', config);
        
        // Save studio overrides to config.yml if not already present
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
        
        // Parse studioOverrides from JSON string
        try {
            config.studioOverrides = savedConfig.studioOverrides 
                ? JSON.parse(savedConfig.studioOverrides)
                : JSON.parse(defaultConfig.studioOverrides);
        } catch (e) {
            console.error('[Studio Logo Enhancer] Error parsing studioOverrides:', e);
            config.studioOverrides = JSON.parse(defaultConfig.studioOverrides);
        }
    }

    function colorForStudio(name) {
        if (!config.persistentColors) return `hsl(${Math.random() * 360}, 68%, 55%)`;
        if (studioColorCache.has(name)) return studioColorCache.get(name);
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
        const hue = Math.abs(hash) % 360;
        const color = `hsl(${hue}, 68%, 55%)`;
        studioColorCache.set(name, color);
        return color;
    }

    function createPlaceholder(name) {
        const text = (name || "Unknown").trim();
        
        if (config.useInitials) {
            // Initials mode with colored background
            const color = colorForStudio(text);
            const initials = text.split(/\s+/).map(w => w[0] || "").join("").toUpperCase().slice(0, 2);
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_SIZE} ${LOGO_SIZE}">
                <rect width="100%" height="100%" fill="${color}" rx="4" ry="4"/>
                <text x="50%" y="50%" font-family="sans-serif" font-size="${Math.floor(LOGO_SIZE * 0.6)}" 
                      fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
            </svg>`.trim();
            return "data:image/svg+xml;base64," + btoa(svg);
        } else {
            // Full text mode
            const words = text.split(/\s+/);
            let lines = [], current = "";
            for (const w of words) {
                const test = current ? current + " " + w : w;
                if (test.length > 8 && current) { lines.push(current); current = w; }
                else current = test;
            }
            if (current) lines.push(current);
            if (lines.length > 3) lines = [lines[0], lines[1], lines.slice(2).join(" ")];

            const maxLen = Math.max(...lines.map(l => l.length));
            const fontSize = maxLen <= 6 ? 10 : maxLen <= 11 ? 7 : maxLen <= 12 ? 7 : maxLen <= 14 ? 5 : maxLen <= 16 ? 5 : 7;
            const lineHeight = fontSize + 2;
            const totalHeight = lines.length * lineHeight;
            const startY = (LOGO_SIZE - totalHeight) / 2 + fontSize;

            const textSvg = lines.map((line, i) => 
                `<text x="50%" y="${startY + i * lineHeight}" font-family="sans-serif" font-size="${fontSize}" 
                       fill="white" text-anchor="middle">${line}</text>`
            ).join("");

            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_SIZE} ${LOGO_SIZE}">
                <rect width="100%" height="100%" fill="transparent" rx="4" ry="4"/>${textSvg}
            </svg>`.trim();
            return "data:image/svg+xml;base64," + btoa(svg);
        }
    }

    function normalizeStudioName(name) {
        return (name || "").toLowerCase().replace(/logo$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function applyStudioOverride(img) {
        const studio = normalizeStudioName(img.getAttribute('alt') || img.closest('a')?.getAttribute('title'));
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

            img.classList.remove('logo-wide', 'logo-tall', 'logo-square', 'logo-skinny', 'logo-fat');
            if (ratio > 1.1) img.classList.add('logo-wide');
            else if (ratio < 0.75) img.classList.add('logo-tall');
            else img.classList.add('logo-square');
            if (fill < 0.28) img.classList.add('logo-skinny');
            else if (fill > 0.4) img.classList.add('logo-fat');
            applyStudioOverride(img);
        };
        if (img.complete && img.naturalWidth) img.onload();
    }

    function tagActualLines(card, el) {
        requestAnimationFrame(() => {
            const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
            const w = el.getBoundingClientRect().width;
            el.style.width = `${w}px`;
            const h = el.getBoundingClientRect().height;
            el.style.width = '';
            const lines = Math.max(1, Math.round(h / lh));
            [...card.classList].forEach(c => c.startsWith('lines-actual-') && card.classList.remove(c));
            card.classList.add(`lines-actual-${lines}`);
        });
    }

    function enhanceSceneOrGallery(card, type) {
        if (card.dataset.studioLogoProcessed) return;
        card.dataset.studioLogoProcessed = "true";

        const section = card.querySelector('.card-section');
        if (!section) return;

        const overlay = card.querySelector('.studio-overlay');
        if (overlay) {
            let link = overlay.querySelector('a');
            let studioName = link?.getAttribute('title')?.trim() || link?.textContent?.trim() || 
                           overlay.querySelector('img')?.alt?.trim() || "Unknown";

            let img = overlay.querySelector('img')?.cloneNode(true);
            overlay.remove();

            if (!img) {
                img = document.createElement('img');
                img.src = createPlaceholder(studioName);
                img.alt = studioName;
                img.classList.add('placeholder-studio');
            }
            classifyLogo(img);

            const header = document.createElement('div');
            header.className = 'card-header-row';
            const thumb = document.createElement('div');
            thumb.className = 'studio-thumb';
            const linkElem = document.createElement('a');
            linkElem.href = link?.href || '#';
            linkElem.appendChild(img);
            thumb.appendChild(linkElem);

            const titleDate = document.createElement('div');
            titleDate.className = 'title-date';
            const title = section.querySelector('.card-section-title');
            const date = section.querySelector(type === 'scene' ? '.scene-card__date' : '.gallery-card__date');
            if (title) titleDate.appendChild(title);
            if (date) titleDate.appendChild(date);

            header.appendChild(thumb);
            header.appendChild(titleDate);
            section.prepend(header);
        }

        const desc = section.querySelector('.scene-card__description, .gallery-card__description');
        if (!desc || !desc.textContent.trim()) card.classList.add('no-description');

        const date = section.querySelector(type === 'scene' ? '.scene-card__date' : '.gallery-card__date');
        card.classList.add(date && date.textContent.trim() ? 'has-date' : 'no-date');

        const titleEl = section.querySelector('.card-section-title .TruncatedText') || 
                       section.querySelector('.card-section-title');
        if (titleEl) {
            tagActualLines(card, titleEl);
            try { new ResizeObserver(() => tagActualLines(card, titleEl)).observe(titleEl); } catch (e) {}
        }
    }

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
        img.classList.add('placeholder-studio');
        img.dataset.studioLogoProcessed = "true";
    }

    function replaceScenePageStudioLogo() {
        const img = document.querySelector('.scene-studio-image img.studio-logo');
        if (!img || img.dataset.studioLogoProcessed) return;
        const src = img.getAttribute('src') || "";
        if (!src.includes("default=true")) return;
        const name = img.getAttribute('alt')?.replace(/logo$/i, '').trim() || 
                    document.querySelector('.scene-studio-image a')?.getAttribute('title') || "Unknown";
        img.src = createPlaceholder(name);
        img.removeAttribute('srcset');
        img.classList.add('placeholder-studio');
        img.dataset.studioLogoProcessed = "true";
        classifyLogo(img);
    }

    function replaceGalleryPageStudioLogo() {
        const img = document.querySelector('.gallery-studio-image img.studio-logo');
        if (!img || img.dataset.studioLogoProcessed) return;
        const src = img.getAttribute('src') || "";
        if (!src.includes("default=true")) return;
        const name = img.getAttribute('alt')?.replace(/logo$/i, '').trim() || 
                    document.querySelector('.gallery-studio-image a')?.getAttribute('title') || "Unknown";
        img.src = createPlaceholder(name);
        img.removeAttribute('srcset');
        img.classList.add('placeholder-studio');
        img.dataset.studioLogoProcessed = "true";
        classifyLogo(img);
    }

    function processExistingCards() {
        document.querySelectorAll('.scene-card').forEach(n => enhanceSceneOrGallery(n, 'scene'));
        document.querySelectorAll('.gallery-card').forEach(n => enhanceSceneOrGallery(n, 'gallery'));
        replaceMissingStudioImages();
        replaceStudioPageLogo();
        replaceScenePageStudioLogo();
        replaceGalleryPageStudioLogo();
    }

    function setupPageListeners() {
        csLib.PathElementListener('/scenes', '.scene-card', (card) => enhanceSceneOrGallery(card, 'scene'));
        csLib.PathElementListener('/galleries', '.gallery-card', (card) => enhanceSceneOrGallery(card, 'gallery'));
        csLib.PathElementListener('/studios/', '#studio-page', () => {
            csLib.waitForElement('#studio-page .detail-header-image img.logo', replaceStudioPageLogo);
        });
        csLib.PathElementListener('/scenes/', '.scene-studio-image', () => {
            csLib.waitForElement('.scene-studio-image img.studio-logo', replaceScenePageStudioLogo);
        });
        csLib.PathElementListener('/galleries/', '.gallery-studio-image', () => {
            csLib.waitForElement('.gallery-studio-image img.studio-logo', replaceGalleryPageStudioLogo);
        });

        new MutationObserver(mutations => {
            for (const m of mutations) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (node.classList?.contains('scene-card')) enhanceSceneOrGallery(node, 'scene');
                    if (node.classList?.contains('gallery-card')) enhanceSceneOrGallery(node, 'gallery');
                    if (node.querySelectorAll) {
                        node.querySelectorAll('.scene-card').forEach(n => enhanceSceneOrGallery(n, 'scene'));
                        node.querySelectorAll('.gallery-card').forEach(n => enhanceSceneOrGallery(n, 'gallery'));
                        replaceMissingStudioImages(node);
                    }
                });
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    function reprocessAll() {
        console.log('[Studio Logo Enhancer] Reprocessing all cards...');
        document.querySelectorAll('[data-studio-logo-processed]').forEach(el => {
            delete el.dataset.studioLogoProcessed;
        });
        processExistingCards();
    }

    window.StudioLogoEnhancer = {
        version: '4.0.0',
        addStudioOverride: async (studioName, override) => {
            const normalized = normalizeStudioName(studioName);
            config.studioOverrides[normalized] = override;
            await csLib.setConfiguration(PLUGIN_ID, { 
                studioOverrides: JSON.stringify(config.studioOverrides) 
            });
            console.log(`[Studio Logo Enhancer] Added override for "${normalized}":`, override);
        },
        removeStudioOverride: async (studioName) => {
            const normalized = normalizeStudioName(studioName);
            delete config.studioOverrides[normalized];
            await csLib.setConfiguration(PLUGIN_ID, { 
                studioOverrides: JSON.stringify(config.studioOverrides) 
            });
            console.log(`[Studio Logo Enhancer] Removed override for "${normalized}"`);
        },
        listOverrides: () => config.studioOverrides,
        reprocess: reprocessAll
    };

    function waitForDependencies() {
        if (typeof csLib !== 'undefined') {
            init().catch(err => console.error('[Studio Logo Enhancer] Initialization failed:', err));
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