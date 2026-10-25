(function () {
'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
var MONTH_NAMES = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
var DOW_FULL    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var DOW_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var MON_SHORT   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── State ────────────────────────────────────────────────────────────────────
var today = new Date(); today.setHours(0,0,0,0);
var view  = 'month';   // 'year' | 'month' | 'day'
var cursor = new Date(today.getFullYear(), today.getMonth(), 1); // first of shown month
var dayDate = new Date(today); // for day view
var currentBookingId = null;

// ── Data helpers ─────────────────────────────────────────────────────────────
var _calBookings = [];
var _calBlocked  = [];

async function loadData() {
    _calBookings = await DB.getBookings();
    _calBlocked  = await DB.getBlockedDates();
}

function ymd(d) {
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
}
function parseYMD(s) {
    if (!s) return null;
    var p = String(s).split(/[-\/]/);
    if (p.length < 3) return null;
    var d = new Date(+p[0], +p[1]-1, +p[2], 0,0,0,0);
    return isNaN(d) ? null : d;
}
function nightsBetween(a, b) {
    return Math.round((b - a) / 86400000);
}
function fmtDate(d) {
    if (!d) return '—';
    return d.getDate() + ' ' + MON_SHORT[d.getMonth()] + ' ' + d.getFullYear();
}
function fmtMoney(n) {
    return '$' + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
}

// Build a map of ymd → [booking, …] for fast day lookup
function buildDayMap(bookings, blocked) {
    var map = {};
    function addToMap(dateStr, entry) {
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(entry);
    }
    bookings.forEach(function(b) {
        var ci = parseYMD(b.checkIn || b.checkin || b.check_in);
        var co = parseYMD(b.checkOut || b.checkout || b.check_out);
        if (!ci || !co) return;
        var d = new Date(ci);
        while (d < co) {
            addToMap(ymd(d), { type: 'booking', booking: b });
            d.setDate(d.getDate()+1);
        }
        // Mark checkout day so it appears in year/day views
        addToMap(ymd(co), { type: 'checkout', booking: b });
    });
    blocked.forEach(function(bl) {
        var from = parseYMD(bl.from);
        var to   = parseYMD(bl.to);
        if (!from || !to) return;
        var d = new Date(from);
        while (d <= to) {
            addToMap(ymd(d), { type: 'blocked', block: bl });
            d.setDate(d.getDate()+1);
        }
    });
    return map;
}

// ── Render ───────────────────────────────────────────────────────────────────
async function render() {
    await loadData();
    var bookings = _calBookings;
    var blocked  = _calBlocked;
    var dayMap   = buildDayMap(bookings, blocked);

    document.getElementById('viewMonth').style.display = view === 'month' ? '' : 'none';
    document.getElementById('viewYear').style.display  = view === 'year'  ? '' : 'none';
    document.getElementById('viewDay').style.display   = view === 'day'   ? '' : 'none';

    document.querySelectorAll('.cal-view-tab').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'month') renderMonth(bookings, blocked, dayMap);
    if (view === 'year')  renderYear(dayMap);
    if (view === 'day')   renderDay(dayMap, bookings, blocked);

    updateLabel();
    renderUpcoming(bookings);
}

// ── Month view ───────────────────────────────────────────────────────────────
function renderMonth(bookings, blocked, dayMap) {
    var year  = cursor.getFullYear();
    var month = cursor.getMonth();
    var firstDay = new Date(year, month, 1);
    var lastDay  = new Date(year, month+1, 0);

    // Grid starts on Sunday of the week containing the 1st
    var startCell = new Date(firstDay);
    startCell.setDate(firstDay.getDate() - firstDay.getDay());

    // Build booking spans for this month view
    var spans = buildMonthSpans(bookings, blocked, year, month);

    var html = '<div class="mcal">';
    // DOW header
    html += '<div class="mcal-dow-row">';
    DOW_SHORT.forEach(function(d, i) {
        html += '<div class="mcal-dow' + (i===0||i===6?' weekend':'') + '">' + d + '</div>';
    });
    html += '</div>';
    html += '<div class="mcal-grid">';

    var d = new Date(startCell);
    for (var row = 0; row < 6; row++) {
        for (var col = 0; col < 7; col++) {
            var dm  = ymd(d);
            var isOther  = d.getMonth() !== month;
            var isToday  = dm === ymd(today);
            var isPast   = d < today && !isToday;
            var isWeekend = col === 0 || col === 6;
            var dayEntries = dayMap[dm] || [];
            var hasBooking = dayEntries.length > 0;

            var cls = 'mcal-cell';
            if (isOther) cls += ' other-month';
            if (isToday) cls += ' is-today';
            if (isPast)  cls += ' is-past';
            if (isWeekend && !isToday) cls += ' weekend';
            if (hasBooking) cls += ' has-booking';

            html += '<div class="' + cls + '" data-date="' + dm + '">';
            html += '<span class="mcal-day-num">' + d.getDate() + '</span>';

            // Render booking bars for this cell
            var cellSpans = (spans[dm] || []);
            var shown = 0;
            cellSpans.forEach(function(sp) {
                if (shown >= 3) return;
                shown++;
                var posCls = '';
                if (sp.isCheckout)           posCls = 'span-checkout';
                else if (sp.isStart && sp.isEnd) posCls = 'span-start span-end';
                else if (sp.isStart)         posCls = 'span-start';
                else if (sp.isEnd)           posCls = 'span-end';
                else                         posCls = 'span-mid';

                var label = '';
                if (sp.isStart || sp.isCheckout) {
                    if (sp.type === 'booking') {
                        label = sp.booking.guestName || sp.booking.guest_name || 'Guest';
                    } else {
                        label = sp.block.reason || 'Blocked';
                    }
                }
                var typeCls = sp.type === 'blocked' ? 'blocked' : (sp.booking ? (sp.booking.status || 'confirmed') : 'confirmed');
                var bid = sp.type === 'booking' ? ('data-booking-id="' + (sp.booking.id||'') + '"') : '';

                html += '<div class="mcal-booking ' + typeCls + ' ' + posCls + '" ' + bid + '>' + escHtml(label) + '</div>';
            });

            var total = cellSpans.length;
            if (total > 3) {
                html += '<div class="mcal-more">+' + (total - 3) + ' more</div>';
            }

            html += '</div>';
            d.setDate(d.getDate()+1);
        }
        // Don't render extra rows if we've passed the month
        if (d.getMonth() !== month && row >= 4) break;
    }
    html += '</div></div>';

    document.getElementById('viewMonth').innerHTML = html;

    // Events: click booking bars
    document.querySelectorAll('.mcal-booking[data-booking-id]').forEach(function(el) {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            openBookingPanel(el.dataset.bookingId);
        });
    });
    // Events: click day cell → day view
    document.querySelectorAll('.mcal-cell').forEach(function(cell) {
        cell.addEventListener('click', function() {
            var dt = parseYMD(cell.dataset.date);
            if (!dt) return;
            dayDate = dt;
            setView('day');
        });
    });
}

