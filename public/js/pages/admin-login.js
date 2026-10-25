(function() {
    'use strict';

    // If already logged in, redirect to dashboard
    if (localStorage.getItem('trendaccom_admin_auth')) {
        window.location.href = 'index.html';
    }

    const form     = document.getElementById('loginForm');
    const errorEl  = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        errorEl.classList.remove('visible');

        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        loginBtn.disabled    = true;
        loginBtn.textContent = 'Signing in…';

        try {
            const res  = await fetch('/api/admin-login', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, password }),
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                const session = {
                    email:    data.email,
                    role:     data.role,
                    name:     data.name,
                    adminKey: password,
                    loginAt:  Date.now(),
                };
                localStorage.setItem('trendaccom_admin_auth', JSON.stringify(session));

                let redirect = new URLSearchParams(window.location.search).get('redirect') || '';
                if (!redirect || !redirect.startsWith('/admin/')) redirect = '/admin/index.html';
                window.location.href = redirect;
            } else {
                errorEl.classList.add('visible');
                document.getElementById('password').value = '';
                document.getElementById('password').focus();
                loginBtn.disabled    = false;
                loginBtn.textContent = 'Sign In';
            }
        } catch (err) {
            errorEl.textContent = 'Network error. Please try again.';
            errorEl.classList.add('visible');
            loginBtn.disabled    = false;
            loginBtn.textContent = 'Sign In';
        }
    });
})();
