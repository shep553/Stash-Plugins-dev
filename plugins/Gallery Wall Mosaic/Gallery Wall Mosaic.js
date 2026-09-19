(function () {
  'use strict';

  const PLUGIN_ID = 'Gallery Wall Mosaic';

  const defaultConfig = {
    horizontalMasonry: false,
    gutterSize: 6
};

let config = { ...defaultConfig };

async function reloadConfig() {
    const savedConfig = await csLib.getConfiguration(PLUGIN_ID, {});
    config.horizontalMasonry = savedConfig.horizontalMasonry ?? defaultConfig.horizontalMasonry;

    const parsedGutter = parseFloat(savedConfig.gutterSize);
    config.gutterSize = Number.isFinite(parsedGutter) ? parsedGutter : defaultConfig.gutterSize;
}

  // =====================================================================
  // ZOOM / IMAGE HELPERS
  // =====================================================================
  function getZoomScale() {
    const slider = document.querySelector('input[type="range"]');
    if (!slider) return 1;

    const min = parseFloat(slider.min || 50);
    const max = parseFloat(slider.max || 150);
    const val = parseFloat(slider.value);

    return (val - min) / (max - min) * 0.8 + 0.6;
  }

  function waitForImages(callback) {
    const imgs = Array.from(document.querySelectorAll('.GalleryWallCard-img'));
    let remaining = imgs.length;

    if (remaining === 0) return callback();

    imgs.forEach(img => {
      if (img.complete && img.naturalHeight > 0) {
        remaining--;
        if (remaining === 0) callback();
      } else {
        img.onload = img.onerror = () => {
          remaining--;
          if (remaining === 0) callback();
        };
      }
    });
  }

  function cacheImageRatios() {
    document.querySelectorAll('.GalleryWallCard-img').forEach(img => {
      if (!img.dataset.ratio && img.naturalWidth > 0) {
        img.dataset.ratio = img.naturalHeight / img.naturalWidth;
      }
    });
  }

  // =====================================================================
  // MASONRY LAYOUTS
  // =====================================================================
  function applyStableMasonry() {
    const wall = document.querySelector('.GalleryWall');
    if (!wall) return;

    const cards = Array.from(wall.querySelectorAll('.GalleryWallCard'));
    if (!cards.length) return;

    cacheImageRatios();
    wall.style.position = "relative";
    wall.style.height = "auto";

    if (config.horizontalMasonry) {
      applyRowMasonry(wall, cards);
    } else {
      applyColumnMasonry(wall, cards);
    }
  }

  function applyColumnMasonry(wall, cards) {
    const zoom = getZoomScale();
    const baseCardWidth = 280;
    const minCardWidth = baseCardWidth * zoom;
    const gutter = config.gutterSize;

    const wallWidth = wall.clientWidth;
    const columnCount = Math.max(1, Math.floor((wallWidth + gutter) / (minCardWidth + gutter)));
    const cardWidth = (wallWidth - gutter * (columnCount - 1)) / columnCount;

    const columnHeights = new Array(columnCount).fill(0);

    cards.forEach(card => {
      const img = card.querySelector('.GalleryWallCard-img');
      const ratio = parseFloat(img?.dataset?.ratio);
      if (!ratio) return;

      const imgHeight = cardWidth * ratio;

      card.style.position = "absolute";
      card.style.width = cardWidth + "px";
      card.style.height = imgHeight + "px";

      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";

      const minCol = columnHeights.indexOf(Math.min(...columnHeights));
      const x = (cardWidth + gutter) * minCol;
      const y = columnHeights[minCol];

      card.style.transform = `translate(${x}px, ${y}px)`;
      columnHeights[minCol] += imgHeight + gutter;
    });

    wall.style.height = Math.max(...columnHeights) + "px";
  }

function applyRowMasonry(wall, cards) {
    const zoom = getZoomScale();
    const targetRowHeight = 325 * zoom;
    const gutter = config.gutterSize;
    const wallWidth = wall.clientWidth;

    let row = [];
    let aspectSum = 0; // sum of width/height at targetRowHeight
    let y = 0;

    const flushRow = (isLast) => {
      if (!row.length) return;
      const totalGutter = gutter * (row.length - 1);
      let rowHeight = (wallWidth - totalGutter) / aspectSum;
      if (isLast) rowHeight = Math.min(rowHeight, targetRowHeight);

      let x = 0;
      row.forEach(({ card, img, aspect }) => {
        const w = rowHeight * aspect;
        card.style.position = "absolute";
        card.style.width = w + "px";
        card.style.height = rowHeight + "px";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        card.style.transform = `translate(${x}px, ${y}px)`;
        x += w + gutter;
      });

      y += rowHeight + gutter;
      row = [];
      aspectSum = 0;
    };

    cards.forEach(card => {
      const img = card.querySelector('.GalleryWallCard-img');
      const ratio = parseFloat(img?.dataset?.ratio); // h/w
      if (!ratio) return;
      const aspect = 1 / ratio; // w/h

      row.push({ card, img, aspect });
      aspectSum += aspect;

      const totalGutter = gutter * (row.length - 1);
      const widthAtTarget = targetRowHeight * aspectSum + totalGutter;
      if (widthAtTarget >= wallWidth) flushRow(false);
    });
    flushRow(true);

    wall.style.height = y + "px";
  }

  // =====================================================================
  // HOVER SCRUBBER / ZOOM SLIDER
  // =====================================================================
  function initHoverScrubbers() {
    document.querySelectorAll('.preview-scrubber').forEach(scrubber => {
      const card = scrubber.closest('.GalleryWallCard');
      if (!card) return;

      const img = card.querySelector('.GalleryWallCard-img');
      const area = scrubber.querySelector('.hover-scrubber-area');
      const indicator = scrubber.querySelector('.hover-scrubber-indicator');
      if (!area || !indicator || !img) return;

      if (area.dataset.scrubberInit) return;
      area.dataset.scrubberInit = "true";

      const cover = img.dataset.cover || img.src;
      const frames = img.dataset.frames ? JSON.parse(img.dataset.frames) : [];
      if (!frames.length) return;

      area.addEventListener('mouseenter', () => {
        card.classList.add('scrubbing');
      });

      area.addEventListener('mouseleave', () => {
        card.classList.remove('scrubbing');
        img.src = cover;
        indicator.style.width = "0%";
      });

      area.addEventListener('mousemove', (e) => {
        const rect = area.getBoundingClientRect();
        const t = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        const frameIndex = Math.floor(t * (frames.length - 1));
        img.src = frames[frameIndex];

        indicator.style.width = "14%";
        indicator.style.left = (t * 100) + "%";
      });
    });
  }

  function bindZoomSlider() {
    const slider = document.querySelector('input[type="range"]');
    if (!slider || slider.dataset.masonryBound) return;

    slider.dataset.masonryBound = "true";
    slider.addEventListener('input', () => {
      applyStableMasonry();
    });
  }

  function initMasonry() {
    waitForImages(() => {
      cacheImageRatios();
      applyStableMasonry();
      initHoverScrubbers();
      bindZoomSlider();
    });
  }

  // =====================================================================
  // BOOTSTRAP
  // =====================================================================
  async function init() {
    await reloadConfig();
    console.log('[Gallery Wall Mosaic] Starting with config:', config);

    window.addEventListener('load', initMasonry);
    window.addEventListener('resize', initMasonry);

    new MutationObserver((mutations) => {
      const relevant = mutations.some(m =>
        Array.from(m.addedNodes).some(n =>
          n.nodeType === 1 && (n.classList?.contains('GalleryWallCard') || n.querySelector?.('.GalleryWallCard'))
        ) ||
        Array.from(m.removedNodes).some(n =>
          n.nodeType === 1 && (n.classList?.contains('GalleryWallCard') || n.querySelector?.('.GalleryWallCard'))
        )
      );
      if (relevant) initMasonry();
    }).observe(document.body, { childList: true, subtree: true });

    initMasonry();

    console.log('[Gallery Wall Mosaic] Initialized successfully');
  }

  function waitForDependencies() {
    if (typeof csLib !== 'undefined') {
      init().catch(err => {
        console.error('[Gallery Wall Mosaic] Initialization failed:', err);
      });
    } else {
      console.log('[Gallery Wall Mosaic] Waiting for csLib...');
      setTimeout(waitForDependencies, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDependencies);
  } else {
    waitForDependencies();
  }

  console.log('[Gallery Wall Mosaic] Script loaded, waiting for dependencies...');
})();