// Build a map of ymd → [{isStart, isEnd, type, booking?, block?}, …]
function buildMonthSpans(bookings, blocked, year, month) {
    var spans = {};
    function addSpan(dateStr, entry) {
        if (!spans[dateStr]) spans[dateStr] = [];
        spans[dateStr].push(entry);
    }
    var monthStart = new Date(year, month, 1);
    var monthEnd   = new Date(year, month+1, 0);

    function processRange(from, to, type, data) {
        if (!from || !to) return;
        var d = new Date(from);
        while (d < to || (type === 'blocked' && d <= to)) {
            var dm = ymd(d);
            addSpan(dm, {
                isStart:    ymd(d) === ymd(from),
                isEnd:      type === 'blocked' ? ymd(d) === ymd(to) : ymd(new Date(d.getTime() + 86400000)) === ymd(to),
                isCheckout: false,
                type:       type,
                booking:    data.booking || null,
                block:      data.block   || null
            });
            d.setDate(d.getDate()+1);
        }
        // For bookings, add a checkout half-bar on the checkout day (AM portion)
        if (type === 'booking') {
            addSpan(ymd(to), {
                isStart:    false,
                isEnd:      false,
                isCheckout: true,
                type:       type,
                booking:    data.booking || null,
                block:      null
            });
        }
    }

    bookings.forEach(function(b) {
        var ci = parseYMD(b.checkIn || b.checkin || b.check_in);
        var co = parseYMD(b.checkOut || b.checkout || b.check_out);
        processRange(ci, co, 'booking', { booking: b });
    });
    blocked.forEach(function(bl) {
        var from = parseYMD(bl.from);
        var to   = parseYMD(bl.to);
        processRange(from, to, 'blocked', { block: bl });
    });
    return spans;
}

