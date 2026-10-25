    (function () {
        'use strict';
        var list = document.getElementById('feedList');
        var msg = document.getElementById('importMsg');

        function esc(t) { return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

        function ago(iso) {
            if (!iso) return 'never';
            var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
            if (m < 1) return 'just now';
            if (m < 60) return m + ' min ago';
            if (m < 1440) return Math.round(m / 60) + ' h ago';
            return Math.round(m / 1440) + ' d ago';
        }

        function say(text, ok) {
            msg.style.display = text ? 'block' : 'none';
            msg.style.color = ok ? '#15803d' : '#b91c1c';
            msg.textContent = text || '';
        }

        function resultText(r) {
            var t = r.imported + ' reservation' + (r.imported === 1 ? '' : 's') + ' imported';
            if (r.removed) t += ', ' + r.removed + ' no longer on the calendar';
            if (r.warnings && r.warnings.length) t += '. ' + r.warnings.join(' ');
            return t;
        }

        function render(feeds) {
            if (!feeds.length) {
                list.innerHTML = '<p style="color:#64748b;font-size:0.875rem;">No calendars connected yet. Add an iCal link above.</p>';
                return;
            }
            list.innerHTML = feeds.map(function (f) {
                var bad = f.lastStatus === 'error';
                var warn = !bad && f.lastError;
                var cls = bad ? 'error' : (warn ? 'paused' : 'active');
                var dot = bad ? 'red' : (warn ? 'orange' : 'green');
                var label = bad ? 'Sync failed' : (f.lastStatus === 'ok' ? 'Active' : 'Not synced yet');
                return '<div class="ical-connection" data-id="' + esc(f.id) + '">' +
                    '<div class="ical-connection-info">' +
                        '<div class="ical-connection-name">' + esc(f.name) + ' <span style="color:#94a3b8;font-weight:400;font-size:0.8rem;">' + esc(f.urlHint) + '</span></div>' +
                        '<div class="ical-connection-meta">' +
                            '<span class="ical-status ' + cls + '"><span class="status-dot ' + dot + '"></span>' + label + '</span>' +
                            '<span class="ical-last-sync">Last synced: ' + ago(f.lastSynced) + ' · ' + f.lastCount + ' upcoming block' + (f.lastCount === 1 ? '' : 's') + '</span>' +
                        '</div>' +
                        (f.lastError ? '<div style="margin-top:4px;font-size:0.8rem;color:' + (bad ? '#b91c1c' : '#b45309') + ';">' + esc(f.lastError) + '</div>' : '') +
                    '</div>' +
                    '<div class="ical-connection-actions">' +
                        '<button class="btn-action btn-sync" type="button">Sync Now</button>' +
                        '<button class="btn-action btn-remove" type="button">Remove</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        }

        async function load() {
            try { render(await DB.getIcalFeeds()); }
            catch (e) { list.innerHTML = '<p style="color:#b91c1c;font-size:0.875rem;">Could not load calendars: ' + esc(e.message) + '</p>'; }
        }

        document.getElementById('addFeedBtn').addEventListener('click', async function () {
            var btn = this;
            var url = document.getElementById('import-url').value.trim();
            if (!url) { say('Please paste an iCal URL.', false); return; }
            btn.disabled = true; say('Importing…', true);
            try {
                var out = await DB.addIcalFeed({
                    platform: document.getElementById('import-platform').value,
                    name: document.getElementById('import-name').value,
                    url: url
                });
                if (out.result.ok) { say('Connected. ' + resultText(out.result), !(out.result.warnings || []).length); document.getElementById('import-url').value = ''; }
                else say('Calendar saved, but the first import failed: ' + out.result.error, false);
            } catch (e) { say(e.message, false); }
            btn.disabled = false;
            load();
        });

        list.addEventListener('click', async function (e) {
            var row = e.target.closest('.ical-connection');
            if (!row) return;
            var id = row.getAttribute('data-id');
            if (e.target.closest('.btn-sync')) {
                var b = e.target.closest('.btn-sync'); b.disabled = true; b.textContent = 'Syncing…';
                try {
                    var out = await DB.syncIcalFeed(id);
                    var r = out.results[0];
                    say(r.ok ? r.name + ': ' + resultText(r) : r.name + ' failed: ' + r.error, r.ok && !(r.warnings || []).length);
                } catch (err) { say(err.message, false); }
                load();
            } else if (e.target.closest('.btn-remove')) {
                if (!confirm('Remove this calendar? Dates it imported will become bookable again.')) return;
                try { await DB.deleteIcalFeed(id); say('Calendar removed.', true); } catch (err) { say(err.message, false); }
                load();
            }
        });

        load();
    })();
    