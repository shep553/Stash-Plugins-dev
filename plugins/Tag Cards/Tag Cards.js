(function() {
    console.log("🔹 Tag Card Enhancer Loaded (16:9 Full Cover, Hover Overlay)");

    const DETAILS_PERSIST = false;
    const DETAILS_FADE = true;
    const BUTTON_GAP = "4px";
    const BUTTON_TOP_OFFSET = 4;
    const BUTTON_LEFT_OFFSET = 5;
    const TRANSITION_DURATION = ".5s";

    function shrinkDefaultImage(img) {
        if (img && img.src.includes("default=true")) {
            img.style.width = "80%";
            img.style.height = "90%";
            img.style.objectFit = "cover";
            img.style.objectPosition = "center";
            img.style.display = "block";
            img.style.margin = "0 auto";
        }
    }

    function enhanceTagCard(card) {
        // Skip if already enhanced
        if (card.dataset.enhanced === "true") return;
        card.dataset.enhanced = "true";

        const cardSection = card.querySelector(".card-section");
        const title = cardSection?.querySelector(".card-section-title");
        const truncated = title?.querySelector(".TruncatedText");
        if (!cardSection || !title || !truncated) return;

        const thumbnail = card.querySelector(".thumbnail-section");
        const checkbox = card.querySelector(".card-controls");
        const btnGroup = card.querySelector(".card-popovers.btn-group");

        // --- Card 16:9 ratio and full cover ---
        card.style.aspectRatio = "16 / 9";
        card.style.position = "relative";
        card.style.overflow = "hidden";

        // --- Thumbnail fills entire card ---
        if (thumbnail) {
            thumbnail.style.position = "absolute";
            thumbnail.style.top = "0";
            thumbnail.style.left = "0";
            thumbnail.style.width = "100%";
            thumbnail.style.height = "100%";

            const img = thumbnail.querySelector("img");
            if (img) {
                shrinkDefaultImage(img);
                img.style.width = img.src.includes("default=true") ? img.style.width : "100%";
                img.style.height = img.src.includes("default=true") ? img.style.height : "100%";
                img.style.objectFit = "cover";
                img.style.objectPosition = "center";
                img.style.display = "block";
            }
        }

        // --- Overlay behind text, visible only on hover ---
        let overlay = cardSection.querySelector(".card-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.className = "card-overlay";
            cardSection.prepend(overlay);
        }
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.opacity = "0";
        overlay.style.transition = `opacity ${TRANSITION_DURATION} ease-in-out`;
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "0";

        // --- Card-section over image ---
        cardSection.style.position = "absolute";
        cardSection.style.left = "0";
        cardSection.style.bottom = "0px";
        cardSection.style.width = "100%";
        cardSection.style.display = "flex";
        cardSection.style.flexDirection = "column";
        cardSection.style.gap = "2px";
        cardSection.style.transition = `max-height ${TRANSITION_DURATION} ease-in-out`;
        cardSection.style.overflow = "hidden";
        cardSection.style.zIndex = "1";

        // --- Title normalization ---
        title.style.margin = "0";
        title.style.padding = "0";
        title.style.display = "block";
        truncated.style.margin = "0";
        truncated.style.padding = "0";
        truncated.style.display = "block";

        // --- Description & parent tag ---
        const details = cardSection.querySelector(".tag-parent-tags");
        const tagDescription = cardSection.querySelector(".TruncatedText.tag-description");
        const allDetails = [];
        if (details) allDetails.push(details);
        if (tagDescription) allDetails.push(tagDescription);

        const hasDetails = allDetails.length > 0;
        const collapsedHeight = truncated.offsetHeight + 4;
        cardSection.style.maxHeight = collapsedHeight + "px";

        if (hasDetails) {
            allDetails.forEach(el => {
                el.style.display = "block";
                el.style.position = "relative";
                el.style.zIndex = "1";
                el.style.overflow = "visible";
                el.style.opacity = DETAILS_FADE ? "0" : "1";
                el.style.transition = DETAILS_FADE ? `opacity ${TRANSITION_DURATION} ease-in-out` : "none";
            });

            card.addEventListener("mouseenter", () => {
                overlay.style.opacity = "1";
                cardSection.style.overflow = "visible";
                cardSection.style.maxHeight = cardSection.scrollHeight + "px";
                if (DETAILS_FADE) allDetails.forEach(d => d.style.opacity = "1");
            });

            card.addEventListener("mouseleave", () => {
                overlay.style.opacity = "0";
                if (!DETAILS_PERSIST) {
                    cardSection.style.maxHeight = collapsedHeight + "px";
                    cardSection.style.overflow = "hidden";
                    if (DETAILS_FADE) allDetails.forEach(d => d.style.opacity = "0");
                }
            });
        }

        // --- Button group ---
        if (thumbnail && checkbox && btnGroup && !btnGroup.dataset.moved) {
            thumbnail.appendChild(btnGroup);
            btnGroup.dataset.moved = "true";
            btnGroup.style.position = "absolute";
            btnGroup.style.display = "flex";
            btnGroup.style.flexDirection = "column";
            btnGroup.style.gap = BUTTON_GAP;
            btnGroup.style.zIndex = "2";

            setTimeout(() => {
                try {
                    const thumbRect = thumbnail.getBoundingClientRect();
                    const chkRect = checkbox.getBoundingClientRect();
                    const leftPx = Math.max(0, (chkRect.right - thumbRect.left) + BUTTON_LEFT_OFFSET);
                    btnGroup.style.left = leftPx + "px";

                    const firstButton = btnGroup.querySelector("button, .btn, .minimal");
                    if (firstButton) {
                        const btnRect = firstButton.getBoundingClientRect();
                        const checkboxCenter = (chkRect.top - thumbRect.top) + (chkRect.height / 2);
                        const firstBtnCenter = (btnRect.top - thumbRect.top) + (btnRect.height / 2);
                        const shift = checkboxCenter - firstBtnCenter;
                        const currentTop = parseFloat(getComputedStyle(btnGroup).top) || 0;
                        btnGroup.style.top = `${currentTop + shift}px`;
                    }
                } catch {
                    btnGroup.style.top = BUTTON_TOP_OFFSET + "px";
                    btnGroup.style.left = (checkbox.offsetWidth + BUTTON_LEFT_OFFSET) + "px";
                }
            }, 50);
        }
    }

    function enhanceAllTags() {
        document.querySelectorAll(".tag-card.grid-card.card").forEach(enhanceTagCard);
    }

    // --- Initial load ---
    const interval = setInterval(() => {
        if (document.querySelector(".tag-card")) {
            enhanceAllTags();
            clearInterval(interval);
        }
    }, 500);

    // --- Enhanced MutationObserver for both root and body ---
    const observerConfig = { childList: true, subtree: true };
    
    const handleMutations = (mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    // Check if the node itself is a tag card
                    if (node.matches && node.matches(".tag-card")) {
                        enhanceTagCard(node);
                    }
                    // Check for tag cards within the node (including popovers)
                    if (node.querySelectorAll) {
                        node.querySelectorAll(".tag-card").forEach(enhanceTagCard);
                    }
                }
            });
        });
    };

    // Observe root
    const root = document.querySelector("#root");
    if (root) {
        new MutationObserver(handleMutations).observe(root, observerConfig);
    }

    // Also observe body to catch popovers that might be rendered outside #root
    new MutationObserver(handleMutations).observe(document.body, observerConfig);

    // Periodic check for any missed cards (fallback)
   // setInterval(() => {
   //     document.querySelectorAll(".tag-card:not([data-enhanced='true'])").forEach(enhanceTagCard);
   // }, 1000);

    console.log("🔹 Tag Card Enhancer: Observers active");
})();