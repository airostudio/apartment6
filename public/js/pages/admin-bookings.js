(function () {
    'use strict';

    // ── In-memory cache (refreshed from Supabase on load and after mutations) ──
    var _bookings = [];

    async function loadBookings() {
        _bookings = await DB.getBookings();
        return _bookings;
    }

    // ── Rate engine ────────────────────────────────────────────────────────────
    var _rates = {};
    DB.getRates().then(function(r) { if (r) _rates = r; });
    function getRates() { return _rates; }
    function calcTotal(checkin, checkout) {
        if (!checkin || !checkout) return 0;
        var r = getRates();
        var PW = r.peakWeekend || 800, PM = r.peakMidweek || 600, SH = r.shoulder || 465, GR = r.green || 200, CLEAN = r.cleaningFee || 60, SVC = r.serviceRate || 50;
        var ci = new Date(checkin + 'T00:00:00'), co = new Date(checkout + 'T00:00:00');
        if (co <= ci) return 0;
        var accom = 0, cur = new Date(ci);
        while (cur < co) {
            var m = cur.getMonth() + 1, d = cur.getDate(), dow = cur.getDay();
            var isPeak = (m === 6 && d >= 15) || (m >= 7 && m <= 9) || (m === 10 && d <= 1);
            var isShoulder = (m === 5 && d >= 14) || (m === 6 && d <= 14) || (m === 10 && d >= 2) || (m === 11 && d === 1);
            if (isPeak) accom += (dow >= 4) ? PW : PM;
            else if (isShoulder) accom += SH;
            else accom += GR;
            cur.setDate(cur.getDate() + 1);
        }
        return Math.round(accom + CLEAN + SVC);
    }

    // ── ID generator ─────────────────────────────────────────────────────────
    function nextId() {
        if (!_bookings.length) return 'BK-1001';
        var nums = _bookings.map(function(b) { return parseInt((b.id || '').replace('BK-', '')) || 0; });
        return 'BK-' + (Math.max.apply(null, nums) + 1);
    }

    // ── Formatting ────────────────────────────────────────────────────────────
    function fmtDate(d) {
        if (!d) return '—';
        var dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function nightsBetween(ci, co) {
        var a = new Date(ci + 'T00:00:00'), b = new Date(co + 'T00:00:00');
        return Math.round((b - a) / 86400000);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    var currentFilter = 'all';
    var currentSearch = '';
    var viewingId = null;

    function badgeHtml(status) {
        var cls = { confirmed:'admin-badge--confirmed', pending:'admin-badge--pending', cancelled:'admin-badge--cancelled', completed:'admin-badge--completed' }[status] || 'admin-badge--primary';
        return '<span class="admin-badge ' + cls + '">' + status.charAt(0).toUpperCase() + status.slice(1) + '</span>';
    }

    async function renderTable() {
        var bookings = await loadBookings();
        var filtered = bookings.filter(function(b) {
            var matchFilter = currentFilter === 'all' || b.status === currentFilter;
            var q = currentSearch.toLowerCase();
            var n = (b.guestName || b.name || '').toLowerCase();
            var matchSearch = !q || n.includes(q) || (b.email||'').toLowerCase().includes(q) || (b.id||'').toLowerCase().includes(q);
            return matchFilter && matchSearch;
        });

        // Update stats
        var allBookings = bookings;
        document.getElementById('statTotal').textContent = allBookings.length;
        document.getElementById('statConfirmed').textContent = allBookings.filter(function(b){return b.status==='confirmed';}).length;
        document.getElementById('statPending').textContent = allBookings.filter(function(b){return b.status==='pending';}).length;
        var rev = allBookings.filter(function(b){return b.status!=='cancelled';}).reduce(function(s,b){return s+(b.total||0);}, 0);
        document.getElementById('statRevenue').textContent = '$' + rev.toLocaleString();

        var tbody = document.getElementById('bookingsTableBody');
        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="bk-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>' + (currentFilter !== 'all' ? 'No ' + currentFilter + ' bookings.' : 'No bookings yet. Click <strong>New Booking</strong> to create one.') + '</p></div></td></tr>';
            return;
        }

        // Sort newest first
        filtered.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

        tbody.innerHTML = filtered.map(function(b) {
            var nights = nightsBetween(b.checkin, b.checkout);
            return '<tr data-id="' + b.id + '">' +
                '<td><span class="admin-booking-id">#' + b.id + '</span></td>' +
                '<td><div class="admin-guest-cell"><span class="admin-guest-cell__name">' + escHtml(b.name) + '</span><span class="admin-guest-cell__email">' + escHtml(b.email) + '</span></div></td>' +
                '<td><div class="admin-dates-cell"><span class="admin-dates-cell__checkin">' + fmtDate(b.checkin) + '</span><span class="admin-dates-cell__separator">&rarr;</span><span class="admin-dates-cell__checkout">' + fmtDate(b.checkout) + '</span></div></td>' +
                '<td>' + nights + '</td>' +
                '<td>' + (b.guests || '—') + '</td>' +
                '<td>' + badgeHtml(b.status) + '</td>' +
                '<td><strong>$' + (b.total || 0).toLocaleString() + '</strong></td>' +
                '<td><div class="admin-actions-cell">' +
                    '<button class="admin-action-btn btn-view" data-id="' + b.id + '" title="View"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
                    '<button class="admin-action-btn btn-edit" data-id="' + b.id + '" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
                    (b.status !== 'cancelled' ? '<button class="admin-action-btn btn-invoice" data-id="' + b.id + '" title="Send Tax Invoice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg></button>' : '') +
                    (b.status !== 'cancelled' ? '<button class="admin-action-btn admin-action-btn--danger btn-cancel" data-id="' + b.id + '" title="Cancel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></button>' : '') +
                '</div></td>' +
            '</tr>';
        }).join('');
    }

    function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    // ── Filter buttons ────────────────────────────────────────────────────────
    document.getElementById('filterBtns').addEventListener('click', function(e) {
        var btn = e.target.closest('.admin-filter-btn');
        if (!btn) return;
        document.querySelectorAll('.admin-filter-btn').forEach(function(b){ b.classList.remove('admin-filter-btn--active'); });
        btn.classList.add('admin-filter-btn--active');
        currentFilter = btn.getAttribute('data-filter');
        renderTable();
    });

    document.getElementById('searchInput').addEventListener('input', function() {
        currentSearch = this.value;
        renderTable();
    });

    // ── Create / Edit modal ───────────────────────────────────────────────────
    var editModal = document.getElementById('editModal');

    function openEditModal(booking) {
        document.getElementById('editModalTitle').textContent = booking ? 'Edit Booking' : 'New Booking';
        document.getElementById('editBookingId').value = booking ? booking.id : '';
        document.getElementById('editName').value = booking ? booking.name : '';
        document.getElementById('editEmail').value = booking ? booking.email : '';
        document.getElementById('editPhone').value = booking ? (booking.phone || '') : '';
        document.getElementById('editGuests').value = booking ? (booking.guests || 2) : 2;
        document.getElementById('editCheckin').value = booking ? booking.checkin : '';
        document.getElementById('editCheckout').value = booking ? booking.checkout : '';
        document.getElementById('editStatus').value = booking ? booking.status : 'pending';
        document.getElementById('editTotal').value = booking ? (booking.total || '') : '';
        document.getElementById('editNotes').value = booking ? (booking.notes || '') : '';
        editModal.classList.add('open');
    }

    function closeEditModal() { editModal.classList.remove('open'); }

    document.getElementById('createBookingBtn').addEventListener('click', function() { openEditModal(null); });
    document.getElementById('editModalClose').addEventListener('click', closeEditModal);
    document.getElementById('editModalCancel').addEventListener('click', closeEditModal);
    editModal.addEventListener('click', function(e) { if (e.target === editModal) closeEditModal(); });

    // Auto-calculate total when dates change in modal
    function recalcModalTotal() {
        var ci = document.getElementById('editCheckin').value;
        var co = document.getElementById('editCheckout').value;
        if (ci && co && co > ci) document.getElementById('editTotal').value = calcTotal(ci, co);
    }
    document.getElementById('editCheckin').addEventListener('change', recalcModalTotal);
    document.getElementById('editCheckout').addEventListener('change', recalcModalTotal);

    document.getElementById('editModalSave').addEventListener('click', async function() {
        var name = document.getElementById('editName').value.trim();
        var email = document.getElementById('editEmail').value.trim();
        var checkin = document.getElementById('editCheckin').value;
        var checkout = document.getElementById('editCheckout').value;
        if (!name || !email || !checkin || !checkout) { alert('Please fill in all required fields.'); return; }
        if (checkout <= checkin) { alert('Check-out must be after check-in.'); return; }

        var id = document.getElementById('editBookingId').value;
        var isExisting = !!id;
        var total = parseInt(document.getElementById('editTotal').value) || calcTotal(checkin, checkout);

        var record = {
            id:        id || nextId(),
            guestName: name,
            name:      name,
            email:     email,
            phone:     document.getElementById('editPhone').value.trim(),
            guests:    parseInt(document.getElementById('editGuests').value) || 2,
            checkin:   checkin,
            checkout:  checkout,
            status:    document.getElementById('editStatus').value,
            total:     total,
            notes:     document.getElementById('editNotes').value.trim(),
            bookedAt:  isExisting ? (_bookings.find(function(b){return b.id===id;})||{}).bookedAt || new Date().toISOString() : new Date().toISOString(),
        };

        try {
            if (isExisting) { await DB.updateBooking(id, record); } else { await DB.createBooking(record); }
        } catch (err) {
            alert(err.message || 'Could not save booking.');
            return;
        }
        closeEditModal();
        renderTable();
        showToast(isExisting ? 'Booking updated!' : 'Booking created!');
    });

    // ── View modal ────────────────────────────────────────────────────────────
    var viewModal = document.getElementById('viewModal');

    function openViewModal(id) {
        var booking = _bookings.find(function(b){return b.id===id;});
        if (!booking) return;
        viewingId = id;
        var nights = nightsBetween(booking.checkin, booking.checkout);
        document.getElementById('viewModalBody').innerHTML = [
            row('Booking ID', '#' + booking.id),
            row('Guest', escHtml(booking.name)),
            row('Email', '<a href="mailto:' + escHtml(booking.email) + '">' + escHtml(booking.email) + '</a>'),
            row('Phone', booking.phone || '—'),
            row('Property', 'Cascade Apartment 6'),
            row('Check-in', fmtDate(booking.checkin) + ' (3:00 PM)'),
            row('Check-out', fmtDate(booking.checkout) + ' (11:00 AM)'),
            row('Nights', nights),
            row('Guests', booking.guests || '—'),
            row('Status', badgeHtml(booking.status)),
            row('Total', '<strong>$' + (booking.total || 0).toLocaleString() + '</strong>'),
            booking.notes ? row('Notes', escHtml(booking.notes)) : ''
        ].join('');
        viewModal.classList.add('open');
    }

    function row(label, value) {
        return '<div class="bk-detail-row"><span class="bk-detail-label">' + label + '</span><span class="bk-detail-value">' + value + '</span></div>';
    }

    function closeViewModal() { viewModal.classList.remove('open'); viewingId = null; }
    document.getElementById('viewModalClose').addEventListener('click', closeViewModal);
    document.getElementById('viewModalClose2').addEventListener('click', closeViewModal);
    viewModal.addEventListener('click', function(e) { if (e.target === viewModal) closeViewModal(); });
    document.getElementById('viewModalEdit').addEventListener('click', function() {
        if (!viewingId) return;
        var booking = _bookings.find(function(b){return b.id===viewingId;});
        closeViewModal();
        if (booking) openEditModal(booking);
    });
    document.getElementById('viewModalInvoice').addEventListener('click', function() {
        if (!viewingId) return;
        openInvoiceModal(viewingId);
    });

    // ── Tax invoice preview / send ───────────────────────────────────────────
    var invoiceModal = document.getElementById('invoiceModal');
    var invoiceFrame = document.getElementById('invoiceFrame');
    var invoiceLoading = document.getElementById('invoiceLoading');
    var invoiceDownloadBtn = document.getElementById('invoiceModalDownload');
    var invoiceSendBtn = document.getElementById('invoiceModalSend');
    var invoicingId = null;
    var invoicePreview = null; // { invoiceNumber, html, sentTo }

    async function openInvoiceModal(id) {
        var booking = _bookings.find(function(b){return b.id===id;});
        if (!booking) return;
        if (!booking.email) { showToast('Booking has no email address.'); return; }

        invoicingId = id;
        invoicePreview = null;
        invoiceFrame.style.display = 'none';
        invoiceFrame.srcdoc = '';
        invoiceLoading.style.display = 'block';
        invoiceLoading.textContent = 'Loading invoice…';
        invoiceDownloadBtn.disabled = true;
        invoiceSendBtn.disabled = true;
        invoiceModal.classList.add('open');

        try {
            var preview = await DB.previewTaxInvoice(id);
            if (invoicingId !== id) return; // modal was reused for a different booking meanwhile
            invoicePreview = preview;
            invoiceFrame.srcdoc = preview.html;
            invoiceFrame.style.display = 'block';
            invoiceLoading.style.display = 'none';
            invoiceDownloadBtn.disabled = false;
            invoiceSendBtn.disabled = false;
        } catch (err) {
            invoiceLoading.textContent = 'Failed to load invoice: ' + err.message;
        }
    }

    function closeInvoiceModal() { invoiceModal.classList.remove('open'); invoicingId = null; invoicePreview = null; }
    document.getElementById('invoiceModalClose').addEventListener('click', closeInvoiceModal);
    document.getElementById('invoiceModalCancel').addEventListener('click', closeInvoiceModal);
    invoiceModal.addEventListener('click', function(e) { if (e.target === invoiceModal) closeInvoiceModal(); });

    invoiceDownloadBtn.addEventListener('click', function() {
        if (!invoicePreview) return;
        var blob = new Blob([invoicePreview.html], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (invoicePreview.invoiceNumber || 'tax-invoice') + '.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    invoiceSendBtn.addEventListener('click', async function() {
        if (!invoicingId || !invoicePreview) return;
        var id = invoicingId;
        invoiceSendBtn.disabled = true;
        invoiceSendBtn.textContent = 'Sending…';
        try {
            var result = await DB.sendTaxInvoice(id);
            closeInvoiceModal();
            showToast('Tax invoice sent to ' + (result.sentTo || '') + '.');
        } catch (err) {
            showToast('Failed to send invoice: ' + err.message);
        } finally {
            invoiceSendBtn.disabled = false;
            invoiceSendBtn.textContent = 'Send Invoice';
        }
    });

    // ── Cancel modal ─────────────────────────────────────────────────────────
    var cancelModal = document.getElementById('cancelModal');
    var cancelingId = null;

    function openCancelModal(id) {
        cancelingId = id;
        document.getElementById('cancelBookingId').textContent = '#' + id;
        cancelModal.classList.add('open');
    }
    function closeCancelModal() { cancelModal.classList.remove('open'); cancelingId = null; }
    document.getElementById('cancelModalClose').addEventListener('click', closeCancelModal);
    document.getElementById('cancelModalAbort').addEventListener('click', closeCancelModal);
    cancelModal.addEventListener('click', function(e) { if (e.target === cancelModal) closeCancelModal(); });
    document.getElementById('cancelModalConfirm').addEventListener('click', async function() {
        if (!cancelingId) return;
        await DB.updateBooking(cancelingId, { status: 'cancelled' });
        closeCancelModal();
        renderTable();
        showToast('Booking cancelled.');
    });

    // ── Table click delegation ────────────────────────────────────────────────
    document.getElementById('bookingsTableBody').addEventListener('click', function(e) {
        var viewBtn    = e.target.closest('.btn-view');
        var editBtn    = e.target.closest('.btn-edit');
        var cancelBtn  = e.target.closest('.btn-cancel');
        var invoiceBtn = e.target.closest('.btn-invoice');
        if (viewBtn)    { openViewModal(viewBtn.getAttribute('data-id')); }
        if (editBtn)    { var booking = _bookings.find(function(b){return b.id===editBtn.getAttribute('data-id');}); if (booking) openEditModal(booking); }
        if (cancelBtn)  { openCancelModal(cancelBtn.getAttribute('data-id')); }
        if (invoiceBtn) { openInvoiceModal(invoiceBtn.getAttribute('data-id')); }
    });

    // Escape key closes any open modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { closeEditModal(); closeViewModal(); closeCancelModal(); closeInvoiceModal(); }
    });

    // ── Toast ─────────────────────────────────────────────────────────────────
    function showToast(msg) {
        var t = document.getElementById('bkToast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(function(){ t.classList.remove('show'); }, 2800);
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    renderTable();

})();
