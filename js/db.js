/**
 * db.js — Cascade Apartment 6 data layer.
 * Replaces localStorage for all persistent data.
 * All methods return Promises.
 */
(function () {
  'use strict';

  async function api(path, options) {
    const res = await fetch(path, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || ('API error ' + res.status));
    }
    return res.json();
  }

  function json(body) {
    return {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  }

  function adminJson(body) {
    const key = (function () {
      try {
        const s = JSON.parse(localStorage.getItem('trendaccom_admin_auth') || '{}');
        return s.adminKey || '';
      } catch (_) { return ''; }
    })();
    return {
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
      body: JSON.stringify(body),
    };
  }

  function adminOpts() {
    const key = (function () {
      try {
        const s = JSON.parse(localStorage.getItem('trendaccom_admin_auth') || '{}');
        return s.adminKey || '';
      } catch (_) { return ''; }
    })();
    return { headers: { 'X-Admin-Key': key } };
  }

  window.DB = {
    // ── Bookings ──────────────────────────────────────────────────────────
    getBookings() {
      return api('/api/bookings').catch(() => []);
    },
    createBooking(bk) {
      return api('/api/bookings', { method: 'POST', ...json(bk) });
    },
    updateBooking(id, changes) {
      return api('/api/bookings?id=' + encodeURIComponent(id), { method: 'PUT', ...adminJson(changes) });
    },
    deleteBooking(id) {
      return api('/api/bookings?id=' + encodeURIComponent(id), { method: 'DELETE', ...adminOpts() });
    },

    // ── Payments ──────────────────────────────────────────────────────────
    getPayments() {
      return api('/api/payments').catch(() => []);
    },
    createPayment(p) {
      return api('/api/payments', { method: 'POST', ...json(p) }).catch(() => null);
    },
    clearPayments() {
      return api('/api/payments', { method: 'DELETE', ...adminOpts() });
    },

    // ── Rates ─────────────────────────────────────────────────────────────
    getRates() {
      return api('/api/rates').catch(() => null);
    },
    saveRates(rates) {
      return api('/api/rates', { method: 'POST', ...adminJson(rates) });
    },

    // ── Blocked Dates ─────────────────────────────────────────────────────
    getBlockedDates() {
      return api('/api/blocked-dates').catch(() => []);
    },
    createBlockedDate(item) {
      return api('/api/blocked-dates', { method: 'POST', ...adminJson(item) });
    },
    deleteBlockedDate(id) {
      return api('/api/blocked-dates?id=' + encodeURIComponent(id), { method: 'DELETE', ...adminOpts() });
    },

    // ── Property Settings ──────────────────────────────────────────────────
    getPropertySettings() {
      return api('/api/property-settings').catch(() => ({}));
    },
    savePropertySettings(settings) {
      return api('/api/property-settings', { method: 'POST', ...adminJson(settings) });
    },

    // ── Site Settings ──────────────────────────────────────────────────────
    getSiteSettings() {
      return api('/api/site-settings').catch(() => ({}));
    },
    saveSiteSettings(settings) {
      return api('/api/site-settings', { method: 'POST', ...adminJson(settings) });
    },

    // ── Booking Email ──────────────────────────────────────────────────────
    sendBookingEmail(bk) {
      return api('/api/booking-email', { method: 'POST', ...json(bk) }).catch(() => null);
    },

    // ── Tax Invoice ───────────────────────────────────────────────────────
    sendTaxInvoice(id) {
      return api('/api/tax-invoice', { method: 'POST', ...adminJson({ id: id }) });
    },
  };
})();
