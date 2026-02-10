function getRatingColorFromClass(ratingEl) {
  const classes = ratingEl.classList;
  for (const cls of classes) {
    const match = cls.match(/^rating-100-(\d+)$/);
    if (match) {
      const value = parseInt(match[1], 10);
      switch (value) {
        case 2: return '#fff';
        case 4: return '#f90';
        case 6: return '#fcfd00';
        case 8: return '#9eff00';
        case 10: return '#00bf02';
        case 12: return '#00ffd5';
        case 14: return '#3100ff';
        case 16: return '#d800ff';
        case 18: return '#f00';
        case 20: return 'var(--accent)';
        default: return '#fff';
      }
    }
  }
  return '#fff';
}

function enhanceSceneCards() {
  document.querySelectorAll('.scene-card').forEach(card => {
    const thumb = card.querySelector('.thumbnail-section');
    if (!thumb) return;

    const ratingBanner = card.querySelector('.rating-banner');
    if (!ratingBanner) return;

    // Avoid duplicates
    if (thumb.querySelector('.rating-overlay')) return;

    const match = ratingBanner.textContent.match(/(\d+(\.\d+)?)/);
    const ratingValue = match ? match[1] : '';
    const color = getRatingColorFromClass(ratingBanner);

    // Create overlay container
    const ratingBox = document.createElement('div');
    ratingBox.className = 'rating-overlay';
    ratingBox.style.backgroundColor = color;
    ratingBox.style.display = 'flex';
    ratingBox.style.alignItems = 'center';
    ratingBox.style.justifyContent = 'center';
    ratingBox.style.padding = '2px 6px';
    ratingBox.style.borderRadius = '4px';
    ratingBox.style.position = 'absolute';
    ratingBox.style.bottom = '12px';
    ratingBox.style.left = '8px';
    ratingBox.style.fontSize = '1em';
    ratingBox.style.fontWeight = 'bold';
    ratingBox.style.color = '#000';
    ratingBox.style.zIndex = '20';
    ratingBox.style.boxShadow = '0 0 3px rgba(0,0,0,0.5)';

    // Star span
    const star = document.createElement('span');
    star.textContent = '★';
    star.style.marginRight = '4px';

    // Number span
    const number = document.createElement('span');
    number.textContent = ratingValue;

    ratingBox.appendChild(star);
    ratingBox.appendChild(number);
    thumb.appendChild(ratingBox);

    // Hide original banner
    ratingBanner.style.display = 'none';
  });
}

// --- MutationObserver for React updates ---
const sceneObserver = new MutationObserver(() => {
  sceneObserver.disconnect();
  enhanceSceneCards();
  sceneObserver.observe(document.body, { childList: true, subtree: true });
});

// Initial run
enhanceSceneCards();
sceneObserver.observe(document.body, { childList: true, subtree: true });
