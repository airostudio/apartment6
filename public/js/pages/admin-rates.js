    (function() {
        var DEFAULTS = {
            peakWeekend:   800,
            peakMidweek:   600,
            shoulder:      465,
            green:         200,
            cleaningFee:    60,
            serviceRate:    50,
            extraGuestFee:  0
        };

        function populateForm(r) {
            document.getElementById('ratePeakWknd').value  = r.peakWeekend   || DEFAULTS.peakWeekend;
            document.getElementById('ratePeakMidwk').value = r.peakMidweek   || DEFAULTS.peakMidweek;
            document.getElementById('rateShoulder').value  = r.shoulder      || DEFAULTS.shoulder;
            document.getElementById('rateGreen').value     = r.green         || DEFAULTS.green;
            document.getElementById('feeClean').value      = r.cleaningFee   || DEFAULTS.cleaningFee;
            document.getElementById('feeService').value    = r.serviceRate   || DEFAULTS.serviceRate;
            document.getElementById('feeExtraGuest').value = r.extraGuestFee || DEFAULTS.extraGuestFee;
        }

        function showToast() {
            var t = document.getElementById('ratestoast');
            t.style.display = 'block';
            setTimeout(function() { t.style.display = 'none'; }, 3000);
        }

        document.getElementById('saveRatesBtn').addEventListener('click', async function() {
            var r = {
                peakWeekend:   parseInt(document.getElementById('ratePeakWknd').value)  || DEFAULTS.peakWeekend,
                peakMidweek:   parseInt(document.getElementById('ratePeakMidwk').value) || DEFAULTS.peakMidweek,
                shoulder:      parseInt(document.getElementById('rateShoulder').value)  || DEFAULTS.shoulder,
                green:         parseInt(document.getElementById('rateGreen').value)     || DEFAULTS.green,
                cleaningFee:   parseInt(document.getElementById('feeClean').value)      || DEFAULTS.cleaningFee,
                serviceRate:   parseInt(document.getElementById('feeService').value)    || DEFAULTS.serviceRate,
                extraGuestFee: parseInt(document.getElementById('feeExtraGuest').value) || DEFAULTS.extraGuestFee
            };
            await DB.saveRates(r);
            showToast();
        });

        DB.getRates().then(function(r) { populateForm(r || DEFAULTS); });
    })();
    