// ── Year view ────────────────────────────────────────────────────────────────
function renderYear(dayMap) {
    var year = cursor.getFullYear();
    var html = '<div class="ycal">';

    for (var m = 0; m < 12; m++) {
        html += '<div class="ycal-month" data-month="' + m + '">';
        html += '<div class="ycal-month-title">' + MONTH_NAMES[m] + ' ' + year + '</div>';
        html += '<div class="ycal-dow-row">';
        DOW_SHORT.forEach(function(d) { html += '<div class="ycal-dow">' + d[0] + '</div>'; });
        html += '</div>';
        html += '<div class="ycal-grid">';

        var first = new Date(year, m, 1);
        var last  = new Date(year, m+1, 0);
        var start = new Date(first);
        start.setDate(1 - first.getDay());

        var d = new Date(start);
        for (var i = 0; i < 42; i++) {
            var dm = ymd(d);
            var isOther = d.getMonth() !== m;
            var isToday = dm === ymd(today);
            var entries = dayMap[dm] || [];
            var hasB    = entries.some(function(e){ return e.type==='booking' || e.type==='checkout'; });
            var hasBl   = entries.some(function(e){ return e.type==='blocked'; });

            var cls = 'ycal-cell';
            if (isOther) cls += ' other-month';
            if (isToday) cls += ' is-today';
            if (hasB)    cls += ' has-booking';
            else if (hasBl) cls += ' has-blocked';

            var num = isToday ? '<span>' + d.getDate() + '</span>' : d.getDate();
            html += '<div class="' + cls + '">' + num + '</div>';
            d.setDate(d.getDate()+1);
        }
        html += '</div></div>';
    }
    html += '</div>';
    document.getElementById('viewYear').innerHTML = html;

    // Click a mini month → go to month view
    document.querySelectorAll('.ycal-month').forEach(function(el) {
        el.addEventListener('click', function() {
            cursor = new Date(cursor.getFullYear(), +el.dataset.month, 1);
            setView('month');
        });
    });
}

