  // ── Populate checkout order summary ──────────────────────────────────────
  (function() {
    var p = new URLSearchParams(window.location.search);
    var checkin  = p.get('checkin');
    var checkout = p.get('checkout');
    var guests   = parseInt(p.get('guests')) || 2;
    var nights   = parseInt(p.get('nights')) || 0;

    var DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function fmtDate(str) {
      if (!str) return '—';
      var d = new Date(str + 'T00:00:00');
      return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    }
    function fmtMoney(n) {
      return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
    function setHTML(id, val) { var el = document.getElementById(id); if (el) el.innerHTML = val; }
    function show(id)   { var el = document.getElementById(id); if (el) el.style.display = ''; }
    function hide(id)   { var el = document.getElementById(id); if (el) el.style.display = 'none'; }

    function setAmount(dollars) {
      // Store amount in cents in the hidden form field so Stripe receives the right value
      var el = document.getElementById('bookingAmountCents');
      if (el) el.value = Math.round(dollars * 100);
    }
    // Dates & guests header
    setHTML('coCheckin',  '<strong>Check-in:</strong> '  + fmtDate(checkin));
    setHTML('coCheckout', '<strong>Check-out:</strong> ' + fmtDate(checkout));
    setHTML('coGuests',   '<strong>Guests:</strong> '    + guests + ' Guest' + (guests !== 1 ? 's' : ''));
    if (nights > 0) {
      setText('coNights', nights + ' night' + (nights !== 1 ? 's' : '') + ' · Entire Apartment');
    }

    // ── Try to restore the full booking snapshot saved in booking.html ──────
    var pending = null;
    try { pending = JSON.parse(sessionStorage.getItem('cascade6_pending_booking') || 'null'); } catch(e) {}

    if (pending && pending.checkin === checkin && pending.checkout === checkout) {
      // Use the authoritative figures from booking.html (includes addons)
      var n     = pending.nights;
      var accom = pending.accom;
      var grand = pending.total;

      setText('coLblNightly', fmtMoney(Math.round(accom / n)) + ' avg × ' + n + ' night' + (n !== 1 ? 's' : ''));
      setText('coValNightly', fmtMoney(accom));
      show('coRowNightly');

      // Insert addon rows above the cleaning fee row
      var cleaningRow = document.getElementById('coRowCleaning');
      if (pending.addons && pending.addons.length > 0 && cleaningRow) {
        pending.addons.forEach(function(a) {
          var row = document.createElement('div');
          row.className = 'price-row price-row--addon';
          row.innerHTML = '<span>' + a.label + '</span><span>' + fmtMoney(a.price) + '</span>';
          cleaningRow.parentNode.insertBefore(row, cleaningRow);
        });
      }

      setText('coValCleaning', fmtMoney(pending.cleaning));
      setText('coValService',  fmtMoney(pending.service));
      setText('coValTax',      fmtMoney(pending.tax));
      setText('coValTotal',    fmtMoney(grand));
      ['coRowNightly','coRowCleaning','coRowService','coRowTax','coRowTotal'].forEach(show);
      hide('coNoDates');

      setText('payNowLabel', 'Pay Now — ' + fmtMoney(grand));
      setAmount(grand);

    } else if (checkin && checkout) {
      // Fallback: recalculate base price from dates (no addon data available)
      DB.getRates().then(function(_r) {
        _r = _r || {};
        var PEAK_WKND = _r.peakWeekend  || 800;
        var PEAK_MIDWK= _r.peakMidweek  || 600;
        var SHOULDER  = _r.shoulder     || 465;
        var GREEN     = _r.green        || 200;
        var CLEAN     = _r.cleaningFee  || 60;
        var SVC       = _r.serviceRate || 50;
        var TAX       = 0.10;
        function rate(date) {
          var m = date.getMonth() + 1, d = date.getDate(), dow = date.getDay();
          var isPeak = (m === 6 && d >= 15) || (m >= 7 && m <= 9) || (m === 10 && d <= 1);
          var isShoulder = (m === 5 && d >= 14) || (m === 6 && d <= 14) ||
                           (m === 10 && d >= 2) || (m === 11 && d === 1);
          if (isPeak) return (dow >= 4) ? PEAK_WKND : PEAK_MIDWK;
          if (isShoulder) return SHOULDER;
          return GREEN;
        }

        var ci = new Date(checkin + 'T00:00:00');
        var co = new Date(checkout + 'T00:00:00');
        var n = Math.round((co - ci) / 86400000);
        if (n > 0) {
          var accom = 0, cur = new Date(ci);
          for (var i = 0; i < n; i++) { accom += rate(cur); cur.setDate(cur.getDate() + 1); }
          var svc      = SVC;
          var subtotal = accom + CLEAN + svc;
          var tax      = Math.round(subtotal * TAX);
          var grand    = subtotal + tax;

          setText('coLblNightly',  fmtMoney(Math.round(accom / n)) + ' avg × ' + n + ' night' + (n !== 1 ? 's' : ''));
          setText('coValNightly',  fmtMoney(accom));
          setText('coValCleaning', fmtMoney(CLEAN));
          setText('coValService',  fmtMoney(svc));
          setText('coValTax',      fmtMoney(tax));
          setText('coValTotal',    fmtMoney(grand));
          ['coRowNightly','coRowCleaning','coRowService','coRowTax','coRowTotal'].forEach(show);
          hide('coNoDates');

          setText('payNowLabel', 'Pay Now — ' + fmtMoney(grand));
          setAmount(grand);
        }
      });
    }
  })();
  