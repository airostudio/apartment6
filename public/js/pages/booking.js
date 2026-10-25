  // ── Form validation with scroll-to + red border ────────────────────────────
  (function() {
    var REQUIRED = [
      { id: 'firstName',    label: 'First Name' },
      { id: 'lastName',     label: 'Last Name' },
      { id: 'email',        label: 'Email Address' },
      { id: 'phone',        label: 'Phone Number' },
      { id: 'checkinDate',  label: 'Check-in Date' },
      { id: 'checkoutDate', label: 'Check-out Date' }
    ];

    function markError(el) {
      el.style.borderColor  = '#c0392b';
      el.style.boxShadow    = '0 0 0 3px rgba(192,57,43,0.18)';
      el.style.outline      = 'none';
    }
    function clearError(el) {
      el.style.borderColor = '';
      el.style.boxShadow   = '';
    }

    // Wire clear-on-input for each required field
    REQUIRED.forEach(function(f) {
      var el = document.getElementById(f.id);
      if (el) {
        el.addEventListener('input',  function() { clearError(this); });
        el.addEventListener('change', function() { clearError(this); });
        el.addEventListener('focus',  function() { clearError(this); });
      }
    });

    function validateAndSubmit() {
      var firstBad = null;
      REQUIRED.forEach(function(f) {
        var el = document.getElementById(f.id);
        if (!el) return;
        var val = el.value.trim();
        var bad = !val;
        // Extra: basic email check
        if (!bad && f.id === 'email') bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        if (bad) {
          markError(el);
          if (!firstBad) firstBad = el;
        } else {
          clearError(el);
        }
      });

      if (firstBad) {
        firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstBad.focus({ preventScroll: true });
        return false;
      }
      return true;
    }

    // Hook the Continue to Payment button (capture phase fires before onclick)
    var btn = document.getElementById('continueToPayment');
    if (btn) {
      btn.addEventListener('click', function(e) {
        if (!validateAndSubmit()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        // If validation passes, do nothing — let the pricing engine's onclick fire normally
      }, true);
    }
  })();

  // ── Live Pricing Engine ────────────────────────────────────────────────────
  (function() {
    // Load rates from admin localStorage, fall back to defaults
    var _r = (function() {
      try { return JSON.parse(localStorage.getItem('cascade6_rates') || 'null'); } catch(e) { return null; }
    })() || {};
    var RATE_PEAK_WKND = _r.peakWeekend  || 800;  // Peak Thu–Sat (Jun 15–Oct 1)
    var RATE_PEAK_MIDWK= _r.peakMidweek  || 600;  // Peak Sun–Wed (Jun 15–Oct 1)
    var RATE_SHOULDER  = _r.shoulder     || 465;  // May 14–Jun 14, Oct 2–Nov 1
    var RATE_GREEN     = _r.green        || 200;  // All other dates (green/summer)
    var EXTRA_GUEST_FEE= _r.extraGuestFee|| 0;    // No extra guest charge
    var CLEANING_FEE   = _r.cleaningFee  || 60;
    var SERVICE_FEE    = _r.serviceRate  || 50;   // Flat service fee per booking
    var TAX_RATE       = 0.10;

    var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function getNightlyRate(date) {
      var m   = date.getMonth() + 1; // 1–12
      var d   = date.getDate();       // 1–31
      var dow = date.getDay();        // 0=Sun … 6=Sat
      // Peak Winter: Jun 15 – Oct 1
      var isPeak = (m === 6 && d >= 15) || (m >= 7 && m <= 9) || (m === 10 && d <= 1);
      // Shoulder: May 14–Jun 14  and  Oct 2–Nov 1
      var isShoulder = (m === 5 && d >= 14) || (m === 6 && d <= 14) ||
                       (m === 10 && d >= 2) || (m === 11 && d === 1);
      if (isPeak) return (dow >= 4) ? RATE_PEAK_WKND : RATE_PEAK_MIDWK; // Thu/Fri/Sat vs Sun–Wed
      if (isShoulder) return RATE_SHOULDER;
      return RATE_GREEN;
    }

    function calcStay(checkinVal, checkoutVal) {
      if (!checkinVal || !checkoutVal) return null;
      var cin  = new Date(checkinVal  + 'T00:00:00');
      var cout = new Date(checkoutVal + 'T00:00:00');
      var nights = Math.round((cout - cin) / 86400000);
      if (nights <= 0) return null;
      var accom = 0;
      var d = new Date(cin);
      for (var i = 0; i < nights; i++) {
        accom += getNightlyRate(d);
        d.setDate(d.getDate() + 1);
      }
      return { nights: nights, accom: accom, avgRate: Math.round(accom / nights), cin: cin, cout: cout };
    }

    function fmtDate(d) {
      return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    }

    function fmtMoney(n) {
      return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function getAddonsTotal() {
      var total = 0;
      document.querySelectorAll('.addon-option input[type="checkbox"]').forEach(function(cb) {
        if (cb.checked) total += parseFloat(cb.value) || 0;
      });
      return total;
    }

    function getCheckedAddons() {
      var list = [];
      document.querySelectorAll('.addon-option input[type="checkbox"]').forEach(function(cb) {
        if (cb.checked) list.push({ label: cb.getAttribute('data-addon-label'), price: parseFloat(cb.value) || 0 });
      });
      return list;
    }

    // Remove previously injected addon rows
    function clearAddonRows() {
      document.querySelectorAll('.price-row--addon').forEach(function(r) { r.remove(); });
    }

    function show(id) { var el = document.getElementById(id); if (el) el.style.display = ''; }
    function hide(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }
    function text(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

    function updateSummary() {
      var checkinVal  = document.getElementById('checkinDate').value;
      var checkoutVal = document.getElementById('checkoutDate').value;
      var adults      = parseInt(document.getElementById('numAdults').value) || 2;
      var children    = parseInt(document.getElementById('numChildren').value) || 0;
      var stay        = calcStay(checkinVal, checkoutVal);

      // Guests line
      var guestStr = adults + ' Adult' + (adults !== 1 ? 's' : '');
      if (children > 0) guestStr += ', ' + children + ' Child' + (children !== 1 ? 'ren' : '');
      document.getElementById('sumGuests').innerHTML = '<strong>Guests:</strong> ' + guestStr;

      if (!stay) {
        // No valid dates: hide breakdown
        document.getElementById('sumCheckin').innerHTML  = '<strong>Check-in:</strong> —';
        document.getElementById('sumCheckout').innerHTML = '<strong>Check-out:</strong> —';
        text('sumNights', 'Select dates to see nights');
        clearAddonRows();
        ['rowNightly','rowCleaning','rowService','rowTax','rowTotal'].forEach(hide);
        show('noDatesMsg');
        document.getElementById('continueToPayment').disabled = true;
        return;
      }

      // Dates
      document.getElementById('sumCheckin').innerHTML  = '<strong>Check-in:</strong> ' + fmtDate(stay.cin);
      document.getElementById('sumCheckout').innerHTML = '<strong>Check-out:</strong> ' + fmtDate(stay.cout);
      text('sumNights', stay.nights + ' night' + (stay.nights !== 1 ? 's' : '') + ' · Entire Apartment');
      hide('noDatesMsg');

      // Nightly row
      text('lblNightly', fmtMoney(stay.avgRate) + ' avg × ' + stay.nights + ' night' + (stay.nights !== 1 ? 's' : ''));
      text('valNightly', fmtMoney(stay.accom));
      show('rowNightly');

      // Add-on rows (checkbox extras)
      clearAddonRows();
      var addons = getCheckedAddons();
      var addonsTotal = 0;
      var cleaningRow = document.getElementById('rowCleaning');

      // Extra guest fee (auto-calculated for guests beyond 2 pax base rate)
      var extraGuests = Math.max(0, (adults + children) - 2);
      var extraGuestTotal = extraGuests * EXTRA_GUEST_FEE * stay.nights;
      if (extraGuestTotal > 0) {
        var egRow = document.createElement('div');
        egRow.className = 'price-row price-row--addon';
        egRow.innerHTML = '<span>Extra guests (' + extraGuests + ' × ' + stay.nights + ' night' + (stay.nights !== 1 ? 's' : '') + ')</span><span>' + fmtMoney(extraGuestTotal) + '</span>';
        cleaningRow.parentNode.insertBefore(egRow, cleaningRow);
      }

      addons.forEach(function(a) {
        addonsTotal += a.price;
        var row = document.createElement('div');
        row.className = 'price-row price-row--addon';
        row.innerHTML = '<span>' + a.label.charAt(0).toUpperCase() + a.label.slice(1) + '</span><span>' + fmtMoney(a.price) + '</span>';
        cleaningRow.parentNode.insertBefore(row, cleaningRow);
      });

      // Cleaning, service, tax, total
      var serviceFee   = SERVICE_FEE;
      var subtotal     = stay.accom + extraGuestTotal + addonsTotal + CLEANING_FEE + serviceFee;
      var tax          = Math.round(subtotal * TAX_RATE);
      var grand        = subtotal + tax;

      text('valCleaning',    fmtMoney(CLEANING_FEE));
      text('valService',     fmtMoney(serviceFee));
      text('valTax',         fmtMoney(tax));
      text('valTotal',       fmtMoney(grand));
      ['rowCleaning','rowService','rowTax','rowTotal'].forEach(show);

      // Animate total
      var totalEl = document.getElementById('valTotal');
      totalEl.style.transition = 'color 0.3s';
      totalEl.style.color = '#c9a84c';
      setTimeout(function() { totalEl.style.color = ''; }, 600);

      // Enable continue button, pass params
      var btn = document.getElementById('continueToPayment');
      btn.disabled = false;
      btn.onclick = function() {
        btn.disabled = true;
        var origLabel = btn.textContent;
        btn.textContent = 'Checking availability…';
        fetch('/api/availability?checkin=' + encodeURIComponent(checkinVal) + '&checkout=' + encodeURIComponent(checkoutVal))
          .then(function(r) { if (!r.ok) throw new Error('unverified'); return r.json(); })
          .then(function(d) {
            btn.disabled = false; btn.textContent = origLabel;
            if (!d.available) { alert('Sorry, those dates are no longer available. Please choose different dates.'); return; }
            proceed();
          })
          .catch(function() {
            btn.disabled = false; btn.textContent = origLabel;
            alert('We could not check availability right now. Please try again in a moment.');
          });

        function proceed() {
        // Read guest details from the form
        var gFirst = (document.getElementById('firstName').value       || '').trim();
        var gLast  = (document.getElementById('lastName').value        || '').trim();

        // Persist full booking data so checkout & confirmation show the right details
        var bookingSnapshot = {
          checkin:         checkinVal,
          checkout:        checkoutVal,
          guests:          adults + children,
          nights:          stay.nights,
          accom:           stay.accom,
          extraGuestTotal: extraGuestTotal,
          addons:          getCheckedAddons(),
          cleaning:        CLEANING_FEE,
          service:         serviceFee,
          tax:             tax,
          total:           grand,
          // Guest details
          guestFirst:      gFirst,
          guestLast:       gLast,
          guestName:       (gFirst + ' ' + gLast).trim() || 'Guest',
          email:           (document.getElementById('email').value            || '').trim(),
          phone:           (document.getElementById('phone').value            || '').trim(),
          specialRequests: (document.getElementById('specialRequests').value  || '').trim()
        };
        try { sessionStorage.setItem('cascade6_pending_booking', JSON.stringify(bookingSnapshot)); } catch(e) {}

        var p = new URLSearchParams({
          checkin:  checkinVal,
          checkout: checkoutVal,
          guests:   adults + children,
          nights:   stay.nights,
          total:    grand.toFixed(2)
        });
        window.location.href = 'checkout.html?' + p.toString();
        }
      };
    }

    // Pre-fill from URL params
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('checkin'))  document.getElementById('checkinDate').value  = urlParams.get('checkin');
    if (urlParams.get('checkout')) document.getElementById('checkoutDate').value = urlParams.get('checkout');
    if (urlParams.get('guests')) {
      var g = parseInt(urlParams.get('guests'));
      if (g >= 1 && g <= 8) document.getElementById('numAdults').value = g;
    }

    // Set minimum check-in to today
    var today = localISODate(new Date());
    document.getElementById('checkinDate').min  = today;
    document.getElementById('checkoutDate').min = today;

    // Enforce check-out after check-in
    document.getElementById('checkinDate').addEventListener('change', function() {
      var cout = document.getElementById('checkoutDate');
      if (cout.value && cout.value <= this.value) cout.value = '';
      cout.min = this.value;
      updateSummary();
    });

    // Cap children so adults + children never exceed 6
    function capChildren() {
      var adults   = parseInt(document.getElementById('numAdults').value) || 1;
      var maxKids  = Math.max(0, 8 - adults);
      var childSel = document.getElementById('numChildren');
      var cur      = parseInt(childSel.value) || 0;
      Array.from(childSel.options).forEach(function(opt) {
        opt.disabled = parseInt(opt.value) > maxKids;
      });
      if (cur > maxKids) { childSel.value = maxKids; }
    }
    document.getElementById('numAdults').addEventListener('change', function() { capChildren(); updateSummary(); });
    capChildren();

    // Wire all change events
    ['checkinDate','checkoutDate','numChildren'].forEach(function(id) {
      document.getElementById(id).addEventListener('change', updateSummary);
    });
    document.querySelectorAll('.addon-option input[type="checkbox"]').forEach(function(cb) {
      cb.addEventListener('change', updateSummary);
    });

    // Highlight selected addon row
    document.querySelectorAll('.addon-option').forEach(function(opt) {
      var cb = opt.querySelector('input[type="checkbox"]');
      function syncStyle() { opt.style.borderColor = cb.checked ? '#0f2744' : ''; opt.style.background = cb.checked ? 'rgba(15,39,68,0.04)' : ''; }
      cb.addEventListener('change', syncStyle);
      syncStyle();
    });

    // Initial render
    updateSummary();
  })();
  