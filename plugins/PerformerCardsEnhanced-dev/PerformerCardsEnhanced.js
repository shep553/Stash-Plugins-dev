// Performer Card Enhancer

(function () {
  const CARD_SELECTOR = ".performer-card";

  // ─── Rating colour map ──────────────────────────────────────────────────────

  const RATING_COLORS = {
    2:  '#fff',
    4:  '#f90',
    6:  '#fcfd00',
    8:  '#9eff00',
    10: '#00bf02',
    12: '#00ffd5',
    14: '#3100ff',
    16: '#d800ff',
    18: '#f00',
    20: 'var(--accent)',
  };

  function getRatingColor(ratingBanner) {
    for (const cls of ratingBanner.classList) {
      const match = cls.match(/^rating-100-(\d+)$/);
      if (match) {
        return RATING_COLORS[parseInt(match[1], 10)] ?? '#fff';
      }
    }
    return '#fff';
  }

  // ─── Per-card enhancement ───────────────────────────────────────────────────

  function enhanceCard(card) {
    const thumb = card.querySelector('.thumbnail-section');

    // Move popovers into the thumbnail so they stack correctly
    const popovers = card.querySelector('.card-popovers');
    if (thumb && popovers && !thumb.contains(popovers)) {
      thumb.appendChild(popovers);
    }

    // Inject an inline star rating into the title row
    const ratingBanner = card.querySelector('.rating-banner');
    const titleRow     = card.querySelector('.card-section-title');

    if (ratingBanner && titleRow && !titleRow.querySelector('.rating-inline')) {
      const match       = ratingBanner.textContent.match(/(\d+(\.\d+)?)/);
      const ratingValue = match ? match[1] : '';
      const color       = getRatingColor(ratingBanner);

      const ratingSpan = document.createElement('span');
      ratingSpan.className = 'rating-inline';
      Object.assign(ratingSpan.style, { display: 'flex', alignItems: 'center' });

      const star = document.createElement('span');
      star.textContent = '\u2605';
      Object.assign(star.style, { color, marginRight: '2px' });

      const number = document.createElement('span');
      number.textContent = ratingValue;
      number.style.color = 'inherit';

      ratingSpan.append(star, number);
      titleRow.appendChild(ratingSpan);
    }
  }

  function enhanceAllCards() {
    document.querySelectorAll(CARD_SELECTOR).forEach(enhanceCard);
  }

  // ─── MutationObserver ───────────────────────────────────────────────────────
  // No path guard — enhanceAllCards() is a no-op if no performer cards exist
  // on the current page, so there's no cost to running everywhere.

  const observer = new MutationObserver(() => {
    observer.disconnect();
    enhanceAllCards();
    observer.observe(document.body, { childList: true, subtree: true });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();