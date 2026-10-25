    (function() {
        'use strict';

        // Update user display from session
        var session = JSON.parse(localStorage.getItem('trendaccom_admin_auth') || '{}');
        if (session.name) {
            var initials = session.name.split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0, 2);
            document.getElementById('userAvatar').textContent = initials || session.name.slice(0,2).toUpperCase();
            document.getElementById('userName').textContent = session.name;
        }

        DB.getBookings().then(function(bookings) {
            // Show DB connected badge
            var ok = document.getElementById('dbStatusBadge');
            if (ok) ok.style.display = 'flex';
            // Calculate stats
            var total = bookings.length;
            var revenue = 0;
            var pending = 0;
            var upcoming = 0;
            var today = new Date();
            today.setHours(0,0,0,0);

            bookings.forEach(function(b) {
                if (b.status === 'confirmed' || b.status === 'completed') {
                    revenue += parseFloat(b.total) || 0;
                }
                if (b.status === 'pending') {
                    pending++;
                }
                if ((b.status === 'confirmed') && b.checkin) {
                    var checkinDate = new Date(b.checkin);
                    checkinDate.setHours(0,0,0,0);
                    if (checkinDate >= today) {
                        upcoming++;
                    }
                }
            });

            // Update stat cards
            document.getElementById('statTotal').textContent = total;
            document.getElementById('statRevenue').textContent = '$' + revenue.toLocaleString('en-AU', {minimumFractionDigits: 0, maximumFractionDigits: 0});
            document.getElementById('statUpcoming').textContent = upcoming;
            document.getElementById('statPending').textContent = pending;

            // Render recent bookings table (last 3)
            var tbody = document.getElementById('recentBookingsBody');

            var sorted = bookings.slice().sort(function(a,b){
                return new Date(b.bookedAt||0) - new Date(a.bookedAt||0);
            }).slice(0, 3);

            if (sorted.length > 0) {
                tbody.innerHTML = '';
                sorted.forEach(function(b) {
                    var statusClass = {
                        confirmed: 'admin-badge--confirmed',
                        pending:   'admin-badge--pending',
                        cancelled: 'admin-badge--cancelled',
                        completed: 'admin-badge--completed'
                    }[b.status] || 'admin-badge--pending';

                    var statusLabel = b.status ? (b.status.charAt(0).toUpperCase() + b.status.slice(1)) : 'Pending';
                    var initials = (b.name || 'Guest').split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
                    var checkinFmt = b.checkin ? new Date(b.checkin + 'T12:00:00').toLocaleDateString('en-AU', {day:'2-digit',month:'short',year:'numeric'}) : '—';
                    var checkoutFmt = b.checkout ? new Date(b.checkout + 'T12:00:00').toLocaleDateString('en-AU', {day:'2-digit',month:'short',year:'numeric'}) : '—';

                    var tr = document.createElement('tr');
                    tr.innerHTML =
                        '<td>' +
                            '<div style="display:flex;align-items:center;gap:0.5rem;">' +
                                '<div class="guest-avatar" style="width:32px;height:32px;border-radius:50%;background:#0f2744;color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:600;flex-shrink:0;">' + initials + '</div>' +
                                '<div>' +
                                    '<div style="font-weight:500;font-size:0.875rem;color:#0f172a;">' + (b.name || '—') + '</div>' +
                                    '<div style="font-size:0.75rem;color:#94a3b8;">' + b.id + '</div>' +
                                '</div>' +
                            '</div>' +
                        '</td>' +
                        '<td style="font-size:0.875rem;">' + checkinFmt + '</td>' +
                        '<td style="font-size:0.875rem;">' + checkoutFmt + '</td>' +
                        '<td><span class="admin-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
                        '<td style="font-weight:600;font-size:0.875rem;">$' + (parseFloat(b.total || 0).toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0})) + '</td>';
                    tbody.appendChild(tr);
                });
            }
        }).catch(function() {
            var err = document.getElementById('dbErrorBadge');
            if (err) err.style.display = 'flex';
        });
    })();
    