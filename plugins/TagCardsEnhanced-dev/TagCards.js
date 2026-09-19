// Tag Card Enhancer

(function () {
  const CARD_SELECTOR = ".tag-card.grid-card.card";

  // ─── Config ──────────────────────────────────────────────────────────────────

  const CONFIG = {
    detailsPersistOnHover: false,
    detailsFade:           true,
    buttonGap:             "4px",
    buttonTopOffset:       4,
    buttonLeftOffset:      5,
    transitionDuration:    ".5s",
  };



  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function shrinkDefaultImage(img) {
    if (img?.src.includes("default=true")) {
      img.classList.add("default-image");
    }
  }

  // ─── Per-card enhancement ─────────────────────────────────────────────────────

  function enhanceTagCard(card) {
    if (card.dataset.enhanced) return;
    card.dataset.enhanced = "true";

    const cardSection = card.querySelector(".card-section");
    const title       = cardSection?.querySelector(".card-section-title");
    const truncated   = title?.querySelector(".TruncatedText");
    if (!cardSection || !title || !truncated) return;

    const thumbnail = card.querySelector(".thumbnail-section");
    const checkbox  = card.querySelector(".card-controls");
    const btnGroup  = card.querySelector(".card-popovers.btn-group");

    // ── PHASE 1 (sync) ──

    const img = thumbnail?.querySelector("img");
    if (img) shrinkDefaultImage(img);

    // Overlay
    let overlay = cardSection.querySelector(".card-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "card-overlay";
      cardSection.prepend(overlay);
    }

    // Details
    const details        = cardSection.querySelector(".tag-parent-tags");
    const tagDescription = cardSection.querySelector(".TruncatedText.tag-description");
    const allDetails     = [details, tagDescription].filter(Boolean);
    const hasDetails     = allDetails.length > 0;

    if (hasDetails) {
      card.addEventListener("mouseenter", () => {
        overlay.style.opacity       = "1";
        cardSection.style.overflow  = "visible";
        cardSection.style.maxHeight = cardSection.scrollHeight + "px";
        if (CONFIG.detailsFade) allDetails.forEach(d => d.style.opacity = "1");
      });

      card.addEventListener("mouseleave", () => {
        overlay.style.opacity = "0";
        if (CONFIG.detailsPersistOnHover) return;
        cardSection.style.maxHeight = cardSection.dataset.collapsedHeight + "px";
        cardSection.style.overflow  = "hidden";
        if (CONFIG.detailsFade) allDetails.forEach(d => d.style.opacity = "0");
      });
    }

    if (thumbnail && checkbox && btnGroup && !btnGroup.dataset.moved) {
      btnGroup.dataset.moved = "true";
      thumbnail.appendChild(btnGroup);
    }

    // ── PHASE 2 (deferred): measurement only ──

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const h = truncated.offsetHeight + 4;
      cardSection.style.maxHeight = h + "px";
      cardSection.dataset.collapsedHeight = h;

      if (thumbnail && checkbox && btnGroup && btnGroup.dataset.moved) {
        const thumbRect = thumbnail.getBoundingClientRect();
        const chkRect   = checkbox.getBoundingClientRect();
        btnGroup.style.left = `${chkRect.right - thumbRect.left + CONFIG.buttonLeftOffset}px`;

        const firstButton = btnGroup.querySelector("button, .btn, .minimal");
        if (firstButton) {
          const btnRect        = firstButton.getBoundingClientRect();
          const checkboxCenter = (chkRect.top  - thumbRect.top) + chkRect.height  / 2;
          const btnCenter      = (btnRect.top   - thumbRect.top) + btnRect.height  / 2;
          btnGroup.style.top   = `${checkboxCenter - btnCenter}px`;
        } else {
          btnGroup.style.top = `${CONFIG.buttonTopOffset}px`;
        }
      }
    }));
  }

  // ─── MutationObserver ─────────────────────────────────────────────────────────

  const observer = new MutationObserver(() => {
    observer.disconnect();
    document.querySelectorAll(CARD_SELECTOR).forEach(enhanceTagCard);
    observer.observe(document.body, { childList: true, subtree: true });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();