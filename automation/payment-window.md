# Paid submission window

`paid_route_deadline` is required before `eligible_for_paid_pitch` can be true:

- Use `rolling` only after verifying the official program accepts rolling submissions.
- Otherwise supply an ISO 8601 timestamp with an explicit UTC offset, such as `2026-11-16T13:59:00+02:00` or `2026-11-16T11:59:00Z`.
- Missing, malformed, date-only and timezone-free values fail closed. The cutoff itself is treated as closed.

Migration: previously confirmed records without this field remain in the output but lose the six paid-priority points and paid-pitch eligibility. Recheck the official rules before adding a deadline; do not bulk-fill `rolling`. Discovery already creates unconfirmed records and requires no fabricated deadline.

`qualify(rows, now=aware_datetime)` and `verified_payment_route(row, now=aware_datetime)` allow deterministic replay. The default uses current UTC, once per batch. Naive evaluation clocks raise ValueError.

This gate does not fetch or verify source evidence, make a submission, check payout readiness or prove a reward will be paid. Boolean evidence flags and an active status still need independent official-source verification immediately before any external action. Rolling records can become stale when a program changes its rules.
