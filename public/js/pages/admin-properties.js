(function() {
    'use strict';

    // Known property photos in /public/
    var PHOTOS = [
        'IMG_0370.jpg','IMG_0374.jpg','IMG_0375.jpg','IMG_0376.jpg','IMG_0377.jpg',
        'IMG_3097.jpg','IMG_3098.jpg',
        'IMG_9081.jpg','IMG_9082.jpg','IMG_9083.jpg','IMG_9084.jpg','IMG_9085.jpg',
        'IMG_9107.jpg','IMG_9108.jpg','IMG_9109.jpg','IMG_9110.jpg','IMG_9111.jpg'
    ];

    // Render photo thumbnails
    var grid = document.getElementById('imgGrid');
    if (grid) {
        grid.innerHTML = PHOTOS.map(function(f) {
            return '<div class="img-thumb">' +
                '<img src="../public/' + f + '" alt="' + f + '" loading="lazy">' +
                '<div class="img-thumb-label">' + f + '</div>' +
            '</div>';
        }).join('');
    }

    // Fields to persist
    var FIELDS = [
        'propName','propStatus','propTagline','propDesc',
        'propAddress','propCity','propState','propPostcode',
        'propMaxGuests','propBedrooms','propBathrooms','propBeds','propSize','propFloor',
        'propCheckin','propCheckout','propMinStay','propMaxStay',
        'propCancellation','propDeposit','propPets','propSmoking','propHouseRules',
        'propEmail','propPhone'
    ];

    function collectSettings() {
        var data = {};
        FIELDS.forEach(function(id) {
            var el = document.getElementById(id);
            if (el) data[id] = el.value;
        });
        data.amenities = [];
        document.querySelectorAll('.amenity-cb input[type="checkbox"]').forEach(function(cb) {
            if (cb.checked) data.amenities.push(cb.parentElement.textContent.trim());
        });
        return data;
    }

    function applySettings(data) {
        if (!data || !Object.keys(data).length) return;
        FIELDS.forEach(function(id) {
            if (data[id] === undefined) return;
            var el = document.getElementById(id);
            if (el) el.value = data[id];
        });
        if (Array.isArray(data.amenities)) {
            document.querySelectorAll('.amenity-cb input[type="checkbox"]').forEach(function(cb) {
                var label = cb.parentElement.textContent.trim();
                cb.checked = data.amenities.includes(label);
            });
        }
    }

    function showToastMsg() {
        var toast = document.getElementById('saveToast');
        if (toast) {
            toast.style.display = 'block';
            setTimeout(function(){ toast.style.display = 'none'; }, 2500);
        }
    }

    function saveSettings() {
        var data = collectSettings();
        DB.savePropertySettings(data).then(function() {
            showToastMsg();
        }).catch(function(err) {
            alert('Save failed: ' + err.message);
        });
    }

    function loadDefaults() {
        if (!confirm('Reset all property settings to defaults?')) return;
        DB.savePropertySettings({}).then(function() { location.reload(); });
    }

    window.saveSettings = saveSettings;
    window.loadDefaults = loadDefaults;

    // Load from DB on page open
    DB.getPropertySettings().then(applySettings);
})();
