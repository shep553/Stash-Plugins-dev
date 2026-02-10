
function getZoomScale() {
  const slider = document.querySelector('input[type="range"]');
  if (!slider) return 1;

  // Normalize slider value → scale
  // Adjust min/max if your slider differs
  const min = parseFloat(slider.min || 50);
  const max = parseFloat(slider.max || 150);
  const val = parseFloat(slider.value);

  return (val - min) / (max - min) * 0.8 + 0.6;
}

// --- Wait for all card images to load before applying masonry ---
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

// --- Cache image aspect ratios ---
function cacheImageRatios() {
  document.querySelectorAll('.GalleryWallCard-img').forEach(img => {
    if (!img.dataset.ratio && img.naturalWidth > 0) {
      img.dataset.ratio = img.naturalHeight / img.naturalWidth;
    }
  });
}

// --- Masonry layout with stable heights ---
function applyStableMasonry() {
  const wall = document.querySelector('.GalleryWall');
  if (!wall) return;

  const cards = Array.from(wall.querySelectorAll('.GalleryWallCard'));
  if (!cards.length) return;

  cacheImageRatios();

  const zoom = getZoomScale();
  const baseCardWidth = 280;
  const minCardWidth = baseCardWidth * zoom;
  const gutter = 6;

  const wallWidth = wall.clientWidth;
  const columnCount = Math.max(1, Math.floor((wallWidth + gutter) / (minCardWidth + gutter)));
  const cardWidth = (wallWidth - gutter * (columnCount - 1)) / columnCount;

  const columnHeights = new Array(columnCount).fill(0);

  wall.style.position = "relative";
  wall.style.height = "auto";

  cards.forEach(card => {
    const img = card.querySelector('.GalleryWallCard-img');
    const ratio = parseFloat(img?.dataset?.ratio);
    if (!ratio) return; // skip until loaded

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

// --- Initialize hover scrubbers safely ---
function initHoverScrubbers() {
  document.querySelectorAll('.preview-scrubber').forEach(scrubber => {
    const card = scrubber.closest('.GalleryWallCard');
    if (!card) return; // skip if not inside a card

    const img = card.querySelector('.GalleryWallCard-img');
    const area = scrubber.querySelector('.hover-scrubber-area');
    const indicator = scrubber.querySelector('.hover-scrubber-indicator');
    if (!area || !indicator || !img) return;

    // Prevent duplicate listeners
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

// --- Event listeners ---
window.addEventListener('load', initMasonry);
window.addEventListener('resize', initMasonry);

// --- Observe dynamic content changes ---
new MutationObserver(initMasonry).observe(document.body, { childList: true, subtree: true });
