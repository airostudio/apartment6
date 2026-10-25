        // Load Stripe mode from API and show warning if in test mode
        (function() {
            fetch('/api/stripe-config')
                .then(r => r.json())
                .then(cfg => {
                    const w = document.getElementById('stripeTestWarning');
                    if (w) w.style.display = cfg.testMode ? 'flex' : 'none';
                    // Update the key badge in the page if present
                    const badge = document.getElementById('stripeModeBadge');
                    if (badge) {
                        badge.textContent = cfg.testMode ? 'TEST MODE' : 'LIVE';
                        badge.style.background = cfg.testMode ? '#f59e0b' : '#16a34a';
                        badge.style.color = '#fff';
                    }
                })
                .catch(() => {});
        })();
    