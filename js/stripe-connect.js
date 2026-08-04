/**
 * TrendAccom - Stripe Connect Integration
 * Handles: Stripe Connect onboarding, payment processing,
 * payment intents, and checkout flow
 *
 * NOTE: This module requires the Stripe.js library to be loaded:
 * <script src="https://js.stripe.com/v3/"></script>
 *
 * For Stripe Connect, you need:
 * 1. A Stripe platform account with Connect enabled
 * 2. Each property owner connects their Stripe account
 * 3. Payments go through the platform and are split to connected accounts
 */

(function() {
  'use strict';

  const StripeConnect = {
    stripe: null,
    elements: null,
    cardElement: null,
    testMode: false,

    // Configuration — key loaded dynamically from /api/stripe-config
    config: {
      publishableKey: '',
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
     * Initialize Stripe — loads publishable key from server first
     */
    async init() {
      if (typeof Stripe === 'undefined') {
        console.warn('Stripe.js not loaded. Payment processing unavailable.');
        this.showPlaceholder();
        return;
      }

      // Fetch live/test key from server so it stays out of client code
      try {
        const cfg = await fetch('/api/stripe-config').then(r => r.json());
        this.config.publishableKey = cfg.publishableKey || '';
        this.testMode = !!cfg.testMode;

        // Show test-mode warning banner if present on the page
        const banner = document.getElementById('stripeTestBanner');
        if (banner) banner.style.display = this.testMode ? 'block' : 'none';
      } catch (e) {
        console.warn('Could not load Stripe config:', e.message);
      }

      if (!this.config.publishableKey) {
        this.showPlaceholder();
        return;
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
      if (!this.stripe || !this.cardElement) {
        throw new Error('Stripe not initialized');
      }

      // 1. Create the PaymentIntent server-side (keeps secret key off the client)
      const intentRes = await fetch('/api/create-payment-intent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          amountCents:      bookingData.amountCents,
          platformFeeCents: bookingData.platformFeeCents,
          currency:         'aud',
        }),
      });

      const intentData = await intentRes.json();
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
     * Stripe Connect Onboarding for property owners
     * Creates an Account Link for the Connect onboarding flow
     */
    async startOnboarding() {
      // In production, this would:
      // 1. Call your server to create a Connect account
      // 2. Server calls Stripe to create an Account Link
      // 3. Redirect the property owner to Stripe's onboarding


      // Simulated redirect URL
      const onboardingUrl = 'https://connect.stripe.com/setup/s/demo';

      window.TrendAccom?.showToast('Redirecting to Stripe Connect...', 'info');

      // In production: window.location.href = onboardingUrl;
      return { url: onboardingUrl };
    },

    /**
     * Check Connect account status
     */
    async checkAccountStatus(accountId) {
      // In production, call your server to check the connected account status
      return {
        accountId: accountId || 'acct_demo',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        businessType: 'company',
        created: '2026-01-15'
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

        // Retrieve email from pending booking (not collected again at checkout)
        let guestEmail = '';
        try {
          const pb = JSON.parse(sessionStorage.getItem('cascade6_pending_booking') || 'null');
          if (pb) guestEmail = pb.email || '';
        } catch(_) {}

        const result = await StripeConnect.processPayment({
          cardholderName:   data.cardHolderName,
          email:            guestEmail,
          address:          data.billingStreet,
          city:             data.billingCity,
          state:            data.billingState,
          country:          data.billingCountry || 'AU',
          amountCents:      parseInt(data.amount) || 0,
          platformFeeCents: parseInt(data.platformFeeCents) || 0,
        });

        if (result.success) {
          // ── Save confirmed booking to localStorage ──────────────────────
          let confirmedRef = 'CA6-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5);
          let confirmedBk  = null;
          try {
            const pending = JSON.parse(sessionStorage.getItem('cascade6_pending_booking') || 'null');
            if (pending) {
              confirmedBk = {
                id:              'bk-' + Date.now(),
                ref:             confirmedRef,
                name:            pending.guestName       || 'Guest',
                email:           pending.email           || '',
                phone:           pending.phone           || '',
                checkin:         pending.checkin,
                checkout:        pending.checkout,
                nights:          pending.nights          || 0,
                guests:          pending.guests          || 2,
                total:           Number(pending.total || 0).toFixed(2),
                accom:           pending.accom           || 0,
                addons:          pending.addons          || [],
                extraGuestTotal: pending.extraGuestTotal || 0,
                cleaning:        pending.cleaning        || 0,
                service:         pending.service         || 0,
                tax:             pending.tax             || 0,
                platformFee:     pending.platformFee     || 0,
                specialRequests: pending.specialRequests || '',
                status:          'confirmed',
                bookedAt:        new Date().toISOString()
              };
              const existing = JSON.parse(localStorage.getItem('cascade6_bookings') || '[]');
              existing.push(confirmedBk);
              localStorage.setItem('cascade6_bookings', JSON.stringify(existing));
              sessionStorage.setItem('cascade6_confirmed_booking', JSON.stringify(confirmedBk));
              sessionStorage.removeItem('cascade6_pending_booking');
              confirmedRef = confirmedBk.ref;
            }
          } catch(e) { /* non-critical — proceed to confirmation */ }
          // ────────────────────────────────────────────────────────────────

          // ── Send confirmation emails via API (fire-and-forget) ──────────
          if (confirmedBk) {
            fetch('/api/booking-email', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify(confirmedBk),
            }).catch(() => {}); // non-critical
          }
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
  // Stripe Connect Admin Handler
  // ============================================
  function initStripeAdmin() {
    const connectBtn = document.getElementById('stripeConnectBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        await StripeConnect.startOnboarding();
      });
    }

    const disconnectBtn = document.getElementById('stripeDisconnectBtn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to disconnect your Stripe account?')) {
          window.TrendAccom?.showToast('Stripe account disconnected', 'warning');
        }
      });
    }
  }

  // ============================================
  // Initialize
  // ============================================
  function init() {
    StripeConnect.init();
    initCheckoutForm();
    initStripeAdmin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TrendAccom = window.TrendAccom || {};
  window.TrendAccom.StripeConnect = StripeConnect;
})();
