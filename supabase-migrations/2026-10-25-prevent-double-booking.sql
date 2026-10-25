-- Prevent double bookings at the database level.
-- Run in the Supabase SQL Editor.

-- STEP 1 — run this SELECT first. It must return ZERO rows.
-- Any rows returned are existing overlapping bookings; resolve them (cancel
-- or re-date one of each pair) before running step 2, or step 2 will fail.
SELECT a.id AS booking_a, b.id AS booking_b, a.checkin, a.checkout, b.checkin AS b_checkin, b.checkout AS b_checkout
FROM bookings a
JOIN bookings b
  ON a.id < b.id
 AND a.status <> 'cancelled' AND b.status <> 'cancelled'
 AND a.checkin < b.checkout AND a.checkout > b.checkin;

-- STEP 2 — add the guard. Half-open [checkin, checkout) ranges, so
-- same-day turnover (one guest out, the next in) is still allowed.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_checkout_after_checkin
  CHECK (checkin IS NULL OR checkout IS NULL OR checkout > checkin) NOT VALID;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (daterange(checkin, checkout, '[)') WITH &&)
  WHERE (status <> 'cancelled' AND checkin IS NOT NULL AND checkout IS NOT NULL);
