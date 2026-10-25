    (function() {
      var GALLERY = [
        { src: '/public/cascade6-1.jpg', alt: 'Living area with gas log fire' },
        { src: '/public/cascade6-2.jpg', alt: 'Lounge and dining area' },
        { src: '/public/cascade6-3.jpg', alt: 'Bedroom with queen bed' },
        { src: '/public/cascade6-4.jpg', alt: 'Fully equipped kitchen' },
        { src: '/public/cascade6-5.jpg', alt: 'Bathroom' },
        { src: '/public/cascade6-6.jpg', alt: 'Bunk beds' },
        { src: '/public/cascade6-7.jpg', alt: 'Dining area' },
        { src: '/public/cascade6-8.jpg', alt: 'Mt Baw Baw Alpine Resort exterior' }
      ];

      var lightbox  = document.getElementById('homeLightbox');
      var lbImg     = document.getElementById('homeLbImg');
      var lbCounter = document.getElementById('homeLbCounter');
      var lbThumbs  = document.getElementById('homeLbThumbs');
      var currentIdx = 0;

      GALLERY.forEach(function(photo, i) {
        var btn = document.createElement('button');
        btn.className = 'lightbox-thumb' + (i === 0 ? ' active' : '');
        btn.setAttribute('aria-label', 'View photo ' + (i + 1));
        var img = document.createElement('img');
        img.src = photo.src; img.alt = photo.alt;
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

      document.querySelectorAll('#homeGalleryGrid .gallery-grid-item').forEach(function(item) {
        item.addEventListener('click', function() {
          openLightbox(parseInt(item.getAttribute('data-gallery-index')) || 0);
        });
        item.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') openLightbox(parseInt(item.getAttribute('data-gallery-index')) || 0);
        });
      });

      document.getElementById('homeLbClose').addEventListener('click', closeLightbox);
      document.getElementById('homeLbPrev').addEventListener('click', function() { goTo(currentIdx - 1); });
      document.getElementById('homeLbNext').addEventListener('click', function() { goTo(currentIdx + 1); });

      lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) closeLightbox();
      });

      document.addEventListener('keydown', function(e) {
        if (!lightbox.classList.contains('open')) return;
        if (e.key === 'Escape')     closeLightbox();
        if (e.key === 'ArrowLeft')  goTo(currentIdx - 1);
        if (e.key === 'ArrowRight') goTo(currentIdx + 1);
      });

      var touchStartX = 0;
      lightbox.addEventListener('touchstart', function(e) { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
      lightbox.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 50) dx < 0 ? goTo(currentIdx + 1) : goTo(currentIdx - 1);
      }, { passive: true });
    })();
  