    (function() {
        'use strict';

        // Update user display
        var session = JSON.parse(localStorage.getItem('trendaccom_admin_auth') || '{}');
        if (session.name) {
            var initials = session.name.split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
            document.getElementById('userAvatar').textContent = initials;
            document.getElementById('userName').textContent = session.name;
        }

        var guests = [];
        var filtered = [];
        var tbody = document.getElementById('guestsTbody');
        var countEl = document.getElementById('guestCount');

        DB.getBookings().then(function(bookings) {
        // Build guest map — deduplicate by email
        var guestMap = {};
        bookings.forEach(function(b) {
            var email = (b.email || '').toLowerCase();
            if (!email) return;
            if (!guestMap[email]) {
                guestMap[email] = {
                    name: b.name || 'Unknown',
                    email: b.email || '',
                    phone: b.phone || '—',
                    bookingCount: 0,
                    totalSpent: 0,
                    lastStay: null
                };
            }
            guestMap[email].bookingCount++;
            guestMap[email].totalSpent += parseFloat(b.total) || 0;
            var checkout = b.checkout ? new Date(b.checkout + 'T12:00:00') : null;
            if (checkout && (!guestMap[email].lastStay || checkout > guestMap[email].lastStay)) {
                guestMap[email].lastStay = checkout;
            }
        });

        guests = Object.values(guestMap);
        filtered = guests.slice();

        var AVATAR_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#6366f1','#0ea5e9','#d946ef'];

        function getColor(email) {
            var hash = 0;
            for (var i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
            return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
        }

        function renderGuests(list) {
            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:3rem;color:#94a3b8;">' +
                    (guests.length === 0
                        ? 'No guests yet. <a href="bookings.html" style="color:#0f2744;font-weight:500;">Create a booking</a>'
                        : 'No guests match your search.') +
                    '</td></tr>';
                countEl.textContent = '';
                return;
            }

            tbody.innerHTML = '';
            list.forEach(function(g) {
                var initials = g.name.split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
                var color = getColor(g.email);
                var lastStayFmt = g.lastStay
                    ? g.lastStay.toLocaleDateString('en-AU', {day:'2-digit',month:'short',year:'numeric'})
                    : '—';

                var badgeClass = g.bookingCount >= 3 ? 'admin-badge--confirmed' : 'admin-badge--pending';
                var badgeLabel = g.bookingCount >= 3 ? 'Returning' : 'New';

                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' +
                        '<div class="guest-cell">' +
                            '<div class="guest-avatar" style="background-color:' + color + ';width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.8125rem;font-weight:600;flex-shrink:0;">' + initials + '</div>' +
                            '<div class="guest-info">' +
                                '<span class="guest-name">' + g.name + '</span>' +
                                '<span class="guest-email">' + g.email + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</td>' +
                    '<td style="font-size:0.875rem;">' + g.phone + '</td>' +
                    '<td><span style="font-weight:600;color:#0f172a;">' + g.bookingCount + '</span></td>' +
                    '<td><span style="font-weight:600;color:#0f172a;">$' + g.totalSpent.toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) + '</span></td>' +
                    '<td style="font-size:0.875rem;">' + lastStayFmt + '</td>' +
                    '<td>' +
                        '<div style="display:flex;gap:0.375rem;">' +
                            '<a href="bookings.html" class="btn-icon-action" title="View bookings">'+
                                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'+
                            '</a>' +
                            '<a href="mailto:' + g.email + '" class="btn-icon-action" title="Send email">'+
                                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>'+
                            '</a>' +
                        '</div>' +
                    '</td>';
                tbody.appendChild(tr);
            });

            countEl.textContent = 'Showing ' + list.length + ' of ' + guests.length + ' guest' + (guests.length !== 1 ? 's' : '');
        }

        renderGuests(filtered);
        }); // end DB.getBookings().then()

        // Search
        document.getElementById('guestSearch').addEventListener('input', function() {
            var q = this.value.toLowerCase();
            filtered = guests.filter(function(g) {
                return g.name.toLowerCase().includes(q)
                    || g.email.toLowerCase().includes(q)
                    || (g.phone && g.phone.includes(q));
            });
            renderGuests(filtered);
        });
    })();
    