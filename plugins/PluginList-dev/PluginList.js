(function () {
    "use strict";

    /* Insert newNode into parent before referenceNode. Falls back to
       appendChild if referenceNode isn't actually a child of parent —
       React re-renders can detach references between query and call,
       causing "Child to insert before is not a child of this node"
       errors that break unrelated DOM work in the same cycle. */
    function safeInsertBefore(parent, newNode, referenceNode) {
        if (!parent || !newNode) { return null; }
        try {
            if (referenceNode && parent.contains(referenceNode)) {
                return parent.insertBefore(newNode, referenceNode);
            }
            return parent.appendChild(newNode);
        } catch (e) {
            try { return parent.appendChild(newNode); } catch (e2) { return null; }
        }
    }

    // Settings → Plugins page: replace each plugin's native
    // [Enable]/[Disable] btn-sm with a Bootstrap custom-switch toggle so
    // every row's action column reads the same. The original button stays
    // in the DOM (CSS hides it) and our toggle dispatches a click on it
    // when flipped — Stash's own handler runs unchanged. Also relocates
    // the project-link icon out of the action column into the title row
    // so the right column stays compact and consistent.
    // Find the row's actual Enable/Disable button by label rather than
    // assuming it's the first .btn-sm — rows can have other btn-sm controls
    // (e.g. an "Update" button) that would otherwise get bound instead.
    function findEnableDisableBtn(scope) {
        var btns = scope.querySelectorAll("button.btn-sm:not(.st-plugin-chevron)");
        for (var i = 0; i < btns.length; i++) {
            var t = (btns[i].textContent || "").trim().toLowerCase();
            if (t === "enable" || t === "disable") return btns[i];
        }
        return null;
    }

    function injectPluginToggles() {
        var groups = document.querySelectorAll(".setting-section .setting-group");
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            var header = group.querySelector(":scope > .setting");
            if (!header) continue;
            var rightSide = header.lastElementChild;
            if (!rightSide) continue;

            // Move the link icon (a.minimal.link) into the plugin title.
            var titleH3 = header.querySelector(":scope > div:first-child > h3");
            var linkAnchor = rightSide.querySelector("a.minimal.link.btn.btn-primary");
            if (titleH3 && linkAnchor && !linkAnchor.classList.contains("st-title-link")) {
                linkAnchor.classList.add("st-title-link");
                titleH3.appendChild(document.createTextNode(" "));
                titleH3.appendChild(linkAnchor);
            }

            // The Enable/Disable btn is the btn-sm one — but some rows have
            // OTHER btn-sm controls too (e.g. an "Update" button), so match
            // by label text rather than grabbing the first btn-sm found.
            // Grabbing the wrong button is why some rows' toggles silently
            // did nothing or acted inconsistently.
            var nativeBtn = findEnableDisableBtn(rightSide);
            if (!nativeBtn) continue;

            // Already done? Just sync state — unless a click we just made
            // is still in flight. Stash's actual enable/disable isn't
            // synchronous with the DOM mutation that wakes this observer,
            // so resyncing too eagerly reads the *old* disabled state and
            // snaps the checkbox back before the real update lands.
            var existing = rightSide.querySelector(".st-toggle-injected");
            if (existing) {
                var input = existing.querySelector("input");
                if (input && !existing.dataset.stPending) {
                    var enabled = !header.classList.contains("disabled");
                    if (input.checked !== enabled) input.checked = enabled;
                }
                continue;
            }

            var id = "st-plugin-toggle-" + Math.random().toString(36).slice(2, 9);
            var wrap = document.createElement("div");
            wrap.className = "st-toggle-wrap st-toggle-injected";
            wrap.innerHTML =
                '<div class="custom-control custom-switch">' +
                '<input type="checkbox" id="' + id + '" class="custom-control-input">' +
                '<label class="custom-control-label" for="' + id + '"></label>' +
                '</div>';

            var inp = wrap.querySelector("input");
            inp.checked = !header.classList.contains("disabled");
            inp.addEventListener("click", function (e) {
                var row = this.closest(".setting");
                var wrapEl = this.closest(".st-toggle-injected");
                // Forward to the native button so Stash's React handler runs.
                var btn = row && findEnableDisableBtn(row);
                if (!btn) return;

                // Give the real toggle a window to land before we let the
                // MutationObserver resync overwrite this checkbox again —
                // otherwise a re-render that fires before Stash's async
                // enable/disable actually completes reads the stale
                // `disabled` class and reverts the click.
                if (wrapEl) {
                    wrapEl.dataset.stPending = "1";
                    clearTimeout(wrapEl._stPendingTimer);
                    wrapEl._stPendingTimer = setTimeout(function () {
                        delete wrapEl.dataset.stPending;
                    }, 2000);
                }
                btn.click();
            });
            // Stop ALL clicks originating inside the wrapper (label or input)
            // from bubbling to the parent .setting row. Stash's React component
            // listens on the row and would fire a second btn.click(), toggling
            // the plugin back immediately and causing every-other-click to be
            // a no-op with a page refresh but no state change.
            wrap.addEventListener("click", function (e) {
                e.stopPropagation();
            });

            // Place toggle as the LEFT-most action item in the right column.
            safeInsertBefore(rightSide, wrap, rightSide.firstChild);
        }
    }
    (function watchPluginToggles() {
        var _t = null;
        function sched() {
            clearTimeout(_t);
            _t = setTimeout(injectPluginToggles, 80);
        }
        injectPluginToggles();
        new MutationObserver(sched).observe(document.body, { childList: true, subtree: true });
    })();

    // Settings → Plugins page: each plugin renders its inline settings,
    // hooks, etc. always-expanded, which makes the list very long. Inject
    // a chevron toggle on every plugin's header row and default the
    // settings section to collapsed for a tidier view.
    function makePluginSettingsCollapsible() {
        var groups = document.querySelectorAll(".setting-section .setting-group");
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            if (group.dataset.stCollapsibleInjected === "1") continue;

            var header = group.querySelector(":scope > .setting");
            var section = group.querySelector(":scope > .collapsible-section");
            if (!header || !section) continue;

            // Skip plugins with no actual settings/hooks content.
            var hasContent =
                section.querySelector(".plugin-settings .setting") ||
                section.querySelector("h5"); // hooks header
            if (!hasContent) continue;

            var rightSide = header.lastElementChild;
            if (!rightSide) continue;

            var chevron = document.createElement("button");
            chevron.type = "button";
            chevron.className = "btn btn-primary btn-sm st-plugin-chevron";
            chevron.setAttribute("aria-label", "Toggle plugin settings");
            chevron.innerHTML =
            "<svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' " +
            "aria-hidden='true'>" +
            "<path d='M10 7L15 12L10 17' stroke='currentColor' stroke-width='3.5' " +
            "stroke-linecap='round' stroke-linejoin='round'/></svg>";
            chevron.addEventListener("click", function (e) {
                e.stopPropagation();
                e.preventDefault();
                this.closest(".setting-group").classList.toggle("st-plugin-collapsed");
            });
            rightSide.appendChild(chevron);

            // Default to collapsed.
            group.classList.add("st-plugin-collapsed");
            group.dataset.stCollapsibleInjected = "1";
        }
    }
    (function watchPluginSettings() {
        var _t = null;
        function sched() {
            clearTimeout(_t);
            _t = setTimeout(makePluginSettingsCollapsible, 80);
        }
        makePluginSettingsCollapsible();
        new MutationObserver(sched).observe(document.body, { childList: true, subtree: true });
    })();

    // Bootstrap's Collapse uses the same `.collapsing` class for opening AND closing,
    // so CSS can't tell direction. On click we tag the header:
    //   - `.st-collapse-opening`: about to open — CSS pre-applies the orange/flat state
    //     immediately so the button transition syncs with the panel slide.
    //   - `.st-collapse-transitioning`: present during BOTH directions for ~400ms so
    //     CSS can keep the bottom border transparent during the animation, avoiding
    //     a grey-line flash when closing (where the panel is still partially visible
    //     while the button reverts to its closed-state border-bottom: glass-border).
    document.addEventListener("click", function (e) {
        var btn = e.target.closest && e.target.closest(".collapse-button");
        if (!btn) return;
        var header = btn.closest(".collapse-header");
        if (!header) return;
        var panel = header.nextElementSibling;
        if (!panel || !panel.classList.contains("collapse")) return;
        var isOpening = !panel.classList.contains("show");
        if (isOpening) header.classList.add("st-collapse-opening");
        header.classList.add("st-collapse-transitioning");
        setTimeout(function () {
            header.classList.remove("st-collapse-opening");
            header.classList.remove("st-collapse-transitioning");
        }, 400);
    }, true);

})();