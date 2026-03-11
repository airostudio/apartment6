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

  window.DB = {
    // ── Bookings ──────────────────────────────────────────────────────────
    getBookings() {
      return api('/api/bookings').catch(() => []);
    },
    createBooking(bk) {
      return api('/api/bookings', { method: 'POST', ...json(bk) });
    },
    updateBooking(id, changes) {
      return api('/api/bookings?id=' + encodeURIComponent(id), { method: 'PUT', ...json(changes) });
    },
    deleteBooking(id) {
      return api('/api/bookings?id=' + encodeURIComponent(id), { method: 'DELETE' });
    },

    // ── Payments ──────────────────────────────────────────────────────────
    getPayments() {
      return api('/api/payments').catch(() => []);
    },
    createPayment(p) {
      return api('/api/payments', { method: 'POST', ...json(p) }).catch(() => null);
    },
    clearPayments() {
      return api('/api/payments', { method: 'DELETE' });
    },

    // ── Rates ─────────────────────────────────────────────────────────────
    getRates() {
      return api('/api/rates').catch(() => null);
    },
    saveRates(rates) {
      return api('/api/rates', { method: 'POST', ...json(rates) });
    },

    // ── Blocked Dates ─────────────────────────────────────────────────────
    getBlockedDates() {
      return api('/api/blocked-dates').catch(() => []);
    },
    createBlockedDate(item) {
      return api('/api/blocked-dates', { method: 'POST', ...json(item) });
    },
    deleteBlockedDate(id) {
      return api('/api/blocked-dates?id=' + encodeURIComponent(id), { method: 'DELETE' });
    },

    // ── Property Settings ──────────────────────────────────────────────────
    getPropertySettings() {
      return api('/api/property-settings').catch(() => ({}));
    },
    savePropertySettings(settings) {
      return api('/api/property-settings', { method: 'POST', ...json(settings) });
    },

    // ── Site Settings ──────────────────────────────────────────────────────
    getSiteSettings() {
      return api('/api/site-settings').catch(() => ({}));
    },
    saveSiteSettings(settings) {
      return api('/api/site-settings', { method: 'POST', ...json(settings) });
    },
  };
})();
