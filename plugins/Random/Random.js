(function () {
    'use strict';

    const PluginApi = window.PluginApi;
    const { React } = PluginApi;

    // Get plugin settings or use defaults
    const settings = PluginApi.pluginSettings || {};
    const perPage = settings.perPage || 60;

    // Generate a random seed for each use
    function getRandomSeed() {
        return Math.floor(Math.random() * 2147483647);
    }

    // Detect which page we're on
    function getCurrentPage() {
        const path = window.location.pathname;
        const validPages = [
            '/scenes',
            '/groups',
            '/galleries',
            '/performers',
            '/studios',
            '/tags',
            '/images',
            '/markers'
        ];
        
        for (const page of validPages) {
            if (path.startsWith(page)) {
                return page;
            }
        }
        
        // Default to scenes if not on a recognized page
        return '/scenes';
    }

    // Wait for the navbar to load
    waitForElement('.navbar-nav', addButton);

    function waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                callback(el);
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    function addButton(navBar) {
        // Prevent duplicates if script runs again
        if (navBar.querySelector('.custom-menu-item')) return;

        const newButton = document.createElement('div');
        newButton.classList.add(
            'custom-menu-item',
            'col-4',
            'col-sm-3',
            'col-md-2',
            'col-lg-auto',
            'nav-link'
        );

        const innerLink = document.createElement('a');
        innerLink.classList.add(
            'minimal',
            'p-4',
            'p-xl-2',
            'd-flex',
            'd-xl-inline-block',
            'flex-column',
            'justify-content-between',
            'align-items-center',
            'btn',
            'btn-primary'
        );

        // Generate random seed on click instead of hardcoded URL
        innerLink.addEventListener('click', function(e) {
            e.preventDefault();
            const randomSeed = getRandomSeed();
            const currentPage = getCurrentPage();
            
            // Check if current URL has a display modifier (disp parameter)
            const urlParams = new URLSearchParams(window.location.search);
            const dispValue = urlParams.get('disp');
            
            // Build URL with random seed and preserve disp modifier if it exists
            let url = `${currentPage}?sortby=random_${randomSeed}&sortdir=desc&perPage=${perPage}`;
            if (dispValue) {
                url += `&disp=${dispValue}`;
            }
            
            window.location.href = url;
        });

        // Set href as fallback (though click handler overrides it)
        innerLink.href = '#';

        const buttonIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        buttonIcon.setAttribute('data-prefix', 'fas');
        buttonIcon.setAttribute('data-icon', 'shuffle');
        buttonIcon.setAttribute('class', 'svg-inline--fa fa-shuffle fa-icon');
        buttonIcon.setAttribute('role', 'img');
        buttonIcon.setAttribute('viewBox', '0 0 448 512');
        buttonIcon.setAttribute('aria-hidden', 'true');
        const buttonIconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        buttonIconPath.setAttribute('fill', 'currentColor');
        buttonIconPath.setAttribute('d', 'M403.8 34.4c12-5 25.7-2.2 34.9 6.9l64 64c6 6 9.4 14.1 9.4 22.6s-3.4 16.6-9.4 22.6l-64 64c-9.2 9.2-22.9 11.9-34.9 6.9S384 204.9 384 192l0-32-32 0c-10.1 0-19.6 4.7-25.6 12.8l-32.4 43.2-40-53.3 21.2-28.3C293.3 110.2 321.8 96 352 96l32 0 0-32c0-12.9 7.8-24.6 19.8-29.6zM154 296l40 53.3-21.2 28.3C154.7 401.8 126.2 416 96 416l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l64 0c10.1 0 19.6-4.7 25.6-12.8L154 296zM438.6 470.6c-9.2 9.2-22.9 11.9-34.9 6.9S384 460.9 384 448l0-32-32 0c-30.2 0-58.7-14.2-76.8-38.4L121.6 172.8c-6-8.1-15.5-12.8-25.6-12.8l-64 0c-17.7 0-32-14.3-32-32S14.3 96 32 96l64 0c30.2 0 58.7 14.2 76.8 38.4L326.4 339.2c6 8.1 15.5 12.8 25.6 12.8l32 0 0-32c0-12.9 7.8-24.6 19.8-29.6s25.7-2.2 34.9 6.9l64 64c6 6 9.4 14.1 9.4 22.6s-3.4 16.6-9.4 22.6l-64 64z');
        buttonIcon.appendChild(buttonIconPath);

        const buttonLabel = document.createElement('span');
        buttonLabel.textContent = 'Random';

        innerLink.appendChild(buttonIcon);
        innerLink.appendChild(buttonLabel);
        newButton.appendChild(innerLink);
        navBar.appendChild(newButton);
    }

    // Re-run when navigation changes (for SPA behavior)
    PluginApi.Event.addEventListener('stash:location', () => {
        waitForElement('.navbar-nav', addButton);
    });
})();