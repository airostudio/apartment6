/**
 * TrendAccom - Admin Authentication Guard
 *
 * Include this script on every admin page (before closing </body>).
 * It will:
 *   1. Redirect unauthenticated visitors to login.html
 *   2. Inject the logged-in user's name/avatar into the topbar
 *   3. Show the Stripe Connect sidebar link only for the site owner
 *   4. Wire up the logout button
 *   5. Expire sessions older than 8 hours
 */

(function () {
    'use strict';

    const SESSION_KEY   = 'trendaccom_admin_auth';
    const SESSION_TTL   = 8 * 60 * 60 * 1000; // 8 hours in ms
    const OWNER_EMAIL   = 'typhoon.tall69@gmail.com';
    const LOGIN_PAGE    = 'login.html';

    // ─── 1. Validate session ───────────────────────────────────────────────────

    function getSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const session = JSON.parse(raw);
            if (!session || !session.email || !session.loginAt) return null;
            if (Date.now() - session.loginAt > SESSION_TTL) {
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
            return session;
        } catch (_) {
            return null;
        }
    }

    function redirectToLogin() {
        // Use the full pathname so redirect works correctly regardless of where login is hosted
        let target = window.location.pathname; // e.g. /admin/bookings or /admin/bookings.html
        // Ensure .html extension — Vercel cleanUrls strips it from pathnames
        if (target && !target.split('/').pop().includes('.')) target += '.html';
        const encoded = encodeURIComponent(target);
        window.location.replace(LOGIN_PAGE + (encoded ? '?redirect=' + encoded : ''));
    }

    const session = getSession();
    if (!session) {
        redirectToLogin();
        return; // stop execution while redirect fires
    }

    // ─── 2. Populate topbar user info ─────────────────────────────────────────

    function initTopbarUser() {
        // Avatar initials
        const avatarEls = document.querySelectorAll(
            '.admin-topbar__user-avatar, .topbar-user-avatar, .topbar-user .user-avatar'
        );
        const initials = (session.name || session.email)
            .split(/[\s@]+/)
            .map(p => p[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        avatarEls.forEach(el => { el.textContent = initials; });

        // Display name
        const nameEls = document.querySelectorAll(
            '.admin-topbar__user-name, .topbar-user-name, .topbar-user .user-name'
        );
        const displayName = session.role === 'owner' ? 'Owner' : 'Admin';
        nameEls.forEach(el => { el.textContent = displayName; });
    }

    // ─── 3. Stripe Connect visibility (owner only) ────────────────────────────

    function enforceStripeVisibility() {
        const isOwner = session.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
        const stripeLinks = document.querySelectorAll('a[href="stripe-connect.html"]');

        stripeLinks.forEach(link => {
            const li = link.closest('li');
            if (li) {
                li.style.display = isOwner ? '' : 'none';
            } else {
                link.style.display = isOwner ? '' : 'none';
            }
        });

        // If we ARE on the stripe-connect page and not the owner, boot out
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'stripe-connect.html' && !isOwner) {
            window.location.replace('index.html');
        }
    }

    // ─── 4. Logout ────────────────────────────────────────────────────────────

    function initLogout() {
        document.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-action="logout"], .btn-logout, #logoutBtn');
            if (!btn) return;
            e.preventDefault();
            if (confirm('Are you sure you want to sign out?')) {
                localStorage.removeItem(SESSION_KEY);
                window.location.href = LOGIN_PAGE;
            }
        });
    }

    // ─── 5. Inject logout button into topbar (if not already present) ─────────

    function injectLogoutButton() {
        const topbarActions = document.querySelector(
            '.admin-topbar__actions, .topbar-right, .topbar-actions'
        );
        if (!topbarActions) return;
        if (topbarActions.querySelector('[data-action="logout"], .btn-logout, #logoutBtn')) return;

        const btn = document.createElement('button');
        btn.setAttribute('data-action', 'logout');
        btn.setAttribute('title', 'Sign out');
        btn.setAttribute('aria-label', 'Sign out');
        btn.style.cssText = [
            'display:inline-flex', 'align-items:center', 'gap:6px',
            'padding:0 12px', 'height:36px', 'border-radius:8px',
            'border:1.5px solid #e2e8f0', 'background:#fff',
            'color:#64748b', 'font-size:0.8125rem', 'font-weight:500',
            'font-family:inherit', 'cursor:pointer', 'transition:all 0.15s'
        ].join(';');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Sign out</span>`;
        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#f8fafc';
            btn.style.color = '#0f172a';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = '#fff';
            btn.style.color = '#64748b';
        });

        // Insert before the user chip
        const userChip = topbarActions.querySelector(
            '.admin-topbar__user, .topbar-user, .topbar-avatar'
        );
        if (userChip) {
            topbarActions.insertBefore(btn, userChip);
        } else {
            topbarActions.appendChild(btn);
        }
    }

    // ─── 6. Highlight active sidebar link ────────────────────────────────────

    function highlightActiveLink() {
        // Strip .html from both sides so comparison works with Vercel cleanUrls
        // (URL pathname has no extension, but hrefs do)
        const currentBase = (window.location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
        document.querySelectorAll(
            '.admin-sidebar__menu-link, .sidebar-link, .nav-link'
        ).forEach(link => {
            const href = link.getAttribute('href') || '';
            const hrefBase = href.split('/').pop().replace(/\.html$/, '');
            const isActive = hrefBase === currentBase;
            link.classList.toggle('admin-sidebar__menu-link--active', isActive);
            link.classList.toggle('active', isActive);
        });
    }

    // ─── Run on DOM ready ──────────────────────────────────────────────────────

    function run() {
        initTopbarUser();
        enforceStripeVisibility();
        injectLogoutButton();
        highlightActiveLink();
        initLogout();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

    // Expose session for other scripts
    window.TrendAccomAdmin = window.TrendAccomAdmin || {};
    window.TrendAccomAdmin.session = session;
    window.TrendAccomAdmin.isOwner = session.email.toLowerCase() === OWNER_EMAIL.toLowerCase();

})();
