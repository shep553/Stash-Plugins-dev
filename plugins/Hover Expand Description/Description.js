// ==UserScript==
// @name         Scene Details Cinematic Expand/Collapse (Conditional Fade)
// @namespace    stash
// @version      1.2
// @description  Expand/collapse scene details with cinematic fade only when needed
// @match        http://localhost:9999/*
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const COLLAPSED_LINES = 8;
    const LINE_HEIGHT = 1.4; // em
    const DURATION = 1600; // ms
    const EASE = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; // cubic ease

    function enhancePre(pre) {
        if(pre.dataset.enhanced) return;
        pre.dataset.enhanced = "true";

        const style = getComputedStyle(pre);
        const lineHeightPx = parseFloat(style.lineHeight) || 16;
        const collapsedHeight = COLLAPSED_LINES * lineHeightPx;
        const fullHeight = pre.scrollHeight;

        pre.style.maxHeight = collapsedHeight + 'px';
        pre.style.overflow = 'hidden';
        pre.style.position = 'relative';

        // Only add fade if text is actually longer than collapsed height
        let fade = pre.querySelector('.pre-fade');
        if (!fade && fullHeight > collapsedHeight) {
            fade = document.createElement('div');
            fade.className = 'pre-fade';
            fade.style.position = 'absolute';
            fade.style.bottom = '0';
            fade.style.left = '0';
            fade.style.right = '0';
            fade.style.height = '3em'; // cinematic fade height
            //fade.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0), #222020 90%)';
			fade.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0), var(--description) 90%)';
			fade.style.pointerEvents = 'none';
            fade.style.opacity = '1';
            fade.style.transition = `opacity ${DURATION*0.7/1000}s ease`;
            pre.appendChild(fade);
        }

        let animFrame;

        const animateHeight = (start, end, fadeTarget) => {
            const startTime = performance.now();
            cancelAnimationFrame(animFrame);

            function step(now) {
                const t = Math.min(1, (now - startTime)/DURATION);
                const eased = EASE(t);
                const height = start + (end - start) * eased;
                pre.style.maxHeight = height + 'px';
                if(fade) fade.style.opacity = fadeTarget === 0 ? 0 : eased;

                if (t < 1) animFrame = requestAnimationFrame(step);
                else pre.style.maxHeight = end + 'px';
            }
            animFrame = requestAnimationFrame(step);
        };

        pre.addEventListener('mouseenter', () => {
            if(fullHeight <= collapsedHeight) return; // do nothing if text short
            const start = pre.offsetHeight;
            const end = fullHeight;
            animateHeight(start, end, 0);
        });

        pre.addEventListener('mouseleave', () => {
            if(fullHeight <= collapsedHeight) return; // do nothing if text short
            const start = pre.offsetHeight;
            const end = collapsedHeight;
            animateHeight(start, end, 1);
        });
    }

    // Initial run
    document.querySelectorAll('.pre').forEach(enhancePre);

    // Observe dynamically added nodes
    new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if(node.nodeType !== 1) return;
                if(node.matches && node.matches('.pre')) enhancePre(node);
                node.querySelectorAll && node.querySelectorAll('.pre').forEach(enhancePre);
            });
        });
    }).observe(document.body, { childList: true, subtree: true });

})();
