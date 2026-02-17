(function() {
    'use strict';

    const COLLAPSED_LINES = 8;
    const DURATION = 1600; // ms
    const EASE = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; // cubic ease

    function setupPre(pre) {
        const lineHeightPx = parseFloat(getComputedStyle(pre).lineHeight) || 16;
        const collapsedHeight = COLLAPSED_LINES * lineHeightPx;
        const fullHeight = pre.scrollHeight;

        if (fullHeight <= collapsedHeight) return; // Nothing to collapse

        pre.style.maxHeight = collapsedHeight + 'px';

        const fade = document.createElement('div');
        fade.className = 'pre-fade';
        fade.style.transition = `opacity ${DURATION * 0.3 / 1000}s ease`;
        pre.appendChild(fade);

        let animFrame;

        const animateHeight = (start, end, fadeTarget) => {
            const startTime = performance.now();
            cancelAnimationFrame(animFrame);

            function step(now) {
                const t = Math.min(1, (now - startTime) / DURATION);
                const eased = EASE(t);
                pre.style.maxHeight = (start + (end - start) * eased) + 'px';
                fade.style.opacity = fadeTarget === 0 ? (0 - eased) : eased;

                if (t < 1) {
                    animFrame = requestAnimationFrame(step);
                } else {
                    pre.style.maxHeight = end + 'px';
                }
            }

            animFrame = requestAnimationFrame(step);
        };

        pre.addEventListener('mouseenter', () => animateHeight(pre.offsetHeight, fullHeight, 0));
        pre.addEventListener('mouseleave', () => animateHeight(pre.offsetHeight, collapsedHeight, 1));
    }

    function enhancePre(pre) {
        if (pre.dataset.enhanced) return;
        pre.dataset.enhanced = "true";

        // Use ResizeObserver to wait until the element has a real, stable height.
        // More reliable than rAF or setTimeout on first load / hard refresh,
        // where scrollHeight may still be 0 or wrong when the callback fires.
        const ro = new ResizeObserver(() => {
            if (pre.scrollHeight > 0) {
                ro.disconnect();
                setupPre(pre);
            }
        });
        ro.observe(pre);
    }

    function init() {
        console.log('[Description Expander] Initializing...');
        csLib.PathElementListener('/scenes/', '.pre', enhancePre);
        csLib.PathElementListener('/galleries/', '.pre', enhancePre);
        console.log('[Description Expander] Initialized successfully');
    }

    function waitForDependencies() {
        if (typeof csLib !== 'undefined') {
            init();
        } else {
            setTimeout(waitForDependencies, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForDependencies);
    } else {
        waitForDependencies();
    }
})();