// ── Day view ─────────────────────────────────────────────────────────────────
function renderDay(dayMap, bookings, blocked) {
    var dm = ymd(dayDate);
    var entries = dayMap[dm] || [];
    var dow = DOW_FULL[dayDate.getDay()];
    var label = dow + ', ' + dayDate.getDate() + ' ' + MONTH_NAMES[dayDate.getMonth()] + ' ' + dayDate.getFullYear();

    var html = '<div class="dcal">';
    html += '<div class="dcal-date-header">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="color:#0f2744;flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    html += escHtml(label);
    html += '</div>';

    if (entries.length === 0) {
        html += '<div class="dcal-empty">No bookings or blocks on this date.</div>';
    } else {
        // Deduplicate bookings by id
        var seen = {};
        entries.forEach(function(entry) {
            if (entry.type === 'booking' || entry.type === 'checkout') {
                var bid = (entry.booking.id || JSON.stringify(entry.booking)) + (entry.type === 'checkout' ? '-out' : '');
                if (seen[bid]) return;
                seen[bid] = true;
                var b = entry.booking;
                var status = (b.status || 'confirmed').toLowerCase();
                var name = b.guestName || b.guest_name || 'Guest';
                var ci   = parseYMD(b.checkIn || b.checkin || b.check_in);
                var co   = parseYMD(b.checkOut || b.checkout || b.check_out);
                var nights = (ci && co) ? nightsBetween(ci, co) : '?';
                var isOut = entry.type === 'checkout';
                html += '<div class="dcal-booking-card" data-booking-id="' + escHtml(b.id||'') + '">';
                html += '<div class="dcal-booking-dot ' + status + '"></div>';
                html += '<div class="dcal-booking-info">';
                html += '<div class="dcal-booking-name">' + escHtml(name) + (isOut ? ' <span style="font-size:0.75rem;font-weight:400;opacity:0.65;">— checking out</span>' : '') + '</div>';
                html += '<div class="dcal-booking-sub">' + fmtDate(ci) + ' → ' + fmtDate(co) + ' · ' + nights + ' night' + (nights===1?'':'s') + '</div>';
                html += '</div>';
                html += '<span class="dcal-booking-badge ' + status + '">' + (isOut ? 'check-out' : status) + '</span>';
                html += '</div>';
            } else {
                var bl = entry.block;
                html += '<div class="dcal-booking-card" style="cursor:default;">';
                html += '<div class="dcal-booking-dot blocked"></div>';
                html += '<div class="dcal-booking-info">';
                html += '<div class="dcal-booking-name">Blocked / Unavailable</div>';
                html += '<div class="dcal-booking-sub">' + escHtml(bl.reason || 'No reason given') + '</div>';
                html += '</div>';
                html += '<span class="dcal-booking-badge blocked">blocked</span>';
                html += '</div>';
            }
        });
    }
    html += '</div>';
    document.getElementById('viewDay').innerHTML = html;

    document.querySelectorAll('.dcal-booking-card[data-booking-id]').forEach(function(el) {
        el.addEventListener('click', function() {
            openBookingPanel(el.dataset.bookingId);
        });
    });
}

// ── Update label ─────────────────────────────────────────────────────────────
function updateLabel() {
    var lbl = document.getElementById('calLabel');
    if (view === 'year') {
        lbl.textContent = cursor.getFullYear();
    } else if (view === 'month') {
        lbl.textContent = MONTH_NAMES[cursor.getMonth()] + ' ' + cursor.getFullYear();
    } else {
        lbl.textContent = DOW_SHORT[dayDate.getDay()] + ' ' + dayDate.getDate() + ' ' + MON_SHORT[dayDate.getMonth()] + ' ' + dayDate.getFullYear();
    }
}

// ── Navigation ───────────────────────────────────────────────────────────────
function navigate(dir) {
    if (view === 'year') {
        cursor.setFullYear(cursor.getFullYear() + dir);
    } else if (view === 'month') {
        cursor.setMonth(cursor.getMonth() + dir);
    } else {
        dayDate.setDate(dayDate.getDate() + dir);
    }
    render();
}

function setView(v) {
    view = v;
    if (v === 'month') {
        // Sync cursor to dayDate month if coming from day view
        cursor = new Date(dayDate.getFullYear(), dayDate.getMonth(), 1);
    }
    render();
}

document.getElementById('calPrev').addEventListener('click', function(){ navigate(-1); });
document.getElementById('calNext').addEventListener('click', function(){ navigate(1); });
document.getElementById('calTodayBtn').addEventListener('click', function(){
    dayDate = new Date(today);
    cursor  = new Date(today.getFullYear(), today.getMonth(), 1);
    render();
});
document.querySelectorAll('.cal-view-tab').forEach(function(btn) {
    btn.addEventListener('click', function(){ setView(btn.dataset.view); });
});

