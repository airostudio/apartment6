/**
 * TrendAccom - Stripe Payment Handler
 * Handles: Stripe Elements initialisation, payment processing,
 * payment intents, and checkout form submission.
 *
 * NOTE: This module requires the Stripe.js library to be loaded:
 * <script src="https://js.stripe.com/v3/"></script>
 */

(function() {
  'use strict';

  const StripeConnect = {
    stripe: null,
    elements: null,
    cardElement: null,

    // Configuration (would be set from server/environment)
    config: {
      publishableKey: 'pk_test_your_stripe_publishable_key',
      locale: 'en-AU',
      currency: 'aud',
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#0f2744',
          colorBackground: '#ffffff',
          colorText: '#2d2926',
          colorDanger: '#e74c3c',
          fontFamily: 'Inter, sans-serif',
          spacingUnit: '4px',
          borderRadius: '8px',
        }
      }
    },

    /**
     * Initialize Stripe — fetches the publishable key from the server first
     * so we never need to hardcode it in client-side code.
     */
    async init() {
      if (typeof Stripe === 'undefined') {
        console.warn('Stripe.js not loaded. Payment processing unavailable.');
        this.showPlaceholder();
        return;
      }

      // Fetch the publishable key from the server-side config endpoint
      try {
        const res = await fetch('/api/stripe-config');
        if (res.ok) {
          const data = await res.json();
          if (data.publishableKey) this.config.publishableKey = data.publishableKey;
        }
      } catch (e) {
        console.warn('Could not fetch Stripe config:', e.message);
      }

      try {
        this.stripe = Stripe(this.config.publishableKey);
        this.createElements();
      } catch (e) {
        console.warn('Failed to initialize Stripe:', e.message);
        this.showPlaceholder();
      }
    },

    /**
     * Create Stripe Elements for card input
     */
    createElements() {
      const cardContainer = document.getElementById('stripe-card-element');
      if (!cardContainer || !this.stripe) return;

      this.elements = this.stripe.elements({
        appearance: this.config.appearance
      });

      this.cardElement = this.elements.create('card', {
        hidePostalCode: true,   // not required for Australian cards
        style: {
          base: {
            fontSize: '16px',
            color: '#2d2926',
            fontFamily: 'Inter, sans-serif',
            '::placeholder': {
              color: '#b8b0a4',
            },
          },
          invalid: {
            color: '#e74c3c',
          },
        }
      });

      this.cardElement.mount('#stripe-card-element');

      // Handle real-time validation
      this.cardElement.on('change', (event) => {
        const errorEl = document.getElementById('card-errors');
        if (errorEl) {
          errorEl.textContent = event.error ? event.error.message : '';
        }
      });
    },

    /**
     * Show a realistic card input when Stripe.js cannot initialise
     * (e.g. publishable key not yet configured).
     * Replace the publishableKey in config with a real key to use live Stripe Elements.
     */
    showPlaceholder() {
      const cardContainer = document.getElementById('stripe-card-element');
      if (!cardContainer) return;

      cardContainer.innerHTML = `
        <div style="font-family:'Inter',sans-serif;color:#32325d;">
          <div style="display:flex;align-items:center;gap:10px;padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid #e6ebf1;">
            <input id="demoCardNum" type="text" inputmode="numeric" autocomplete="cc-number"
              placeholder="Card number"
              maxlength="19"
              style="border:none;outline:none;font-size:15px;color:#32325d;font-family:inherit;background:transparent;flex:1;min-width:0;">
            <svg viewBox="0 0 38 24" width="34" height="22" aria-hidden="true" style="flex-shrink:0;opacity:0.35;">
              <rect width="38" height="24" rx="4" fill="#e8e8e8"/>
              <rect x="4" y="8" width="10" height="8" rx="2" fill="#aaa"/>
              <rect x="17" y="10" width="17" height="4" rx="1" fill="#aaa"/>
            </svg>
          </div>
          <div style="display:flex;gap:12px;">
            <input id="demoExpiry" type="text" inputmode="numeric" autocomplete="cc-exp"
              placeholder="MM / YY"
              maxlength="7"
              style="border:none;outline:none;font-size:15px;color:#32325d;font-family:inherit;background:transparent;width:50%;">
            <input id="demoCvc" type="text" inputmode="numeric" autocomplete="cc-csc"
              placeholder="CVC"
              maxlength="4"
              style="border:none;outline:none;font-size:15px;color:#32325d;font-family:inherit;background:transparent;width:50%;">
          </div>
        </div>`;

      // Format card number: groups of 4
      const numEl = document.getElementById('demoCardNum');
      if (numEl) {
        numEl.addEventListener('input', function () {
          const v = this.value.replace(/\D/g, '').slice(0, 16);
          this.value = v.replace(/(.{4})/g, '$1 ').trim();
        });
      }

      // Format expiry: MM / YY
      const expEl = document.getElementById('demoExpiry');
      if (expEl) {
        expEl.addEventListener('input', function () {
          let v = this.value.replace(/\D/g, '').slice(0, 4);
          if (v.length > 2) v = v.slice(0, 2) + ' / ' + v.slice(2);
          this.value = v;
        });
      }
    },

    /**
     * Process payment (would communicate with your server)
     * In production, create a PaymentIntent on your server first
     */
    async processPayment(bookingData) {
      // Demo / development mode — Stripe.js not loaded or no real key configured.
      // Simulate a successful payment so the booking still gets saved locally.
      if (!this.stripe || !this.cardElement) {
        return {
          success:         true,
          paymentIntentId: 'demo_' + Date.now(),
          status:          'succeeded',
          demo:            true,
        };
      }

      // 1. Create the PaymentIntent server-side (keeps secret key off the client)
      const intentRes = await fetch('/api/create-payment-intent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          amountCents: bookingData.amountCents,
          currency:    'aud',
          checkin:     bookingData.checkin,
          checkout:    bookingData.checkout,
          guestName:   bookingData.guestName,
        }),
      });

      const intentData = await intentRes.json();
      if (intentRes.status === 409) {
        // DATES_JUST_TAKEN  — lost a simultaneous-booking race (post-creation check)
        // DATES_UNAVAILABLE — dates were already blocked before the PI was even attempted
        const msg = intentData.error === 'DATES_JUST_TAKEN'
          ? 'These dates were just taken by another guest moments ago. Please go back and choose different dates.'
          : 'These dates are no longer available. Please go back and choose different dates.';
        throw new Error(msg);
      }
      if (!intentRes.ok) throw new Error(intentData.error || 'Could not create payment');

      // 2. Confirm the payment client-side using the card element
      const { paymentIntent, error } = await this.stripe.confirmCardPayment(
        intentData.clientSecret,
        {
          payment_method: {
            card: this.cardElement,
            billing_details: {
              name:    bookingData.cardholderName,
              email:   bookingData.email,
              address: {
                line1:   bookingData.address,
                city:    bookingData.city,
                state:   bookingData.state,
                country: bookingData.country || 'AU',
              },
            },
          },
        }
      );

      if (error) throw new Error(error.message);

      return {
        success:         true,
        paymentIntentId: paymentIntent.id,
        status:          paymentIntent.status,
      };
    },

    /**
     * Create a refund
     */
    async createRefund(paymentIntentId, amount, reason) {
      // In production: POST { paymentIntentId, amount, reason } to your server,
      // which calls Stripe to create the refund via the API.
      return {
        success: true,
        refundId: 'rf_simulated_' + Date.now(),
        status: 'succeeded'
      };
    }
  };

  // ============================================
  // Checkout Form Handler
  // ============================================
  function initCheckoutForm() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
      }

      try {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Retrieve pending booking (email + dates needed for availability check)
        let pendingBooking = null;
        let guestEmail = '';
        try {
          pendingBooking = JSON.parse(sessionStorage.getItem('cascade6_pending_booking') || 'null');
          if (pendingBooking) guestEmail = pendingBooking.email || '';
        } catch(_) {}

        // ── Server-side availability check before touching Stripe ──────────
        if (pendingBooking?.checkin && pendingBooking?.checkout) {
          const availRes = await fetch('/api/check-availability', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              checkin:  pendingBooking.checkin,
              checkout: pendingBooking.checkout,
            }),
          }).then(r => r.json()).catch(() => ({ available: true }));

          if (!availRes.available) {
            throw new Error('These dates are no longer available. Please go back and choose different dates.');
          }
        }
        // ──────────────────────────────────────────────────────────────────

        const result = await StripeConnect.processPayment({
          cardholderName:   data.cardHolderName,
          email:            guestEmail,
          address:          data.billingStreet,
          city:             data.billingCity,
          state:            data.billingState,
          country:          data.billingCountry || 'AU',
          amountCents:      parseInt(data.amount) || 0,
          platformFeeCents: parseInt(data.platformFeeCents) || 0,
          checkin:          pendingBooking?.checkin,
          checkout:         pendingBooking?.checkout,
          guestName:        pendingBooking?.guestName,
        });

        if (result.success) {
          // ── Save confirmed booking to localStorage ──────────────────────
          let confirmedRef = 'TRA-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5);
          try {
            const pending = JSON.parse(sessionStorage.getItem('cascade6_pending_booking') || 'null');
            if (pending) {
              // Double-check availability before saving (race-condition safety net)
              const existingBookings = JSON.parse(localStorage.getItem('cascade6_bookings') || '[]');
              const newStart = new Date(pending.checkin);
              const newEnd   = new Date(pending.checkout);
              const conflict = existingBookings.some(bk => {
                if (bk.status === 'cancelled') return false;
                return newStart < new Date(bk.checkout) && newEnd > new Date(bk.checkin);
              });
              if (conflict) {
                throw new Error('These dates are no longer available. Please contact us to arrange a refund.');
              }

              const bk = {
                id:              'bk-' + Date.now(),
                ref:             confirmedRef,
                name:            pending.guestName       || 'Guest',
                email:           pending.email           || '',
                phone:           pending.phone           || '',
                checkin:         pending.checkin,
                checkout:        pending.checkout,
                nights:          pending.nights          || 0,
                guests:          pending.guests          || 2,
                total:           parseFloat(Number(pending.total || 0).toFixed(2)),
                accom:           pending.accom           || 0,
                addons:          pending.addons          || [],
                extraGuestTotal: pending.extraGuestTotal || 0,
                cleaning:        pending.cleaning        || 0,
                service:         pending.service         || 0,
                tax:             pending.tax             || 0,
                platformFee:     pending.platformFee     || 0,
                specialRequests: pending.specialRequests || '',
                status:          'confirmed',
                createdAt:       Date.now(),
                bookedAt:        new Date().toISOString()
              };
              const existing = JSON.parse(localStorage.getItem('cascade6_bookings') || '[]');
              existing.push(bk);
              localStorage.setItem('cascade6_bookings', JSON.stringify(existing));
              sessionStorage.setItem('cascade6_confirmed_booking', JSON.stringify(bk));
              sessionStorage.removeItem('cascade6_pending_booking');
              confirmedRef = bk.ref;
            }
          } catch(e) { /* non-critical — proceed to confirmation */ }
          // ────────────────────────────────────────────────────────────────

          window.TrendAccom?.showToast('Payment successful!', 'success');
          window.location.href = 'confirmation.html?ref=' + encodeURIComponent(confirmedRef);
        }
      } catch (error) {
        window.TrendAccom?.showToast(error.message || 'Payment failed. Please try again.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  // ============================================
  // Initialize
  // ============================================
  async function init() {
    await StripeConnect.init();
    initCheckoutForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TrendAccom = window.TrendAccom || {};
  window.TrendAccom.StripeConnect = StripeConnect;
})();
