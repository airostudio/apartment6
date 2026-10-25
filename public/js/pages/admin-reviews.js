    /**
     * Tab switching for the Reviews page.
     * Manages aria-selected, --active modifier classes, and panel visibility.
     */
    function switchTab(platform) {
        var tabs   = document.querySelectorAll('.reviews-tab');
        var panels = document.querySelectorAll('.reviews-panel');

        // Deactivate all tabs and hide all panels
        tabs.forEach(function(tab) {
            tab.classList.remove('reviews-tab--active');
            tab.setAttribute('aria-selected', 'false');
        });
        panels.forEach(function(panel) {
            panel.classList.remove('reviews-panel--active');
        });

        // Activate the selected tab and panel
        var activeTab   = document.getElementById('tab-' + platform);
        var activePanel = document.getElementById('panel-' + platform);

        if (activeTab)   { activeTab.classList.add('reviews-tab--active'); activeTab.setAttribute('aria-selected', 'true'); }
        if (activePanel) { activePanel.classList.add('reviews-panel--active'); }
    }
