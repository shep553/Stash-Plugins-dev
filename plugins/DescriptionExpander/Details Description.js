(function() {
    'use strict';

    const COLLAPSED_LINES = 8;
    const LINE_HEIGHT = 1.4; // em
    const DURATION = 1600; // ms
    const EASE = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; // cubic ease

    function enhancePre(pre) {
        if (pre.dataset.enhanced) return;
        pre.dataset.enhanced = "true";

        const style = getComputedStyle(pre);
        const lineHeightPx = parseFloat(style.lineHeight) || 16;
        const collapsedHeight = COLLAPSED_LINES * lineHeightPx;
        const fullHeight = pre.scrollHeight;

        // Set initial collapsed state
        pre.style.maxHeight = collapsedHeight + 'px';

        // Only add fade if text is actually longer than collapsed height
        let fade = pre.querySelector('.pre-fade');
        if (!fade && fullHeight > collapsedHeight) {
            fade = document.createElement('div');
            fade.className = 'pre-fade';
			fade.style.transition = `opacity ${DURATION*0.7/1000}s ease`;
            pre.appendChild(fade);
        }

        let animFrame;

        const animateHeight = (start, end, fadeTarget) => {
            const startTime = performance.now();
            cancelAnimationFrame(animFrame);

            function step(now) {
                const t = Math.min(1, (now - startTime) / DURATION);
                const eased = EASE(t);
                const height = start + (end - start) * eased;
                
                pre.style.maxHeight = height + 'px';
                
                if (fade) {
                    fade.style.opacity = fadeTarget === 0 ? 0 : eased;
                }

                if (t < 1) {
                    animFrame = requestAnimationFrame(step);
                } else {
                    pre.style.maxHeight = end + 'px';
                }
            }
            
            animFrame = requestAnimationFrame(step);
        };

        pre.addEventListener('mouseenter', () => {
            // Do nothing if text is short enough
            if (fullHeight <= collapsedHeight) return;
            
            const start = pre.offsetHeight;
            const end = fullHeight;
            animateHeight(start, end, 0);
        });

        pre.addEventListener('mouseleave', () => {
            // Do nothing if text is short enough
            if (fullHeight <= collapsedHeight) return;
            
            const start = pre.offsetHeight;
            const end = collapsedHeight;
            animateHeight(start, end, 1);
        });
    }

    function processAllDescriptions() {
        document.querySelectorAll('.pre').forEach(enhancePre);
    }

    function init() {
        console.log('[Description Expander] Initializing...');
        
        // Process existing descriptions
        processAllDescriptions();

        // Use csLib.PathElementListener for page-specific processing
        // This is more efficient than a global MutationObserver
        csLib.PathElementListener('/scenes/', '.pre', enhancePre);
        csLib.PathElementListener('/galleries/', '.pre', enhancePre);
        csLib.PathElementListener('/performers/', '.pre', enhancePre);
        csLib.PathElementListener('/studios/', '.pre', enhancePre);
        csLib.PathElementListener('/movies/', '.pre', enhancePre);
        csLib.PathElementListener('/tags/', '.pre', enhancePre);

        // Fallback MutationObserver for dynamically added descriptions
        // on pages not covered by PathElementListener
        new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    
                    if (node.matches && node.matches('.pre')) {
                        enhancePre(node);
                    }
                    
                    if (node.querySelectorAll) {
                        node.querySelectorAll('.pre').forEach(enhancePre);
                    }
                });
            });
        }).observe(document.body, { 
            childList: true, 
            subtree: true 
        });

        console.log('[Description Expander] Initialized successfully');
    }

    // Wait for csLib to be available
    function waitForDependencies() {
        if (typeof csLib !== 'undefined') {
            init();
        } else {
            console.log('[Description Expander] Waiting for csLib...');
            setTimeout(waitForDependencies, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForDependencies);
    } else {
        waitForDependencies();
    }

    console.log('[Description Expander] Script loaded, waiting for dependencies...');
})();
