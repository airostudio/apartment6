// Shared availability check. Dates are 'YYYY-MM-DD' strings; ISO date strings
// compare correctly as plain strings, so no Date/timezone maths is involved.
//
// Bookings occupy the half-open range [checkin, checkout): same-day turnover
// is allowed. Admin blocked dates are inclusive of their `to` date, matching
// the admin calendar (admin/calendar.html).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validRange(checkin, checkout) {
  return DATE_RE.test(checkin || '') && DATE_RE.test(checkout || '') && checkout > checkin;
}

// Returns null when the range is free, otherwise { type: 'booking'|'blocked', id }.
async function findConflict(sb, checkin, checkout, excludeId) {
  const { data: bookings, error: bErr } = await sb
    .from('bookings')
    .select('id, checkin, checkout, status')
    .neq('status', 'cancelled')
    .lt('checkin', checkout)
    .gt('checkout', checkin);
  if (bErr) throw new Error(bErr.message);
  const hit = (bookings || []).find(function (b) { return !excludeId || b.id !== excludeId; });
  if (hit) return { type: 'booking', id: hit.id };

  const { data: blocks, error: kErr } = await sb
    .from('blocked_dates')
    .select('id, from_date, to_date')
    .lte('from_date', checkout)
    .gte('to_date', checkin);
  if (kErr) throw new Error(kErr.message);
  // Blocked range is inclusive of to_date, so a stay starting the day after
  // to_date is fine and one checking out on from_date is fine.
  const blk = (blocks || []).find(function (k) { return k.from_date < checkout && k.to_date >= checkin; });
  if (blk) return { type: 'blocked', id: blk.id };

  return null;
}

module.exports = { validRange, findConflict };
