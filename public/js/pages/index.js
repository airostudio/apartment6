    // Set min dates
    (function() {
      var today = localISODate(new Date());
      var ci = document.getElementById('searchCheckin');
      var co = document.getElementById('searchCheckout');
      ci.min = today;
      co.min = today;
      ci.addEventListener('change', function() {
        if (co.value && co.value <= this.value) co.value = '';
        co.min = this.value;
      });
    })();

    // Pre-fill search bar from saved session (e.g. coming back from property page)
    (function() {
      try {
        var saved = JSON.parse(sessionStorage.getItem('cascade6_search') || 'null');
        if (saved) {
          if (saved.checkin)  document.getElementById('searchCheckin').value  = saved.checkin;
          if (saved.checkout) document.getElementById('searchCheckout').value = saved.checkout;
          if (saved.guests)   document.getElementById('searchGuests').value   = saved.guests;
        }
      } catch(e) {}
    })();

    // Hero search — check availability then navigate
    document.getElementById('heroSearchBtn').addEventListener('click', function() {
      var checkin  = document.getElementById('searchCheckin').value;
      var checkout = document.getElementById('searchCheckout').value;
      var guests   = document.getElementById('searchGuests').value;

      // Remove any previous result banner
      var old = document.getElementById('availResult');
      if (old) old.remove();

      if (!checkin || !checkout) {
        showAvailResult('error', 'Please select both a check-in and check-out date.');
        return;
      }
      if (checkout <= checkin) {
        showAvailResult('error', 'Check-out must be after check-in.');
        return;
      }

      // Persist search so other pages (booking, property) can pre-fill
      try {
        sessionStorage.setItem('cascade6_search', JSON.stringify({ checkin: checkin, checkout: checkout, guests: guests }));
      } catch(e) {}

      // Check live availability (bookings + blocked dates) on the server
      var nights = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
      var bookHref = 'booking.html?' + new URLSearchParams({ checkin: checkin, checkout: checkout, guests: guests }).toString();
      fetch('/api/availability?checkin=' + encodeURIComponent(checkin) + '&checkout=' + encodeURIComponent(checkout))
        .then(function(r) { if (!r.ok) throw new Error('unverified'); return r.json(); })
        .then(function(d) {
          var stale = document.getElementById('availResult'); if (stale) stale.remove();
          if (!d.available) { showAvailResult('error', 'Sorry, those dates are not available. Please try different dates.'); return; }
          showAvailSuccess(nights, bookHref);
        })
        .catch(function() {
          showAvailResult('error', 'We could not check availability right now. Please try again in a moment.');
        });
    });

    function showAvailResult(type, msg) {
      var bar = document.createElement('div');
      bar.id = 'availResult';
      bar.style.cssText = 'margin-top:12px;padding:12px 18px;border-radius:8px;font-size:0.9rem;font-weight:500;text-align:center;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;';
      bar.innerHTML = msg;
      document.getElementById('mainSearchBar').after(bar);
    }

    function showAvailSuccess(nights, href) {
      var bar = document.createElement('div');
      bar.id = 'availResult';
      bar.style.cssText = 'margin-top:14px;padding:16px 20px;border-radius:12px;background:#ecfdf5;border:1px solid #6ee7b7;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;';
      bar.innerHTML =
        '<span style="color:#065f46;font-weight:600;font-size:0.9375rem;display:flex;align-items:center;gap:9px;">'
          + '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
          + 'Available for <strong style="margin-left:3px;">' + nights + '&nbsp;night' + (nights !== 1 ? 's' : '') + '</strong>'
        + '</span>'
        + '<a href="' + href + '" '
          + 'style="display:inline-flex;align-items:center;gap:7px;padding:11px 24px;background:#0f2744;color:#fff;border-radius:8px;font-size:0.9rem;font-weight:700;text-decoration:none;letter-spacing:0.01em;white-space:nowrap;"'
          + ' onmouseover="this.style.background=\'#1a3a5c\'" onmouseout="this.style.background=\'#0f2744\'">'
          + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
          + 'Book Now'
          + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
        + '</a>';
      document.getElementById('mainSearchBar').after(bar);
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function(a) {
      a.addEventListener('click', function(e) {
        var id = this.getAttribute('href').slice(1);
        var el = document.getElementById(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  