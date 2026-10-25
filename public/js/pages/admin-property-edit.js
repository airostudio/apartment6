    // Tab switching functionality
    document.addEventListener('DOMContentLoaded', function() {
      var tabs = document.querySelectorAll('.form-tab');
      var panels = document.querySelectorAll('.tab-panel');

      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var targetId = 'tab-' + this.getAttribute('data-tab');

          // Deactivate all tabs and panels
          tabs.forEach(function(t) { t.classList.remove('active'); });
          panels.forEach(function(p) { p.classList.remove('active'); });

          // Activate clicked tab and matching panel
          this.classList.add('active');
          var targetPanel = document.getElementById(targetId);
          if (targetPanel) {
            targetPanel.classList.add('active');
          }
        });
      });
    });
  