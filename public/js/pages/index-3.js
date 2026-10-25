  // Pre-select "Group Booking Enquiry" subject when arriving via group callout button
  (function() {
    document.querySelectorAll('a[href="#contact"]').forEach(function(a) {
      if (a.textContent.trim().toLowerCase().indexOf('group') !== -1) {
        a.addEventListener('click', function() {
          setTimeout(function() {
            var sel = document.getElementById('contactSubject');
            if (sel) sel.value = 'Group Booking Enquiry';
          }, 400);
        });
      }
    });
  })();

  // Contact form → /api/contact
  (function() {
    var form    = document.getElementById('contactForm');
    var success = document.getElementById('contactSuccess');
    var error   = document.getElementById('contactError');
    var errMsg  = document.getElementById('contactErrorMsg');
    var btn     = document.getElementById('contactSubmitBtn');
    if (!form) return;

    // Focus styles
    form.querySelectorAll('input, textarea, select').forEach(function(el) {
      el.addEventListener('focus',  function() { this.style.borderColor = '#0f2744'; this.style.background = '#fff'; });
      el.addEventListener('blur',   function() { this.style.borderColor = '#e2e8f0'; this.style.background = '#f8fafc'; });
    });

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      success.style.display = 'none';
      error.style.display   = 'none';
      btn.disabled          = true;
      btn.textContent       = 'Sending…';

      var payload = {
        name:    document.getElementById('contactName').value.trim(),
        email:   document.getElementById('contactEmail').value.trim(),
        phone:   document.getElementById('contactPhone').value.trim(),
        subject: document.getElementById('contactSubject').value.trim(),
        message: document.getElementById('contactMessage').value.trim(),
      };

      try {
        var res  = await fetch('/api/contact', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        var data = await res.json();
        if (res.ok && data.ok) {
          success.style.display = 'block';
          form.reset();
        } else {
          errMsg.textContent    = data.error || 'Something went wrong. Please try again.';
          error.style.display   = 'block';
        }
      } catch (err) {
        errMsg.textContent  = 'Network error. Please try again or email hello@cascade6.online directly.';
        error.style.display = 'block';
      } finally {
        btn.disabled    = false;
        btn.textContent = 'Send Message';
      }
    });
  })();
  