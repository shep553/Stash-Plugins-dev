// Studio Card Enhancer

(function () {
  const CARD_SELECTOR = ".studio-card.grid-card.card";

  // ─── Config ──────────────────────────────────────────────────────────────────

  const CONFIG = {
    detailsPersistOnHover:  false,
    detailsFade:            true,
    buttonGap:              "4px",
    buttonTopOffset:        4,
    buttonLeftOffset:       5,
    thumbnailPaddingBottom: 25,
    transitionDuration:     ".5s",
  };

  // ─── Static styles via stylesheet ────────────────────────────────────────────

  const style = document.createElement("style");
  style.textContent = `
    ${CARD_SELECTOR} .thumbnail-section {
      position: relative;
      padding-bottom: ${CONFIG.thumbnailPaddingBottom}px;
    }
    ${CARD_SELECTOR} .card-section {
      position: absolute;
      left: 5px;
      bottom: 6px;
      width: 100%;
      padding: 2px 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition: max-height ${CONFIG.transitionDuration} ease-in-out;
    }
    ${CARD_SELECTOR} .card-section-title,
    ${CARD_SELECTOR} .TruncatedText {
      margin: 0;
      padding: 0;
      display: block;
    }
    ${CARD_SELECTOR} .studio-card__details {
      display: block;
      ${CONFIG.detailsFade ? `opacity: 0; transition: opacity ${CONFIG.transitionDuration} ease-in-out;` : ""}
    }
    ${CARD_SELECTOR} .card-popovers.btn-group[data-moved] {
      position: absolute;
      display: flex;
      flex-direction: column;
      gap: ${CONFIG.buttonGap};
      z-index: 10;
    }
  `;
  document.head.appendChild(style);

  // ─── Per-card enhancement ─────────────────────────────────────────────────────

  function enhanceStudioCard(card) {
    if (card.dataset.enhanced) return;
    card.dataset.enhanced = "true";

    const cardSection = card.querySelector(".card-section");
    const title       = cardSection?.querySelector(".card-section-title");
    const truncated   = title?.querySelector(".TruncatedText");
    if (!cardSection || !title || !truncated) return;

    const thumbnail = card.querySelector(".thumbnail-section");
    const checkbox  = card.querySelector(".card-controls");
    const btnGroup  = card.querySelector(".card-popovers.btn-group");

    const details    = cardSection.querySelector(".studio-card__details");
    const hasDetails = details && details.textContent.trim().length > 0;

    if (hasDetails) {
      if (!CONFIG.detailsFade) details.style.opacity = "1";

      card.addEventListener("mouseenter", () => {
        cardSection.classList.add("expanded");
        cardSection.style.maxHeight = cardSection.scrollHeight + "px";
        cardSection.style.overflow  = "visible";
        if (CONFIG.detailsFade) details.style.opacity = "1";
      });

      card.addEventListener("mouseleave", () => {
        if (CONFIG.detailsPersistOnHover) return;
        cardSection.classList.remove("expanded");
        cardSection.style.maxHeight = cardSection.dataset.collapsedHeight + "px";
        cardSection.style.overflow  = "hidden";
        if (CONFIG.detailsFade) details.style.opacity = "0";
      });
    }

    if (thumbnail && checkbox && btnGroup && !btnGroup.dataset.moved) {
      btnGroup.dataset.moved = "true";
      thumbnail.appendChild(btnGroup);
    }

    // ── PHASE 2 (deferred): measure only ──

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const h = truncated.offsetHeight + 4;
      cardSection.style.maxHeight = h + "px";
      cardSection.dataset.collapsedHeight = h;

      if (thumbnail && checkbox && btnGroup && btnGroup.dataset.moved) {
        const thumbRect = thumbnail.getBoundingClientRect();
        const chkRect   = checkbox.getBoundingClientRect();
        btnGroup.style.top  = `${chkRect.top  - thumbRect.top  - 5}px`;
        btnGroup.style.left = `${chkRect.right - thumbRect.left + CONFIG.buttonLeftOffset}px`;
      }
    }));
  }

  // ─── MutationObserver ─────────────────────────────────────────────────────────

  const observer = new MutationObserver(() => {
    observer.disconnect();
    document.querySelectorAll(CARD_SELECTOR).forEach(enhanceStudioCard);
    observer.observe(document.body, { childList: true, subtree: true });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
