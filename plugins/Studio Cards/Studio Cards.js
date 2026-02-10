(function () {
    console.log("🔹 Studio Card Enhancer Loaded (Timing-Safe)");

    const DETAILS_PERSIST = false;
    const DETAILS_FADE = true;
    const BUTTON_GAP = "4px";
    const BUTTON_TOP_OFFSET = 4;
    const BUTTON_LEFT_OFFSET = 5;
    const THUMBNAIL_PADDING_BOTTOM = 25;
    const TRANSITION_DURATION = ".5s";

    function setCollapsedHeight(cardSection, truncated) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const collapsedHeight = truncated.offsetHeight + 4;
                cardSection.style.maxHeight = collapsedHeight + "px";
                cardSection.dataset.collapsedHeight = collapsedHeight;
            });
        });
    }

    function enhanceStudioCard(card) {
        const cardSection = card.querySelector(".card-section");
        const title = cardSection?.querySelector(".card-section-title");
        const truncated = title?.querySelector(".TruncatedText");
        if (!cardSection || !title || !truncated) return;

        const thumbnail = card.querySelector(".thumbnail-section");
        const checkbox = card.querySelector(".card-controls");
        const btnGroup = card.querySelector(".card-popovers.btn-group");

        // ---- Thumbnail padding fix ----
        if (thumbnail) {
            thumbnail.style.position = "relative";
            const currentPad = parseFloat(getComputedStyle(thumbnail).paddingBottom) || 0;
            if (currentPad < THUMBNAIL_PADDING_BOTTOM)
                thumbnail.style.paddingBottom = THUMBNAIL_PADDING_BOTTOM + "px";
        }

        // ---- Title normalization ----
        title.style.margin = "0";
        title.style.padding = "0";
        title.style.display = "block";
        truncated.style.margin = "0";
        truncated.style.padding = "0";
        truncated.style.display = "block";

        // ---- Card section base ----
        cardSection.style.position = "absolute";
        cardSection.style.left = "5px";
        cardSection.style.bottom = "6px";
        cardSection.style.width = "100%";
        cardSection.style.padding = "2px 6px 2px";
        cardSection.style.overflow = "hidden";
        cardSection.style.display = "flex";
        cardSection.style.flexDirection = "column";
        cardSection.style.gap = "2px";
        cardSection.style.transition = `max-height ${TRANSITION_DURATION} ease-in-out`;

        const details = cardSection.querySelector(".studio-card__details");
        const hasDetails = details && details.textContent.trim().length > 0;

        // ---- Collapse height must be measured AFTER layout ----
        setCollapsedHeight(cardSection, truncated);

        // ---- Hover details ----
        if (hasDetails) {
            if (DETAILS_FADE) {
                details.style.opacity = "0";
                details.style.transition = `opacity ${TRANSITION_DURATION} ease-in-out`;
            } else {
                details.style.opacity = "1";
            }
            details.style.display = "block";

            card.addEventListener("mouseenter", () => {
				cardSection.classList.add("expanded");
                cardSection.style.maxHeight = cardSection.scrollHeight + "px";
                cardSection.style.overflow = "visible";
                if (DETAILS_FADE) details.style.opacity = "1";
            });

            card.addEventListener("mouseleave", () => {
                if (!DETAILS_PERSIST) {
					cardSection.classList.remove("expanded");
                    const collapsed = cardSection.dataset.collapsedHeight;
                    cardSection.style.maxHeight = collapsed + "px";
                    cardSection.style.overflow = "hidden";
                    if (DETAILS_FADE) details.style.opacity = "0";
                }
            });
        }

        // ---- Buttons repositioning ----
        if (thumbnail && checkbox && btnGroup && !btnGroup.dataset.moved) {
            btnGroup.dataset.moved = "true";
            thumbnail.appendChild(btnGroup);

            btnGroup.style.position = "absolute";
            btnGroup.style.display = "flex";
            btnGroup.style.flexDirection = "column";
            btnGroup.style.gap = BUTTON_GAP;
            btnGroup.style.zIndex = "10";

            // Run positioning after layout
			setTimeout(() => {
    try {
        const thumbRect = thumbnail.getBoundingClientRect();
        const chkRect = checkbox.getBoundingClientRect();

        // horizontal: to the right of checkbox
        const leftPx =
            chkRect.right - thumbRect.left + BUTTON_LEFT_OFFSET;
        btnGroup.style.left = `${leftPx}px`;

        // vertical: align FIRST button with checkbox
        const topPx =
            chkRect.top - thumbRect.top - 5; // tweak if needed
        btnGroup.style.top = `${topPx}px`;

    } catch {
        btnGroup.style.top = `${BUTTON_TOP_OFFSET}px`;
        btnGroup.style.left =
            `${checkbox.offsetWidth + BUTTON_LEFT_OFFSET}px`;
    }
}, 50);


        }
    }

    // ---- Enhance all at once AFTER layout ----
    function enhanceAllStudios() {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.querySelectorAll(".studio-card.grid-card.card").forEach(enhanceStudioCard);
            });
        });
    }

    // ---- Initial load delay ----
    const interval = setInterval(() => {
        if (document.querySelector(".studio-card")) {
            enhanceAllStudios();
            clearInterval(interval);
        }
    }, 300);

    // ---- Watch for dynamic changes ----
    const root = document.querySelector("#root");
    if (root) {
        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;

                    if (node.matches(".studio-card.grid-card.card")) {
                        enhanceStudioCard(node);
                    }

                    node.querySelectorAll?.(".studio-card.grid-card.card")
                        .forEach(enhanceStudioCard);
                });
            });
        }).observe(root, { childList: true, subtree: true });
    }
})();
