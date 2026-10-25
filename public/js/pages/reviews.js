    // ── Season filter pills ─────────────────────────────────────────
    var pills = document.querySelectorAll('.filter-pill');
    var cards = document.querySelectorAll('.review-card[data-season]');

    pills.forEach(function(pill) {
      pill.addEventListener('click', function() {
        pills.forEach(function(p) { p.classList.remove('active'); });
        pill.classList.add('active');

        var filter = pill.getAttribute('data-filter');
        cards.forEach(function(card) {
          if (filter === 'all' || card.getAttribute('data-season') === filter) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });

        // Update count heading
        var visible = filter === 'all' ? 47 :
                      filter === 'winter' ? 31 :
                      filter === 'autumn' ? 9 : 7;
        document.querySelector('.filters-bar h2').textContent = visible + ' Reviews';
      });
    });
  