// ── Booking Detail Panel ──────────────────────────────────────────────────────
function openBookingPanel(bookingId) {
    var b = _calBookings.find(function(x){ return x.id === bookingId; });
    if (!b) return;
    currentBookingId = bookingId;

    var ci = parseYMD(b.checkIn || b.checkin || b.check_in);
    var co = parseYMD(b.checkOut || b.checkout || b.check_out);
    var nights = (ci && co) ? nightsBetween(ci, co) : 0;
    var status = (b.status || 'confirmed').toLowerCase();

    document.getElementById('bdpName').textContent    = b.guestName || b.guest_name || 'Guest';
    document.getElementById('bdpRef').textContent     = b.reference || b.id || '';
    document.getElementById('bdpBookedAt').textContent = b.bookedAt ? 'Booked ' + new Date(b.bookedAt).toLocaleDateString('en-AU') : '';

    var badge = document.getElementById('bdpBadge');
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    badge.className = 'bdp-badge ' + status;

    document.getElementById('bdpCiVal').textContent = ci ? fmtDate(ci) : '—';
    document.getElementById('bdpCiDay').textContent = ci ? DOW_FULL[ci.getDay()] : '';
    document.getElementById('bdpCoVal').textContent = co ? fmtDate(co) : '—';
    document.getElementById('bdpCoDay').textContent = co ? DOW_FULL[co.getDay()] : '';
    document.getElementById('bdpNights').textContent   = nights + ' night' + (nights===1?'':'s');
    document.getElementById('bdpGuestsVal').textContent = (b.guests||b.guestCount||1) + ' guest' + ((b.guests||b.guestCount||1)===1?'':'s');

    // Guest contact
    var emailRow  = document.getElementById('bdpEmailRow');
    var phoneRow  = document.getElementById('bdpPhoneRow');
    var noContact = document.getElementById('bdpNoContactRow');
    emailRow.style.display  = 'none';
    phoneRow.style.display  = 'none';
    noContact.style.display = 'none';
    if (b.guestEmail || b.email) {
        emailRow.style.display = 'flex';
        document.getElementById('bdpEmail').textContent = b.guestEmail || b.email;
    }
    if (b.guestPhone || b.phone) {
        phoneRow.style.display = 'flex';
        document.getElementById('bdpPhone').textContent = b.guestPhone || b.phone;
    }
    if (!b.guestEmail && !b.email && !b.guestPhone && !b.phone) {
        noContact.style.display = 'flex';
    }

    // Price rows
    var priceRows = document.getElementById('bdpPriceRows');
    var priceHtml = '';
    if (b.priceBreakdown) {
        var pb = b.priceBreakdown;
        if (pb.baseRate) priceHtml += '<div class="bdp-price-row"><span>' + (nights||'') + ' night' + (nights===1?'':'s') + ' × ' + fmtMoney(pb.nightly||0) + '</span><span>' + fmtMoney(pb.baseRate) + '</span></div>';
        if (pb.cleaningFee) priceHtml += '<div class="bdp-price-row"><span>Cleaning fee</span><span>' + fmtMoney(pb.cleaningFee) + '</span></div>';
        if (pb.extraGuestFee) priceHtml += '<div class="bdp-price-row"><span>Extra guest fee</span><span>' + fmtMoney(pb.extraGuestFee) + '</span></div>';
        priceHtml += '<div class="bdp-price-row total"><span>Total</span><span>' + fmtMoney(pb.total||b.totalAmount||b.amount||0) + '</span></div>';
    } else if (b.totalAmount || b.amount) {
        priceHtml += '<div class="bdp-price-row total"><span>Total</span><span>' + fmtMoney(b.totalAmount||b.amount) + '</span></div>';
    }
    priceRows.innerHTML = priceHtml;

    // Notes
    var notesSection = document.getElementById('bdpNotesSection');
    if (b.specialRequests || b.notes) {
        notesSection.style.display = '';
        document.getElementById('bdpNotes').textContent = b.specialRequests || b.notes;
    } else {
        notesSection.style.display = 'none';
    }

    document.getElementById('bdpOverlay').classList.add('open');
}

function closeBookingPanel() {
    document.getElementById('bdpOverlay').classList.remove('open');
    currentBookingId = null;
}

