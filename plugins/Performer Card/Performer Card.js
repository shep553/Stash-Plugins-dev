function getRatingColor(ratingBanner) {
  const classes = ratingBanner.classList;
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

function enhancePerformerCards() {
  document.querySelectorAll('.performer-card').forEach(card => {
    const thumb = card.querySelector('.thumbnail-section');

    // --- MOVE & STACK POPOVERS ---
    const popovers = card.querySelector('.card-popovers');
    if (thumb && popovers && !thumb.contains(popovers)) {
      thumb.appendChild(popovers);
    }

    // --- MOVE RATING INLINE WITH STAR-ONLY COLOR ---
    const ratingBanner = card.querySelector('.rating-banner');
    const titleRow = card.querySelector('.card-section-title');

    if (ratingBanner && titleRow && !titleRow.querySelector('.rating-inline')) {
      const match = ratingBanner.textContent.match(/(\d+(\.\d+)?)/);
      const ratingValue = match ? match[1] : '';
      const color = getRatingColor(ratingBanner);

      // Container span
      const ratingSpan = document.createElement('span');
      ratingSpan.className = 'rating-inline';
      ratingSpan.style.display = 'flex';
      ratingSpan.style.alignItems = 'center';

      // Star span
      const star = document.createElement('span');
      star.textContent = '★';
      star.style.color = color;
      star.style.marginRight = '2px';

      // Number span
      const number = document.createElement('span');
      number.textContent = ratingValue;
      number.style.color = 'inherit'; // default text color

      ratingSpan.appendChild(star);
      ratingSpan.appendChild(number);
      titleRow.appendChild(ratingSpan);
    }
  });
}

// --- MutationObserver for React updates ---
const observer = new MutationObserver(() => {
  observer.disconnect();
  enhancePerformerCards();
  observer.observe(document.body, { childList: true, subtree: true });
});

// Initial run
enhancePerformerCards();
observer.observe(document.body, { childList: true, subtree: true });
