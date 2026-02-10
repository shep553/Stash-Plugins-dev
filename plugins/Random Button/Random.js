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

        const buttonLabel = document.createElement('span');
        buttonLabel.textContent = 'Random';

        innerLink.appendChild(buttonLabel);
        newButton.appendChild(innerLink);
        navBar.appendChild(newButton);
    }

    // Re-run when navigation changes (for SPA behavior)
    PluginApi.Event.addEventListener('stash:location', () => {
        waitForElement('.navbar-nav', addButton);
    });
})();