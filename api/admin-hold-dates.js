/**
 * /api/admin-hold-dates
 *
 * POST { checkin, checkout, guestName?, notes?, oldHoldId?, force? }
 *   Creates a permanent admin-override Stripe PaymentIntent that blocks
 *   those dates from guest bookings indefinitely (no 30-minute expiry).
 *
 *   Before creating the hold:
 *   - Any in-flight guest PIs (requires_payment_method within 30 min) for
 *     the same dates are cancelled immediately — admin displaces them.
 *   - If confirmed (succeeded/processing) guest PIs exist and force !== true,
 *     the request returns 409 so the admin UI can warn and confirm.
 *   - If oldHoldId is provided (editing a booking and dates changed), the
 *     previous hold is released before creating the new one.
 *
 *   Response 200: { holdId, displacedPending, conflictingConfirmed }
 *   Response 409: { error:'ADMIN_HOLD_CONFLICT', conflictingConfirmed, message }
 *
 * DELETE ?id=pi_xxx  OR  body { id }
 *   Cancels an admin hold PI, freeing those dates.
 *   Response 200: { released: true }
 */

const secretKey      = process.env.STRIPE_SECRET_KEY;
const CLAIM_WINDOW_MS = 30 * 60 * 1000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Demo mode — no Stripe key, acknowledge without contacting Stripe
  if (!secretKey || secretKey.startsWith('pk_')) {
    if (req.method === 'POST')   return res.status(200).json({ holdId: null, demo: true, displacedPending: 0, conflictingConfirmed: [] });
    if (req.method === 'DELETE') return res.status(200).json({ released: true, demo: true });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = require('stripe')(secretKey);

  // ── DELETE — release a hold ─────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const holdId = req.query?.id || (req.body && req.body.id) || '';
    if (!holdId) return res.status(400).json({ error: 'id is required' });
    try {
      await stripe.paymentIntents.cancel(holdId);
      return res.status(200).json({ released: true });
    } catch (err) {
      // Already cancelled or not found — treat as success
      if (err.code === 'payment_intent_unexpected_state' || err.statusCode === 404) {
        return res.status(200).json({ released: true, alreadyCancelled: true });
      }
      console.error('admin-hold-dates DELETE error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — create a hold ────────────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { checkin, checkout, guestName, notes, oldHoldId, force } = req.body || {};

  if (!checkin || !checkout) {
    return res.status(400).json({ error: 'checkin and checkout are required' });
  }
  const newStart = new Date(checkin  + 'T00:00:00');
  const newEnd   = new Date(checkout + 'T00:00:00');
  if (isNaN(newStart) || isNaN(newEnd) || newEnd <= newStart) {
    return res.status(400).json({ error: 'Invalid date range' });
  }

  try {
    // ── Scan all PIs for date-range conflicts ─────────────────────────────
    let allIntents = [];
    let page = await stripe.paymentIntents.list({ limit: 100 });
    allIntents.push(...page.data);
    while (page.has_more) {
      page = await stripe.paymentIntents.list({
        limit: 100,
        starting_after: page.data[page.data.length - 1].id,
      });
      allIntents.push(...page.data);
    }

    const now             = Date.now();
    const pendingToCancel = [];     // in-flight guest PIs — admin displaces these
    const confirmedConflicts = [];  // paid guest PIs or existing admin holds — warn

    allIntents.forEach(pi => {
      if (pi.id === oldHoldId) return; // skip the hold we're replacing

      const m = pi.metadata || {};
      if (!m.checkin || !m.checkout) return;

      // Check for date overlap
      const bStart = new Date(m.checkin  + 'T00:00:00');
      const bEnd   = new Date(m.checkout + 'T00:00:00');
      if (!(newStart < bEnd && newEnd > bStart)) return;

      const isAdminOverride = m.source === 'admin_override';
      const isConfirmed     = pi.status === 'succeeded' || pi.status === 'processing';
      const isPending       = pi.status === 'requires_payment_method' &&
                              (now - pi.created * 1000) < CLAIM_WINDOW_MS;

      if (pi.status === 'cancelled') return; // skip already-released holds

      if (isAdminOverride) {
        // Another admin hold — don't auto-cancel; require manual resolution
        confirmedConflicts.push({
          id:        pi.id,
          type:      'admin_override',
          checkin:   m.checkin,
          checkout:  m.checkout,
          guestName: m.guestName || null,
        });
        return;
      }
      if (isConfirmed) {
        confirmedConflicts.push({
          id:        pi.id,
          type:      'confirmed',
          checkin:   m.checkin,
          checkout:  m.checkout,
          guestName: m.guestName || null,
        });
        return;
      }
      if (isPending) {
        pendingToCancel.push(pi.id);
      }
    });

    // ── 409 if confirmed conflicts exist and admin hasn't force-confirmed ──
    if (confirmedConflicts.length > 0 && !force) {
      const hasGuestPayments = confirmedConflicts.some(c => c.type === 'confirmed');
      return res.status(409).json({
        error: 'ADMIN_HOLD_CONFLICT',
        conflictingConfirmed: confirmedConflicts,
        displacedPending: pendingToCancel.length,
        message: hasGuestPayments
          ? `${confirmedConflicts.filter(c => c.type === 'confirmed').length} confirmed guest payment(s) already exist for these dates. Proceed to override and manually issue a refund, or choose different dates.`
          : `Another admin booking already covers these dates. Remove it before adding a new one.`,
      });
    }

    // ── Release the old hold (editing with new dates) ─────────────────────
    if (oldHoldId) {
      try { await stripe.paymentIntents.cancel(oldHoldId); } catch (_) { /* already gone */ }
    }

    // ── Displace in-flight guest checkouts ───────────────────────────────
    for (const piId of pendingToCancel) {
      try { await stripe.paymentIntents.cancel(piId); } catch (_) { /* already gone */ }
    }

    // ── Create the admin hold PI ─────────────────────────────────────────
    // Amount: 50 cents AUD (Stripe minimum). This PI is never confirmed —
    // it just sits in requires_payment_method as a permanent date-block marker.
    const holdPI = await stripe.paymentIntents.create({
      amount:   50,
      currency: 'aud',
      automatic_payment_methods: { enabled: true },
      metadata: {
        propertyId: 'cascade6',
        source:     'admin_override',
        checkin,
        checkout,
        ...(guestName && { guestName }),
        ...(notes     && { notes }),
        createdAt:  String(Date.now()),
      },
    });

    return res.status(200).json({
      holdId:               holdPI.id,
      displacedPending:     pendingToCancel.length,
      conflictingConfirmed: confirmedConflicts,
    });

  } catch (err) {
    console.error('admin-hold-dates POST error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
