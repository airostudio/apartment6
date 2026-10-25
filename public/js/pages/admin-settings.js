        // Tab switching
        document.querySelectorAll('.settings-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                // Remove active from all tabs
                document.querySelectorAll('.settings-tab').forEach(function(t) {
                    t.classList.remove('active');
                });
                // Remove active from all tab contents
                document.querySelectorAll('.tab-content').forEach(function(tc) {
                    tc.classList.remove('active');
                });
                // Activate clicked tab
                this.classList.add('active');
                var tabId = 'tab-' + this.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
            });
        });

        // Policy card toggle visual feedback
        document.querySelectorAll('.policy-card input[type="checkbox"]').forEach(function(cb) {
            cb.addEventListener('change', function() {
                var card = this.closest('.policy-card');
                if (this.checked) {
                    card.classList.add('active-policy');
                } else {
                    card.classList.remove('active-policy');
                }
            });
        });

        // Save changes button
        document.getElementById('saveChangesBtn').addEventListener('click', function() {
            var btn = this;
            btn.textContent = 'Saving...';
            btn.disabled = true;
            setTimeout(function() {
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Saved!';
                setTimeout(function() {
                    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Changes';
                    btn.disabled = false;
                }, 2000);
            }, 800);
        });
    