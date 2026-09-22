const HEADERS = [
    { header: '#scene-edit-details .edit-buttons-container', panel: '#scene-edit-details', node: null },
    { header: '#gallery-edit-details .edit-buttons-container', panel: '#gallery-edit-details', node: null },
    { header: '#image-edit-details .edit-buttons-container', panel: '#image-edit-details', node: null },
    { header: '#queue-viewer .queue-controls', panel: '#queue-viewer', node: null },
];

function processHeaders() {
    const tabContent = document.querySelector('.scene-tabs .tab-content, .gallery-tabs .tab-content, .image-tabs .tab-content');
    if (!tabContent) return;

    HEADERS.forEach(entry => {
        if (entry.node && !entry.node.isConnected) {
            entry.node = null;
        }

        // React re-renders the subtree (e.g. after Save/Delete) without knowing we
        // relocated its old node, so it creates a brand new one back in the original
        // spot. If we find one inside tabContent that isn't the node we already moved,
        // it's that replacement — drop the stale node and move the new one in its place.
        const freshUnmoved = tabContent.querySelector(entry.header);
        if (freshUnmoved && freshUnmoved !== entry.node) {
            if (entry.node) {
                entry.node.remove();
            }
            freshUnmoved.dataset.moved = 'true';
            freshUnmoved.style.position = 'sticky';
            freshUnmoved.style.top = '0';
            freshUnmoved.style.zIndex = '3';
            tabContent.parentElement.insertBefore(freshUnmoved, tabContent);
            entry.node = freshUnmoved;
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