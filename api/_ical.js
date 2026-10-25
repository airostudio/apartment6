// iCal (RFC 5545) import: parse external calendar feeds (Airbnb, Booking.com,
// VRBO, Google...) and mirror them into blocked_dates so the existing
// availability checks keep those nights from being sold twice.
//
// Imported nights are stored in blocked_dates with ids 'ICAL-<feedId>-<hash>'.
// blocked_dates.to_date is INCLUSIVE (matches the admin calendar), whereas an
// iCal DTEND is exclusive, so to_date = DTEND - 1 day.

const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');

const PROPERTY_TZ = 'Australia/Melbourne';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// ── Date helpers (string based; no local/UTC drift) ─────────────────────────
function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayInPropertyTz() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PROPERTY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function utcStampToPropertyDate(y, mo, d, h, mi, s) {
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return new Intl.DateTimeFormat('en-CA', { timeZone: PROPERTY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
}

// Accepts 'YYYYMMDD', 'YYYYMMDDTHHMMSS' and 'YYYYMMDDTHHMMSSZ'. Returns 'YYYY-MM-DD' or ''.
function parseIcalDate(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec((value || '').trim());
  if (!m) return '';
  if (m[7]) return utcStampToPropertyDate(m[1], m[2], m[3], m[4], m[5], m[6]);
  return m[1] + '-' + m[2] + '-' + m[3];
}

// ── Parser ──────────────────────────────────────────────────────────────────
// Returns { events: [{uid, from, to, summary}], skippedRecurring, skippedCancelled }
// where from/to are 'YYYY-MM-DD' and the nights blocked are [from, to] inclusive.
function parseIcal(text) {
  if (!/BEGIN:VCALENDAR/i.test(text || '')) throw new Error('Not an iCal calendar (no VCALENDAR found).');

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let skippedRecurring = 0;
  let skippedCancelled = 0;
  let cur = null;

  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line)) {
      if (cur) finishEvent(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const parts = head.split(';');
    const name = parts[0].toUpperCase();
    if (name === 'DTSTART' || name === 'DTEND') {
      cur[name] = { value, dateOnly: parts.some(function (p) { return /^VALUE=DATE$/i.test(p); }) || /^\d{8}$/.test(value.trim()) };
    } else if (name === 'DURATION' || name === 'UID' || name === 'SUMMARY' || name === 'STATUS' || name === 'TRANSP' || name === 'RRULE') {
      cur[name] = value;
    }
  }

  function finishEvent(e) {
    if (/^CANCELLED$/i.test(e.STATUS || '')) { skippedCancelled++; return; }
    if (/^TRANSPARENT$/i.test(e.TRANSP || '')) return; // "free" time, not a reservation
    if (e.RRULE) { skippedRecurring++; return; }
    if (!e.DTSTART) return;
    const from = parseIcalDate(e.DTSTART.value);
    if (!from) return;
    let endExclusive = e.DTEND ? parseIcalDate(e.DTEND.value) : '';
    if (!endExclusive) {
      const dur = /^P(?:(\d+)W)?(?:(\d+)D)?/i.exec(e.DURATION || '');
      const days = dur ? (Number(dur[1] || 0) * 7 + Number(dur[2] || 0)) : 0;
      endExclusive = addDays(from, days > 0 ? days : 1);
    }
    if (endExclusive <= from) endExclusive = addDays(from, 1); // always block at least the start night
    events.push({
      uid: e.UID || (from + '_' + endExclusive),
      from,
      to: addDays(endExclusive, -1),
      summary: e.SUMMARY || '',
    });
  }

  return { events, skippedRecurring, skippedCancelled };
}

// ── Safe fetching (admin supplied URLs, so guard against SSRF) ──────────────
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::' || l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb') || /^f[cd]/.test(l)) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  return true;
}

function normaliseFeedUrl(raw) {
  let u = String(raw || '').trim().replace(/^webcal:\/\//i, 'https://');
  let parsed;
  try { parsed = new URL(u); } catch (_) { throw new Error('Please enter a valid URL.'); }
  if (parsed.protocol !== 'https:') throw new Error('Calendar URL must use https:// (or webcal://).');
  if (parsed.username || parsed.password) throw new Error('Calendar URL must not contain a username or password.');
  return parsed.toString();
}

async function assertPublicHost(urlStr) {
  const host = new URL(urlStr).hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) throw new Error('That address is not allowed.');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('That address is not allowed.');
    return;
  }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(function (a) { return isPrivateIp(a.address); })) throw new Error('That address is not allowed.');
}

async function fetchFeedText(rawUrl, timeoutMs) {
  let url = normaliseFeedUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, timeoutMs || 8000);
    let res;
    try {
      res = await fetch(url, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'CascadeApartment6-iCalSync/1.0', Accept: 'text/calendar, */*' } });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = normaliseFeedUrl(new URL(res.headers.get('location'), url).toString());
        continue;
      }
      if (!res.ok) throw new Error('Calendar provider returned HTTP ' + res.status + '.');
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) { ctl.abort(); throw new Error('Calendar file is too large.'); }
        chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks).toString('utf8');
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Calendar provider timed out.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Too many redirects.');
}