document.getElementById('bdpClose').addEventListener('click', closeBookingPanel);
document.getElementById('bdpCloseBtn').addEventListener('click', closeBookingPanel);
document.getElementById('bdpOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeBookingPanel();
});
document.getElementById('bdpMarkCancelled').addEventListener('click', async function() {
    if (!currentBookingId) return;
    if (!confirm('Mark this booking as cancelled?')) return;
    await DB.updateBooking(currentBookingId, { status: 'cancelled' });
    closeBookingPanel();
    render();
});

// ── Block dates modal ─────────────────────────────────────────────────────────
document.getElementById('blockDatesBtn').addEventListener('click', function() {
    document.getElementById('bmOverlay').classList.add('open');
    // Pre-fill with selected day if in day view
    if (view === 'day') {
        document.getElementById('bmFrom').value = ymd(dayDate);
        document.getElementById('bmTo').value   = ymd(dayDate);
    }
});
document.getElementById('bmClose').addEventListener('click', function() { document.getElementById('bmOverlay').classList.remove('open'); });
document.getElementById('bmCancel').addEventListener('click', function() { document.getElementById('bmOverlay').classList.remove('open'); });
document.getElementById('bmSave').addEventListener('click', async function() {
    var from = document.getElementById('bmFrom').value;
    var to   = document.getElementById('bmTo').value;
    var reason = document.getElementById('bmReason').value.trim();
    if (!from || !to) { alert('Please select both from and to dates.'); return; }
    if (from > to) { alert('From date must be before to date.'); return; }
    await DB.createBlockedDate({ id: 'BLK-' + Date.now(), from: from, to: to, reason: reason });
    document.getElementById('bmOverlay').classList.remove('open');
    document.getElementById('bmFrom').value = '';
    document.getElementById('bmTo').value   = '';
    document.getElementById('bmReason').value = '';
    render();
});

// ── Upcoming Stays ────────────────────────────────────────────────────────────
function renderUpcoming(bookings) {
    var todayStr = ymd(today);
    var upcoming = bookings
        .filter(function(b) {
            var ci = b.checkIn || b.checkin || b.check_in || '';
            var st = (b.status||'').toLowerCase();
            return ci >= todayStr && st !== 'cancelled';
        })
        .sort(function(a,b) {
            return (a.checkIn||a.checkin||'').localeCompare(b.checkIn||b.checkin||'');
        })
        .slice(0, 8);

    var list = document.getElementById('upcomingList');
    if (!upcoming.length) {
        list.innerHTML = '<p style="font-size:0.875rem;color:#94a3b8;padding:16px 0;">No upcoming bookings.</p>';
        return;
    }
    var html = '';
    upcoming.forEach(function(b) {
        var ci = parseYMD(b.checkIn || b.checkin || b.check_in);
        var co = parseYMD(b.checkOut || b.checkout || b.check_out);
        var nights = (ci && co) ? nightsBetween(ci, co) : 0;
        var isToday = ci && ymd(ci) === todayStr;
        var mon = ci ? MON_SHORT[ci.getMonth()] : '';
        var day = ci ? ci.getDate() : '';
        html += '<div class="upcoming-item" style="cursor:pointer;" data-booking-id="' + escHtml(b.id||'') + '">';
        html += '<div class="upcoming-datebox' + (isToday?' is-today':'') + '">';
        html += '<span class="ud-d">' + day + '</span>';
        html += '<span class="ud-m">' + mon + '</span>';
        html += '</div>';
        html += '<div class="upcoming-info">';
        html += '<div class="upcoming-name">' + escHtml(b.guestName||b.guest_name||'Guest') + '</div>';
        html += '<div class="upcoming-sub">' + fmtDate(ci) + ' → ' + fmtDate(co) + ' · ' + escHtml(b.guestEmail||b.email||'') + '</div>';
        html += '</div>';
        html += '<span class="upcoming-nights">' + nights + ' night' + (nights===1?'':'s') + '</span>';
        html += '</div>';
    });
    list.innerHTML = html;

    list.querySelectorAll('.upcoming-item[data-booking-id]').forEach(function(el) {
        el.addEventListener('click', function() { openBookingPanel(el.dataset.bookingId); });
    });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
render();
})();
