/**
 * Admin Authentication Check — Cascade Apartment 6
 * Include this script in every admin page.
 */
(function() {
    'use strict';

    var OWNER_EMAIL = 'typhoon.tall69@gmail.com';
    var LOGIN_URL   = '/admin/login.html';

    function checkAuth() {
        fetch('/api/auth/check', { method: 'GET', credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
        .then(function(res) { if (!res.ok) throw new Error('Not authenticated'); return res.json(); })
        .then(function(data) {
            if (!data.authenticated) { window.location.href = LOGIN_URL; return; }
            updateUserUI(data.email);
            checkStripeAccess(data.email);
        })
        .catch(function() {
            var devAuth = sessionStorage.getItem('cascade6_auth');
            if (!devAuth) {
                if (window.location.protocol !== 'file:') window.location.href = LOGIN_URL;
            } else {
                try {
                    var auth = JSON.parse(devAuth);
                    if (auth && auth.authenticated) { updateUserUI(auth.email); checkStripeAccess(auth.email); }
                    else window.location.href = LOGIN_URL;
                } catch(e) { window.location.href = LOGIN_URL; }
            }
        });
    }

    function updateUserUI(email) {
        if (!email) return;
        var n = document.getElementById('userName');
        var a = document.getElementById('userAvatar');
        if (n) { var d = email.split('@')[0]; n.textContent = d.charAt(0).toUpperCase() + d.slice(1); }
        if (a) a.textContent = email.substring(0, 2).toUpperCase();
        window.__adminEmail = email;
    }

    function checkStripeAccess(email) {
        if (!window.location.pathname.includes('stripe-connect')) return;
        if (email !== OWNER_EMAIL) {
            var o = document.getElementById('stripeAccessOverlay');
            if (o) o.style.display = 'flex';
            var c = document.getElementById('stripeContent');
            if (c) { c.style.opacity = '0.3'; c.style.pointerEvents = 'none'; }
        } else {
            var o2 = document.getElementById('stripeAccessOverlay');
            if (o2) o2.style.display = 'none';
        }
    }

    function attachLogout() {
        var btn = document.getElementById('logoutLink');
        if (!btn) return;
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
            .finally(function() { sessionStorage.removeItem('cascade6_auth'); window.location.href = LOGIN_URL; });
        });
    }

    function attachSidebarToggle() {
        var btn = document.getElementById('sidebarToggle');
        var sidebar = document.getElementById('adminSidebar');
        if (btn && sidebar) btn.addEventListener('click', function() { sidebar.classList.toggle('open'); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { checkAuth(); attachLogout(); attachSidebarToggle(); });
    } else { checkAuth(); attachLogout(); attachSidebarToggle(); }
})();
