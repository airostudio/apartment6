/**
 * Cascade Apartment 6 - Stripe Payment Integration
 * Handles: Payment processing, card element rendering, checkout flow.
 *
 * NOTE: Requires Stripe.js: <script src="https://js.stripe.com/v3/"></script>
 *
 * Payments go directly to the property owner's Stripe account (standard integration).
 * All payment events (success and failure) are recorded to localStorage so the
 * admin Payments page reflects real-time transaction history.
 */

(function() {
    'use strict';


    const StripePayments = {
        stripe: null,
        elements: null,
        cardElement: null,

        config: {
            // Publishable key is resolved at runtime from the server response.
            // Do NOT hardcode a key here — it must match the secret key on the server.
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

        async init() {
            if (typeof Stripe === 'undefined') {
                console.warn('Stripe.js not loaded. Showing placeholder card input.');
                this.showPlaceholder();
                return;
            }
            try {
                // Resolve the publishable key from the server so it always matches
                // the secret key — avoids "No such payment_intent" mismatches.
                const res = await fetch('/api/stripe-config').catch(() => null);
                if (res && res.ok) {
                    const cfg = await res.json();
                    if (cfg.publishableKey) this.config.publishableKey = cfg.publishableKey;
                }
                if (!this.config.publishableKey) {
                    console.warn('Stripe publishable key not available. Showing placeholder.');
                    this.showPlaceholder();
                    return;
                }
                this.stripe = Stripe(this.config.publishableKey);
                this.createElements();
            } catch (e) {
                console.warn('Failed to initialise Stripe:', e.message);
                this.showPlaceholder();
            }
        },

        createElements() {
            const cardContainer = document.getElementById('stripe-card-element');
            if (!cardContainer || !this.stripe) return;

            this.elements = this.stripe.elements({ appearance: this.config.appearance });

            this.cardElement = this.elements.create('card', {
                hidePostalCode: true,
                style: {
                    base: {
                        fontSize: '16px',
                        color: '#2d2926',
                        fontFamily: 'Inter, sans-serif',
                        '::placeholder': { color: '#b8b0a4' },
                    },
                    invalid: { color: '#e74c3c' },
                }
            });

            this.cardElement.mount('#stripe-card-element');

            this.cardElement.on('change', (event) => {
                const errorEl = document.getElementById('card-errors');
                if (errorEl) errorEl.textContent = event.error ? event.error.message : '';
            });
        },

        /**
         * Show a realistic fallback card input when Stripe.js cannot initialise.
         * Replace publishableKey with a real key to use live Stripe Elements.
         */
        showPlaceholder() {
            const cardContainer = document.getElementById('stripe-card-element');
            if (!cardContainer) return;

            cardContainer.innerHTML = `
                <div style="font-family:'Inter',sans-serif;color:#32325d;">
                    <div style="display:flex;align-items:center;gap:10px;padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid #e6ebf1;">
                        <input id="demoCardNum" type="text" inputmode="numeric" autocomplete="cc-number"
                            placeholder="Card number" maxlength="19"
                            style="border:none;outline:none;font-size:15px;color:#32325d;font-family:inherit;background:transparent;flex:1;min-width:0;">
                        <svg viewBox="0 0 38 24" width="34" height="22" aria-hidden="true" style="flex-shrink:0;opacity:0.35;">
                            <rect width="38" height="24" rx="4" fill="#e8e8e8"/>
                            <rect x="4" y="8" width="10" height="8" rx="2" fill="#aaa"/>
                            <rect x="17" y="10" width="17" height="4" rx="1" fill="#aaa"/>
                        </svg>
                    </div>
                    <div style="display:flex;gap:12px;">
                        <input id="demoExpiry" type="text" inputmode="numeric" autocomplete="cc-exp"
                            placeholder="MM / YY" maxlength="7"
                            style="border:none;outline:none;font-size:15px;color:#32325d;font-family:inherit;background:transparent;width:50%;">
                        <input id="demoCvc" type="text" inputmode="numeric" autocomplete="cc-csc"
                            placeholder="CVC" maxlength="4"
                            style="border:none;outline:none;font-size:15px;color:#32325d;font-family:inherit;background:transparent;width:50%;">
                    </div>
                </div>`;

            const numEl = document.getElementById('demoCardNum');
            if (numEl) {
                numEl.addEventListener('input', function () {
                    const v = this.value.replace(/\D/g, '').slice(0, 16);
                    this.value = v.replace(/(.{4})/g, '$1 ').trim();
                });
            }
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
         * Process a payment via the server-side PaymentIntent API.
         * Returns { success, paymentIntentId, status } on success.
         * Throws an Error with a user-friendly message on failure.
         */
        async processPayment(bookingData) {
            if (!this.stripe || !this.cardElement) {
                throw new Error('Stripe not initialised — please refresh and try again.');
            }

            const intentRes = await fetch('/api/create-payment-intent', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    amountCents: bookingData.amountCents,
                    currency:    'aud',
                }),
            });

            const intentData = await intentRes.json();
            if (!intentRes.ok) throw new Error(intentData.error || 'Could not create payment intent.');

            // If the server returned a publishable key that differs from the one used
            // at init time, swap the Stripe instance — but do NOT remount the card
            // element (that would clear what the user has already typed).
            if (intentData.publishableKey && intentData.publishableKey !== this.config.publishableKey) {
                this.config.publishableKey = intentData.publishableKey;
                this.stripe = Stripe(this.config.publishableKey);
            }

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
        }
    };

    // ─── Payment record helpers ───────────────────────────────────────────────

    /**
     * Persist a payment transaction record (success or failure) to Supabase.
     * The admin Payments page reads from this store.
     */
    function recordPayment(opts) {
        const record = {
            id:          'PAY-' + Date.now(),
            bookingRef:  opts.bookingRef  || '',
            bookingId:   opts.bookingId   || '',
            guestName:   opts.guestName   || 'Guest',
            guestEmail:  opts.guestEmail  || '',
            amount:      opts.amount      || 0,
            status:      opts.status,
            stripeId:    opts.stripeId    || '',
            method:      'card',
            timestamp:   new Date().toISOString(),
            errorMsg:    opts.errorMsg    || '',
        };
        if (window.DB) window.DB.createPayment(record);
    }

    // ─── Checkout Form Handler ────────────────────────────────────────────────

    function initCheckoutForm() {
        const form = document.getElementById('checkoutForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('payNowBtn');
            const originalLabel = submitBtn ? submitBtn.querySelector('#payNowLabel')?.textContent : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                const labelEl = submitBtn.querySelector('#payNowLabel');
                if (labelEl) labelEl.textContent = 'Processing…';
                else submitBtn.textContent = 'Processing…';
            }

            // Gather form data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            // Pull pending booking from sessionStorage
            let pending = null;
            let guestEmail = '';
            try {
                pending = JSON.parse(sessionStorage.getItem('cascade6_pending_booking') || 'null');
                if (pending) guestEmail = pending.email || '';
            } catch(_) {}

            const amountCents = parseInt(data.amount) || 0;
            let confirmedRef = 'TRA-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-5);

            try {
                const result = await StripePayments.processPayment({
                    cardholderName: data.cardHolderName,
                    email:          guestEmail,
                    address:        data.billingStreet,
                    city:           data.billingCity,
                    state:          data.billingState,
                    country:        data.billingCountry || 'AU',
                    amountCents,
                });

                if (result.success) {
                    // ── Save confirmed booking to Supabase ────────────────────
                    let savedBooking = null;
                    try {
                        if (pending) {
                            const bk = {
                                id:              'bk-' + Date.now(),
                                ref:             confirmedRef,
                                guestName:       pending.guestName       || 'Guest',
                                name:            pending.guestName       || 'Guest',
                                email:           pending.email           || '',
                                phone:           pending.phone           || '',
                                checkin:         pending.checkin,
                                checkout:        pending.checkout,
                                nights:          pending.nights          || 0,
                                guests:          pending.guests          || 2,
                                total:           Number(pending.total || 0),
                                accom:           pending.accom           || 0,
                                addons:          pending.addons          || [],
                                extraGuestTotal: pending.extraGuestTotal || 0,
                                cleaning:        pending.cleaning        || 0,
                                service:         pending.service         || 0,
                                tax:             pending.tax             || 0,
                                specialRequests: pending.specialRequests || '',
                                status:          'confirmed',
                                paymentStatus:   'paid',
                                stripeId:        result.paymentIntentId  || '',
                                bookedAt:        new Date().toISOString()
                            };
                            if (window.DB) await window.DB.createBooking(bk);
                            sessionStorage.setItem('cascade6_confirmed_booking', JSON.stringify(bk));
                            sessionStorage.removeItem('cascade6_pending_booking');
                            confirmedRef = bk.ref;
                            savedBooking = bk;
                        }
                    } catch(e) { /* non-critical — booking saved to DB above */ }

                    // ── Record successful payment ──────────────────────────────
                    recordPayment({
                        bookingRef:  confirmedRef,
                        bookingId:   savedBooking ? savedBooking.id : '',
                        guestName:   savedBooking ? savedBooking.guestName : (pending ? pending.guestName : 'Guest'),
                        guestEmail:  savedBooking ? savedBooking.email : guestEmail,
                        amount:      amountCents / 100,
                        status:      'succeeded',
                        stripeId:    result.paymentIntentId || '',
                    });

                    window.TrendAccom?.showToast('Payment successful!', 'success');
                    window.location.href = 'confirmation.html?ref=' + encodeURIComponent(confirmedRef);
                }

            } catch (error) {
                // ── Record failed payment ──────────────────────────────────────
                recordPayment({
                    bookingRef:  confirmedRef,
                    bookingId:   '',
                    guestName:   pending ? (pending.guestName || 'Guest') : 'Guest',
                    guestEmail:  guestEmail,
                    amount:      amountCents / 100,
                    status:      'failed',
                    stripeId:    '',
                    errorMsg:    error.message || 'Payment declined',
                });

                // Show error in the card-errors div if present
                const cardErrors = document.getElementById('card-errors');
                if (cardErrors) cardErrors.textContent = error.message || 'Payment failed. Please try again.';

                window.TrendAccom?.showToast(error.message || 'Payment failed. Please try again.', 'error');

                if (submitBtn) {
                    submitBtn.disabled = false;
                    const labelEl = submitBtn.querySelector('#payNowLabel');
                    if (labelEl) labelEl.textContent = originalLabel;
                    else submitBtn.textContent = originalLabel;
                }
            }
        });
    }

    // ─── Initialise ──────────────────────────────────────────────────────────

    function init() {
        StripePayments.init();
        initCheckoutForm();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.TrendAccom = window.TrendAccom || {};
    window.TrendAccom.StripePayments = StripePayments;
})();
