  // ── Populate confirmation page from sessionStorage ──────────────────────
  (function() {
    var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    function fmtDate(str) {
      if (!str) return '—';
      var d = new Date(str + 'T00:00:00');
      return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    }
    function fmtMoney(n) {
      return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

    // Read from URL param first (ref), then sessionStorage for full details
    var params = new URLSearchParams(window.location.search);
    var urlRef = params.get('ref') || '';

    var bk = null;
    try { bk = JSON.parse(sessionStorage.getItem('cascade6_confirmed_booking') || 'null'); } catch(e) {}

    if (bk) {
      var ref = bk.ref || urlRef || 'TRA-' + new Date().getFullYear() + '-00001';
      set('confRef',        ref);
      set('confRef2',       ref);
      set('confGuestName',  bk.name || '—');
      set('confCheckin',    fmtDate(bk.checkin));
      set('confCheckout',   fmtDate(bk.checkout));
      set('confNights',     (bk.nights || 1) + ' night' + (bk.nights !== 1 ? 's' : ''));
      set('confGuests',     (bk.guests || 2) + ' Guest' + (bk.guests !== 1 ? 's' : ''));
      set('confTotal',      fmtMoney(bk.total || 0));

      if (bk.email) {
        var noteEl = document.getElementById('confEmailNote');
        if (noteEl) noteEl.textContent = 'A confirmation email has been sent to ' + bk.email + '.';
      }

      // Addons & extras
      var extraLines = [];
      if (bk.extraGuestTotal > 0) extraLines.push('Extra guests — ' + fmtMoney(bk.extraGuestTotal));
      if (bk.addons && bk.addons.length > 0) {
        bk.addons.forEach(function(a) { extraLines.push(a.label + ' — ' + fmtMoney(a.price)); });
      }
      if (extraLines.length > 0) {
        set('confAddons', extraLines.join('\n'));
        var row = document.getElementById('confAddonsRow');
        if (row) { row.style.display = ''; document.getElementById('confAddons').style.whiteSpace = 'pre-line'; }
      }

      // Special requests
      if (bk.specialRequests) {
        set('confNotes', bk.specialRequests);
        var nr = document.getElementById('confNotesRow');
        if (nr) nr.style.display = '';
      }
    } else if (urlRef) {
      // Fallback: at least show the reference from URL
      set('confRef',  urlRef);
      set('confRef2', urlRef);
    }
  })();
  