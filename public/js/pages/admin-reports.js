    (function() {
        'use strict';

        function fmtMoney(n) {
            return '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }

        function fmtDate(s) {
            if (!s) return '—';
            var d = new Date(s + 'T00:00:00');
            return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        function loadReports() {
            var fromVal = document.getElementById('date-from').value;
            var toVal   = document.getElementById('date-to').value;
            var from    = fromVal ? new Date(fromVal) : null;
            var to      = toVal   ? new Date(toVal + 'T23:59:59') : null;

            var all = [];
            try { all = JSON.parse(localStorage.getItem('cascade6_bookings') || '[]'); } catch(e) {}

            var bookings = all.filter(function(b) {
                if (b.status === 'cancelled') return false;
                if (!b.checkin) return false;
                var ci = new Date(b.checkin + 'T00:00:00');
                if (from && ci < from) return false;
                if (to   && ci > to)   return false;
                return true;
            });

            // Stats
            var totalRev = bookings.reduce(function(s, b) { return s + Number(b.total || 0); }, 0);
            var totalNights = bookings.reduce(function(s, b) { return s + Number(b.nights || 0); }, 0);
            var adr  = totalNights > 0 ? totalRev / totalNights : 0;
            var avgLOS = bookings.length > 0 ? totalNights / bookings.length : 0;

            document.getElementById('statRevenue').textContent  = bookings.length ? fmtMoney(totalRev)         : '—';
            document.getElementById('statBookings').textContent = bookings.length ? String(bookings.length)    : '—';
            document.getElementById('statADR').textContent      = bookings.length ? fmtMoney(adr)              : '—';
            document.getElementById('statLOS').textContent      = bookings.length ? avgLOS.toFixed(1) + ' nights' : '—';

            // Table
            var tbody = document.getElementById('bookingsTableBody');
            if (!bookings.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;color:#94a3b8">No bookings found for the selected period.</td></tr>';
                return;
            }

            bookings.sort(function(a, b) { return a.checkin < b.checkin ? -1 : 1; });
            tbody.innerHTML = bookings.map(function(b, i) {
                return '<tr style="border-bottom:1px solid #f1f5f9">'
                    + '<td style="padding:0.75rem 0.5rem;color:#64748b">' + (b.ref || '—') + '</td>'
                    + '<td style="padding:0.75rem 0.5rem;font-weight:500;color:#0f172a">' + (b.name || '—') + '</td>'
                    + '<td style="padding:0.75rem 0.5rem;color:#334155">' + fmtDate(b.checkin) + '</td>'
                    + '<td style="padding:0.75rem 0.5rem;text-align:right;color:#334155">' + (b.nights || 0) + '</td>'
                    + '<td style="padding:0.75rem 0.5rem;text-align:right;color:#334155">' + (b.guests || 0) + '</td>'
                    + '<td style="padding:0.75rem 0.5rem;text-align:right;font-weight:500;color:#0f172a">' + fmtMoney(b.total) + '</td>'
                    + '</tr>';
            }).join('');
        }

        // Set default date range to current year
        var now = new Date();
        var y = now.getFullYear();
        document.getElementById('date-from').value = y + '-01-01';
        document.getElementById('date-to').value   = y + '-12-31';

        // Apply button
        var applyBtn = document.querySelector('.btn-primary[style*="2563eb"]');
        if (applyBtn) applyBtn.addEventListener('click', loadReports);

        // Initial load
        loadReports();
    })();
    