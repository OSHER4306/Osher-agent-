# Offline recipient contact timing review

The account quota module only calculates numerical allowance. This separate module
adds two necessary recipient timing checks from the user's 14 November order:
72 elapsed hours for unsolicited repeat contact, and at least two business days
before follow-up. These checks do not send, authorize, queue or reserve messages.

Callers must supply the latest outgoing timestamp across all agents and campaigns
for the correctly resolved recipient. None means a complete search found no
previous outgoing message, not missing history. Classification is caller-supplied:
an actual reply to an incoming request is not an unsolicited follow-up. Evidence
of consent, suppression, matching drafts, INBOX/SENT freshness and Gmail rate-limit
state remain mandatory outside this helper.

For follow-up, provide a verified BusinessCalendar covering the entire interval:
explicit Python weekday numbers (Monday=0), coverage bounds, and closure dates.
Tests use fictional Sun-Thu calendars. No Israeli holiday calendar was downloaded
or verified. Missing or insufficient coverage raises ValueError and blocks review.
The helper validates structure, not the calendar's provenance or completeness.

Time comparisons use UTC elapsed time, including DST boundaries. Business dates
and local clock use Asia/Jerusalem. Conservatively, on the second business date
the original send's local clock must have been reached. This avoids counting a
new business day as completed just because midnight passed. Later closed dates
do not erase already completed business days.

## Experiment and adversarial review

Run: python -m unittest discover -s automation -p 'test_contact_timing.py' -v

There are 13 new test methods, covering exact 72-hour boundaries, weekends, explicit
closures, missing calendar coverage, first-contact inconsistencies, malformed
timestamps/classification, DST elapsed time, and Jerusalem dates.

An independent reviewer ran the initial 33 timing-plus-quota methods successfully
but found an untested counterexample: Thursday 23:59 to Monday 00:00 counted as two
business days. The implementation now preserves the send's local clock and adds
regressions at Monday 23:58:59/23:59 and on a later closed date. The combined
13 new timing and 22 existing quota methods pass locally: 35 methods, 0.061s.
No measured production improvement or CI pass is claimed.

This is a standalone offline component. No sender imports it, no production lock
was introduced, no live email was attempted, and no calendar/history adapter was
deployed. Integrating it requires verified data sources and a genuinely shared
dispatcher; an empty blocker tuple is never sufficient permission to send.
