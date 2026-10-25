    // ── Tab switching ──────────────────────────────────────────────
    document.querySelectorAll('.property-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.property-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('tab-' + tab.getAttribute('data-tab')).classList.add('active');
      });
    });

    // ── URL param pre-fill ─────────────────────────────────────────
    var params = new URLSearchParams(window.location.search);
    if (params.get('checkin')) document.getElementById('checkin').value = params.get('checkin');
    if (params.get('checkout')) document.getElementById('checkout').value = params.get('checkout');
    if (params.get('guests')) {
      var sel = document.getElementById('guests');
      var g = parseInt(params.get('guests'));
      if (g >= 1 && g <= 8) sel.selectedIndex = g - 1;
    }

    // ── Book button ────────────────────────────────────────────────
    function updateBookBtn() {
      var checkin  = document.getElementById('checkin').value;
      var checkout = document.getElementById('checkout').value;
      var btn  = document.getElementById('bookNowBtn');
      var note = document.getElementById('bookingNote');
      var ar   = document.getElementById('propAvailResult');
      // Reset any previous availability result when dates change
      if (ar) { ar.style.display = 'none'; ar.innerHTML = ''; }
      var err = document.getElementById('bookingError');
      if (err) err.style.display = 'none';
      if (checkin && checkout) {
        btn.textContent = 'Check Availability';
        btn.style.background = '#c9a84c';
        note.textContent = 'Click to check if these dates are free';
      } else {
        btn.textContent = 'Check Availability';
        btn.style.background = '';
        note.textContent = 'Select dates to see pricing';
      }
    }
    ['checkin','checkout','guests'].forEach(function(id) {
      document.getElementById(id).addEventListener('change', updateBookBtn);
    });
    updateBookBtn();

    document.getElementById('bookNowBtn').addEventListener('click', function() {
      var checkin   = document.getElementById('checkin').value;
      var checkout  = document.getElementById('checkout').value;
      var guestsRaw = document.getElementById('guests').value;
      var err = document.getElementById('bookingError');
      var ar  = document.getElementById('propAvailResult');

      // Validate dates
      if (!checkin || !checkout) {
        err.textContent = !checkin ? 'Please select a check-in date.' : 'Please select a check-out date.';
        err.style.display = 'block';
        ar.style.display = 'none';
        setTimeout(function() { err.style.display = 'none'; }, 4000);
        document.getElementById(!checkin ? 'checkin' : 'checkout').focus();
        return;
      }
      if (checkout <= checkin) {
        err.textContent = 'Check-out date must be after check-in date.';
        err.style.display = 'block';
        ar.style.display = 'none';
        setTimeout(function() { err.style.display = 'none'; }, 4000);
        return;
      }
      err.style.display = 'none';

      // Check live availability (bookings + blocked dates) on the server
      fetch('/api/availability?checkin=' + encodeURIComponent(checkin) + '&checkout=' + encodeURIComponent(checkout))
        .then(function(r) { if (!r.ok) throw new Error('unverified'); return r.json(); })
        .then(function(d) {
          if (!d.available) {
            err.textContent = 'Sorry, those dates are not available. Please try different dates.';
            err.style.display = 'block';
            ar.style.display = 'none';
            ar.innerHTML = '';
            setTimeout(function() { err.style.display = 'none'; }, 6000);
            return;
          }
          showAvailable();
        })
        .catch(function() {
          err.textContent = 'We could not check availability right now. Please try again in a moment.';
          err.style.display = 'block';
          ar.style.display = 'none';
          setTimeout(function() { err.style.display = 'none'; }, 6000);
        });

      function showAvailable() {
      // Dates are available — show result + Book Now button
      var nights = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
      var guests = parseInt(guestsRaw) || 2;
      var bookHref = 'booking.html?' + new URLSearchParams({ checkin: checkin, checkout: checkout, guests: guests }).toString();

      ar.style.display = 'block';
      ar.innerHTML =
        '<div style="margin-top:10px;padding:14px 16px;border-radius:10px;background:#ecfdf5;border:1px solid #6ee7b7;">'
          + '<div style="color:#065f46;font-weight:600;font-size:0.875rem;display:flex;align-items:center;gap:7px;margin-bottom:11px;">'
            + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
            + 'Available for ' + nights + ' night' + (nights !== 1 ? 's' : '') + '!'
          + '</div>'
          + '<a href="' + bookHref + '" '
            + 'style="display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;background:#0f2744;color:#fff;border-radius:8px;font-size:0.9rem;font-weight:700;text-decoration:none;box-sizing:border-box;width:100%;"'
            + ' onmouseover="this.style.background=\'#1a3a5c\'" onmouseout="this.style.background=\'#0f2744\'">'
            + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
            + 'Book Now'
            + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
          + '</a>'
        + '</div>';
      }
    });

    // ── Photo Gallery Lightbox ─────────────────────────────────────
    var GALLERY = [
      { src: '/public/cascade6-1.jpg', alt: 'Living area with gas log fire' },
      { src: '/public/cascade6-2.jpg', alt: 'Lounge and dining area' },
      { src: '/public/cascade6-3.jpg', alt: 'Bedroom with queen bed and bunk beds' },
      { src: '/public/cascade6-4.jpg', alt: 'Fully equipped kitchen' },
      { src: '/public/cascade6-5.jpg', alt: 'Bathroom with shower and bath base' },
      { src: '/public/cascade6-6.jpg', alt: 'Bunk beds — sleeps up to 2 extra guests' },
      { src: '/public/cascade6-7.jpg', alt: 'Dining table and living space' },
      { src: '/public/cascade6-8.jpg', alt: 'Mt Baw Baw Alpine Resort exterior' }
    ];

    var lightbox   = document.getElementById('lightbox');
    var lbImg      = document.getElementById('lightboxImg');
    var lbCounter  = document.getElementById('lightboxCounter');
    var lbThumbs   = document.getElementById('lightboxThumbs');
    var currentIdx = 0;

    // Build thumbnails once
    GALLERY.forEach(function(photo, i) {
      var btn = document.createElement('button');
      btn.className = 'lightbox-thumb' + (i === 0 ? ' active' : '');
      btn.setAttribute('aria-label', 'View photo ' + (i + 1));
      var img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.alt;
      img.loading = 'lazy';
      btn.appendChild(img);
      btn.addEventListener('click', function() { goTo(i); });
      lbThumbs.appendChild(btn);
    });

    function goTo(idx) {
      currentIdx = (idx + GALLERY.length) % GALLERY.length;
      lbImg.classList.add('fade');
      setTimeout(function() {
        lbImg.src = GALLERY[currentIdx].src;
        lbImg.alt = GALLERY[currentIdx].alt;
        lbCounter.textContent = (currentIdx + 1) + ' / ' + GALLERY.length;
        lbImg.classList.remove('fade');
      }, 120);
      lbThumbs.querySelectorAll('.lightbox-thumb').forEach(function(t, i) {
        t.classList.toggle('active', i === currentIdx);
      });
      // scroll active thumb into view
      var activeThumb = lbThumbs.querySelectorAll('.lightbox-thumb')[currentIdx];
      if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    function openLightbox(idx) {
      currentIdx = idx;
      lbImg.src = GALLERY[currentIdx].src;
      lbImg.alt = GALLERY[currentIdx].alt;
      lbCounter.textContent = (currentIdx + 1) + ' / ' + GALLERY.length;
      lbThumbs.querySelectorAll('.lightbox-thumb').forEach(function(t, i) {
        t.classList.toggle('active', i === currentIdx);
      });
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    // Gallery grid clicks
    document.querySelectorAll('#galleryGrid .gallery-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.closest('#showAllPhotos')) return; // handled separately
        openLightbox(parseInt(item.getAttribute('data-gallery-index')) || 0);
      });
      item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') openLightbox(parseInt(item.getAttribute('data-gallery-index')) || 0);
      });
    });

    document.getElementById('showAllPhotos').addEventListener('click', function(e) {
      e.stopPropagation();
      openLightbox(0);
    });

    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', function() { goTo(currentIdx - 1); });
    document.getElementById('lightboxNext').addEventListener('click', function() { goTo(currentIdx + 1); });

    // Close on backdrop click
    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox) closeLightbox();
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape')      closeLightbox();
      if (e.key === 'ArrowLeft')   goTo(currentIdx - 1);
      if (e.key === 'ArrowRight')  goTo(currentIdx + 1);
    });

    // Touch swipe support
    var touchStartX = 0;
    lightbox.addEventListener('touchstart', function(e) { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) dx < 0 ? goTo(currentIdx + 1) : goTo(currentIdx - 1);
    }, { passive: true });

    // ── Rates from localStorage + live sidebar pricing ─────────────
    (function() {
      var _r = (function() {
        try { return JSON.parse(localStorage.getItem('cascade6_rates') || 'null'); } catch(e) { return null; }
      })() || {};
      var PEAK_WKND = _r.peakWeekend  || 800;
      var PEAK_MIDWK= _r.peakMidweek  || 600;
      var SHOULDER  = _r.shoulder     || 465;
      var GREEN     = _r.green        || 200;
      var CLEAN     = _r.cleaningFee  || 60;
      var SVC_FEE   = _r.serviceRate || 50;

      // Update rates tab display
      function setPriceEl(id, val) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '$' + val + ' <span>/ night</span>';
      }
      setPriceEl('dispPeakWknd',  PEAK_WKND);
      setPriceEl('dispPeakMidwk', PEAK_MIDWK);
      setPriceEl('dispShoulder',  SHOULDER);
      setPriceEl('dispGreen',     GREEN);

      // Update "From" label in sidebar to lowest rate
      var fromEl = document.getElementById('sidebarFromPrice');
      if (fromEl) fromEl.textContent = 'From $' + GREEN;

      function getNightlyRate(date) {
        var m   = date.getMonth() + 1;
        var d   = date.getDate();
        var dow = date.getDay(); // 0=Sun…6=Sat
        var isPeak = (m === 6 && d >= 15) || (m >= 7 && m <= 9) || (m === 10 && d <= 1);
        var isShoulder = (m === 5 && d >= 14) || (m === 6 && d <= 14) ||
                         (m === 10 && d >= 2) || (m === 11 && d === 1);
        if (isPeak) return (dow >= 4) ? PEAK_WKND : PEAK_MIDWK;
        if (isShoulder) return SHOULDER;
        return GREEN;
      }

      function updateSidebarPrice() {
        var checkinVal  = document.getElementById('checkin').value;
        var checkoutVal = document.getElementById('checkout').value;
        var bd = document.getElementById('priceBreakdown');
        if (!checkinVal || !checkoutVal) { bd.style.display = 'none'; return; }
        var ci = new Date(checkinVal + 'T00:00:00');
        var co = new Date(checkoutVal + 'T00:00:00');
        if (co <= ci) { bd.style.display = 'none'; return; }

        var nights = 0, accom = 0;
        var cur = new Date(ci);
        while (cur < co) {
          accom += getNightlyRate(cur);
          nights++;
          cur.setDate(cur.getDate() + 1);
        }
        var svc   = SVC_FEE;
        var total = accom + CLEAN + svc;

        document.getElementById('sbNightsLabel').textContent = '$' + Math.round(accom / nights) + ' avg x ' + nights + ' night' + (nights !== 1 ? 's' : '');
        document.getElementById('sbAccomTotal').textContent  = '$' + accom;
        document.getElementById('sbCleanFee').textContent    = '$' + CLEAN;
        document.getElementById('sbServiceFee').textContent  = '$' + svc;
        document.getElementById('sbTotal').textContent       = '$' + total;
        bd.style.display = 'block';
      }

      document.getElementById('checkin').addEventListener('change', function() {
        var co = document.getElementById('checkout');
        if (co.value && co.value <= this.value) co.value = '';
        co.min = this.value;
        updateSidebarPrice();
        updateBookBtn();
      });
      document.getElementById('checkout').addEventListener('change', function() {
        updateSidebarPrice();
        updateBookBtn();
      });
      document.getElementById('guests').addEventListener('change', updateSidebarPrice);

      // Pre-fill from URL and run initial price update
      var today = localISODate(new Date());
      document.getElementById('checkin').min  = today;
      document.getElementById('checkout').min = today;
      updateSidebarPrice();
    })();
  