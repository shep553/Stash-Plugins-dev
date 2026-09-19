const HEADERS = [
    { header: '#scene-edit-details .edit-buttons-container', panel: '#scene-edit-details', node: null },
    { header: '#gallery-edit-details .edit-buttons-container', panel: '#gallery-edit-details', node: null },
    { header: '#queue-viewer .queue-controls', panel: '#queue-viewer', node: null },
];

function processHeaders() {
    const tabContent = document.querySelector('.scene-tabs .tab-content, .gallery-tabs .tab-content');
    if (!tabContent) return;

    HEADERS.forEach(entry => {
        if (entry.node && !entry.node.isConnected) {
            entry.node = null;
        }

        if (!entry.node) {
            const unmoved = tabContent.querySelector(entry.header);
            if (unmoved) {
                unmoved.dataset.moved = 'true';
                unmoved.style.position = 'sticky';
                unmoved.style.top = '0';
                unmoved.style.zIndex = '3';
                tabContent.parentElement.insertBefore(unmoved, tabContent);
                entry.node = unmoved;
            }
        }

        if (entry.node) {
            const panelEl = document.querySelector(entry.panel);
            const active = !!panelEl && panelEl.offsetParent !== null;
            entry.node.style.display = active ? '' : 'none';
        }
    });
}

const observer = new MutationObserver(processHeaders);
observer.observe(document.body, { childList: true, subtree: true });
processHeaders();