// ── Sync ────────────────────────────────────────────────────────────────────
function blockId(feedId, ev) {
  return 'ICAL-' + feedId + '-' + crypto.createHash('sha1').update(ev.uid + '|' + ev.from).digest('hex').slice(0, 12);
}

// Mirrors one feed into blocked_dates. On any fetch/parse failure the existing
// blocks are left untouched (a provider outage must not free up booked nights).
async function syncFeed(sb, feed, opts) {
  const startedAt = new Date().toISOString();
  try {
    const text = await fetchFeedText(feed.url, opts && opts.timeoutMs);
    const parsed = parseIcal(text);
    const today = todayInPropertyTz();
    const label = (feed.name || 'External') + ' reservation';

    const rows = [];
    const seen = new Set();
    parsed.events.filter(function (e) { return e.to >= today; }).forEach(function (e) {
      const id = blockId(feed.id, e);
      if (seen.has(id)) return;
      seen.add(id);
      // Never expose guest names from the provider: this table is publicly readable.
      rows.push({ id, from_date: e.from, to_date: e.to, reason: label });
    });

    const prefix = 'ICAL-' + feed.id + '-';
    const { data: existing, error: exErr } = await sb.from('blocked_dates').select('id').like('id', prefix + '%');
    if (exErr) throw new Error(exErr.message);

    if (rows.length) {
      const { error: upErr } = await sb.from('blocked_dates').upsert(rows);
      if (upErr) throw new Error(upErr.message);
    }
    const stale = (existing || []).map(function (r) { return r.id; }).filter(function (id) { return !seen.has(id); });
    if (stale.length) {
      const { error: delErr } = await sb.from('blocked_dates').delete().in('id', stale);
      if (delErr) throw new Error(delErr.message);
    }

    // Surface clashes with direct bookings already on the books: these need a human.
    const conflicts = [];
    if (rows.length) {
      const { data: bookings } = await sb.from('bookings').select('id, guest_name, checkin, checkout').neq('status', 'cancelled').gte('checkout', today);
      (bookings || []).forEach(function (b) {
        rows.forEach(function (r) {
          if (b.checkin < addDays(r.to_date, 1) && b.checkout > r.from_date) {
            conflicts.push({ bookingId: b.id, guest: b.guest_name, from: r.from_date, to: r.to_date });
          }
        });
      });
    }

    const warnings = [];
    if (parsed.skippedRecurring) warnings.push(parsed.skippedRecurring + ' recurring event(s) were skipped (not supported).');
    if (conflicts.length) warnings.push(conflicts.length + ' imported block(s) overlap an existing direct booking — please review.');

    const result = { ok: true, imported: rows.length, removed: stale.length, warnings, conflicts };
    await sb.from('ical_feeds').update({
      last_checked: startedAt, last_synced: startedAt, last_status: 'ok',
      last_error: warnings.join(' '), last_count: rows.length,
    }).eq('id', feed.id);
    return result;
  } catch (err) {
    await sb.from('ical_feeds').update({ last_checked: startedAt, last_status: 'error', last_error: err.message }).eq('id', feed.id);
    return { ok: false, error: err.message, imported: 0, removed: 0, warnings: [], conflicts: [] };
  }
}

// Lazily refresh feeds that haven't been checked recently. Called from the
// availability / payment paths so guests never see a stale calendar for long.
// Never throws and never delays the caller by more than ~budgetMs.
async function refreshIfStale(sb, maxAgeMs, budgetMs) {
  try {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const { data: feeds } = await sb.from('ical_feeds').select('*').eq('enabled', true)
      .or('last_checked.is.null,last_checked.lt.' + cutoff);
    if (!feeds || !feeds.length) return;
    const jobs = feeds.map(async function (feed) {
      // Claim the feed so concurrent requests don't all refetch it.
      const claim = await sb.from('ical_feeds').update({ last_checked: new Date().toISOString() })
        .eq('id', feed.id).or('last_checked.is.null,last_checked.lt.' + cutoff).select('id');
      if (!claim.data || !claim.data.length) return;
      await syncFeed(sb, feed, { timeoutMs: Math.max(1500, (budgetMs || 5000) - 500) });
    });
    await Promise.race([
      Promise.allSettled(jobs),
      new Promise(function (resolve) { setTimeout(resolve, budgetMs || 5000); }),
    ]);
  } catch (err) {
    console.error('iCal refresh failed:', err.message);
  }
}

module.exports = { parseIcal, parseIcalDate, normaliseFeedUrl, assertPublicHost, isPrivateIp, fetchFeedText, syncFeed, refreshIfStale, addDays };
