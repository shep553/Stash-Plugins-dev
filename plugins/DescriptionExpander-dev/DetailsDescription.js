(function () {
    'use strict';

    const COLLAPSED_LINES = 8;
    const DURATION = 1600; // ms
    const EASE = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // cubic ease

    function setupPre(pre) {
    const lineHeightPx = parseFloat(getComputedStyle(pre).lineHeight) || 16;
    const collapsedHeight = COLLAPSED_LINES * lineHeightPx;
    const fullHeight = pre.scrollHeight;

    if (fullHeight <= collapsedHeight) return; // Nothing to collapse

    pre.classList.add('can-expand'); 
    pre.style.maxHeight = collapsedHeight + 'px';
    pre.style.setProperty('--mask-opacity', '1'); 

    let animFrame;
    let isHovered = false; // Track the actual intended state

    const animateHeight = (targetHeight, fadeTarget) => {
        const startTime = performance.now();
        const startHeight = pre.offsetHeight;
        
        // Read current mask opacity dynamically so it interpolates smoothly from where it currently is
        const startOpacity = parseFloat(pre.style.getPropertyValue('--mask-opacity')) || 0; 
        
        cancelAnimationFrame(animFrame);

        function step(now) {
            const t = Math.min(1, (now - startTime) / DURATION);
            const eased = EASE(t);
            
            // Calculate current height based on where the animation started
            pre.style.maxHeight = (startHeight + (targetHeight - startHeight) * eased) + 'px';
            
            // Interpolate mask opacity smoothly from its current exact state
            const currentOpacity = startOpacity + (fadeTarget - startOpacity) * eased;
            pre.style.setProperty('--mask-opacity', currentOpacity);

            if (t < 1) {
                animFrame = requestAnimationFrame(step);
            } else {
                pre.style.maxHeight = targetHeight === fullHeight ? 'none' : targetHeight + 'px';
                pre.style.setProperty('--mask-opacity', fadeTarget);
            }
        }

        animFrame = requestAnimationFrame(step);
    };

    pre.addEventListener('mouseenter', () => {
        isHovered = true;
        // Small timeout ensures a accidental 1-millisecond swipe-by doesn't thrash the DOM
        setTimeout(() => {
            if (isHovered) animateHeight(fullHeight, 0);
        }, 20); 
    });

    pre.addEventListener('mouseleave', () => {
        isHovered = false;
        animateHeight(collapsedHeight, 1);
    });
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