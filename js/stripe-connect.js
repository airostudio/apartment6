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
     * Initialize Stripe
     */
    init() {
      if (typeof Stripe === 'undefined') {
        console.warn('Stripe.js not loaded. Payment processing unavailable.');
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

      // In production, this would:
      // 1. Send booking data to your server
      // 2. Server creates a PaymentIntent with Stripe Connect params
      // 3. Return the client_secret
      // 4. Confirm payment on the client side

      const billingDetails = {
        name: bookingData.cardholderName,
        email: bookingData.email,
        address: {
          line1: bookingData.address,
          city: bookingData.city,
          state: bookingData.state,
          postal_code: bookingData.postcode,
          country: bookingData.country || 'AU',
        }
      };

      // In production:
      // 1. POST booking details + billingDetails to your server
      // 2. Server calls Stripe to create a PaymentIntent with Connect params:
      //      { amount, currency, application_fee_amount, transfer_data: { destination: connectedAccountId } }
      // 3. Server returns { clientSecret }
      // 4. Confirm here: await this.stripe.confirmCardPayment(clientSecret, { payment_method: { card: this.cardElement, billing_details: billingDetails } })

      // Simulate successful payment
      return {
        success: true,
        paymentIntentId: 'pi_simulated_' + Date.now(),
        status: 'succeeded'
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

        const result = await StripeConnect.processPayment({
          cardholderName: data.cardholderName,
          email: data.email,
          address: data.address,
          city: data.city,
          state: data.state,
          postcode: data.postcode,
          country: data.country,
          amount: parseInt(data.amount) || 0
        });

        if (result.success) {
          window.TrendAccom?.showToast('Payment successful!', 'success');
          window.location.href = 'confirmation.html?ref=' +
            (window.TrendAccom?.BookingEngine?.generateReference() || 'TRA-2026-00001');
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
