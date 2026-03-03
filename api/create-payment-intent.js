const secretKey = process.env.STRIPE_SECRET_KEY;
const cfg       = require('./_shared-config');

if (!secretKey) {
  console.error('STRIPE_SECRET_KEY environment variable is not set.');
} else if (secretKey.startsWith('pk_')) {
  console.error('STRIPE_SECRET_KEY is set to a publishable key (pk_...). Set it to the secret key (sk_...) instead.');
}

const stripe = require('stripe')(secretKey);

/** Expand a date range into individual YYYY-MM-DD strings (checkout night excluded) */
function expandDates(checkin, checkout) {
  const dates = [];
  const start = new Date(checkin  + 'T00:00:00');
  const end   = new Date(checkout + 'T00:00:00');
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// In-flight checkouts hold a date claim for this window.
// The first PaymentIntent created for a set of dates wins.
const CLAIM_WINDOW_MS = 30 * 60 * 1000;

/**
 * After creating a PaymentIntent, re-scan Stripe to enforce timestamp-first-wins.
 * If any OTHER PI for the same dates was created BEFORE ours (earlier Unix
 * timestamp, or same timestamp but lexicographically earlier ID), we lost the
 * race — cancel our PI and tell the guest.
 *
 * Tiebreaker: pi.created (seconds) first, pi.id (lexicographic) as secondary
 * for the rare same-second case. This is deterministic and consistent for
 * every server instance that processes the collision.
 */
async function findEarlierConflict(stripe, newPI, checkin, checkout) {
  const newStart = new Date(checkin  + 'T00:00:00');
  const newEnd   = new Date(checkout + 'T00:00:00');
  const now      = Date.now();

  let intents = [];
  let pg = await stripe.paymentIntents.list({ limit: 100 });
  intents.push(...pg.data);
  while (pg.has_more) {
    pg = await stripe.paymentIntents.list({ limit: 100, starting_after: pg.data[pg.data.length - 1].id });
    intents.push(...pg.data);
  }

  return intents.some(pi => {
    if (pi.id === newPI.id) return false; // skip ourselves

    const m = pi.metadata || {};
    if (!m.checkin || !m.checkout) return false;
    const bStart = new Date(m.checkin  + 'T00:00:00');
    const bEnd   = new Date(m.checkout + 'T00:00:00');
    if (!(newStart < bEnd && newEnd > bStart)) return false; // no overlap

    const isAdminOverride = m.source === 'admin_override';
    const isConfirmed     = pi.status === 'succeeded' || pi.status === 'processing';
    const isPending       = pi.status === 'requires_payment_method' &&
                            (now - pi.created * 1000) < CLAIM_WINDOW_MS;

    // Admin holds always beat guest checkouts
    if (isAdminOverride && pi.status !== 'cancelled') return true;
    if (!isConfirmed && !isPending) return false;

    // Is this competitor older than our PI?
    if (pi.created < newPI.created) return true;           // strictly earlier second
    if (pi.created === newPI.created && pi.id < newPI.id) return true; // same second, earlier ID
    return false;
  });
}

/** Check Stripe PaymentIntents for date conflicts.
 *  Blocks on confirmed bookings AND in-flight checkouts (requires_payment_method
 *  within CLAIM_WINDOW_MS) so concurrent guests can't double-book. */
async function isAvailable(checkin, checkout) {
  const newStart = new Date(checkin  + 'T00:00:00');
  const newEnd   = new Date(checkout + 'T00:00:00');
  const now      = Date.now();

  let intents = [];
  let page = await stripe.paymentIntents.list({ limit: 100 });
  intents.push(...page.data);
  while (page.has_more) {
    page = await stripe.paymentIntents.list({
      limit: 100,
      starting_after: page.data[page.data.length - 1].id,
    });
    intents.push(...page.data);
  }

  return !intents.some(pi => {
    if (pi.status === 'cancelled') return false;
    const m = pi.metadata || {};
    const isAdminOverride = m.source === 'admin_override';
    const isConfirmed     = pi.status === 'succeeded' || pi.status === 'processing';
    const isPending       = pi.status === 'requires_payment_method' &&
                            (now - pi.created * 1000) < CLAIM_WINDOW_MS;
    if (!isAdminOverride && !isConfirmed && !isPending) return false;
    if (!m.checkin || !m.checkout) return false;
    const bStart = new Date(m.checkin  + 'T00:00:00');
    const bEnd   = new Date(m.checkout + 'T00:00:00');
    return newStart < bEnd && newEnd > bStart;
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!secretKey) {
    return res.status(500).json({ error: 'Payment service not configured: STRIPE_SECRET_KEY is missing.' });
  }
  if (secretKey.startsWith('pk_')) {
    return res.status(500).json({ error: 'Payment service misconfigured: STRIPE_SECRET_KEY must be a secret key (sk_...), not a publishable key.' });
  }

  const {
    amountCents,
    platformFeeCents,
    currency = 'aud',
    checkin,
    checkout,
    guestName,
  } = req.body;

  if (!amountCents || amountCents < 50) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // ── Availability check (authoritative, server-side) ─────────────────────
  if (checkin && checkout) {
    try {
      const available = await isAvailable(checkin, checkout);
      if (!available) {
        return res.status(409).json({
          error: 'DATES_UNAVAILABLE',
          message: 'These dates are already booked. Please choose different dates.',
        });
      }
    } catch (err) {
      console.error('Availability pre-check error:', err.message);
      // Continue — do not hard-block on a Stripe list failure
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  try {
    const params = {
      amount:   Math.round(amountCents),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        propertyId: 'cascade6',
        ...(checkin   && { checkin }),
        ...(checkout  && { checkout }),
        ...(guestName && { guestName }),
      },
    };

    // Read at request time so /tmp session config (saved via admin UI) is
    // picked up immediately after onboarding, without needing a redeploy.
    const connectedAccountId = cfg.getConnectedAccountId();
    if (connectedAccountId) {
      params.application_fee_amount = Math.round(platformFeeCents || amountCents * 0.011);
      params.transfer_data          = { destination: connectedAccountId };
    }

    const paymentIntent = await stripe.paymentIntents.create(params);

    // ── Timestamp-first-wins: post-creation race check ─────────────────────
    // Now that our PI has a Stripe-assigned created timestamp, scan for any
    // OLDER PI covering the same dates.  If one exists we lost the race —
    // cancel our PI immediately and tell the guest.
    if (checkin && checkout) {
      try {
        const lostRace = await findEarlierConflict(stripe, paymentIntent, checkin, checkout);
        if (lostRace) {
          await stripe.paymentIntents.cancel(paymentIntent.id);
          return res.status(409).json({
            error:   'DATES_JUST_TAKEN',
            message: 'These dates were just taken by another booking. Please go back and choose different dates.',
          });
        }
      } catch (raceErr) {
        // Post-creation check failed — log but do not block; the pre-check
        // already ran, so the chance of an undetected double-book is very low.
        console.error('Post-creation race check error:', raceErr.message);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe PaymentIntent error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
