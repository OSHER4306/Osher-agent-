# Account-wide Gmail quota preflight

This offline module implements the numerical portion of the user's 14 November
2026 order: at most 20 account-wide sent messages per Jerusalem calendar day,
and at most min(5, 20 - count at run start) per run. A fresh account-wide count
also limits the remaining review budget when other agents have sent messages.

`review_budget` is a quota calculation, not send permission. No sender imports
this module yet. No email, draft, API request, reservation, or lock is created.

Run-wide enforcement requires one retained `RunQuota` instance. Its `observe`
method latches a stop after any valid account-wide count reaches 20. Later
counts of 19 or 14 cannot reopen that run. Before the cap is reached, decreasing
intermediate counts, decreasing run-send counters, missing newly reported run
sends, and backwards observation times are rejected. The pure `review_budget`
function has no history and must not be used by itself as a run-level guard.
This checkpoint is in memory only; recreating it loses history. The dispatcher
must retain it under its shared lock and persist it if a run can resume later.

The caller must hold a shared account lock while fetching all pages, checking
SENT/INBOX/DRAFT for the recipient, applying failed/refused suppression, the
72-hour outreach interval, two-business-day follow-up interval, and rate-limit
status, and sending one message if every check permits it. Recheck for each
message. The snapshots here cannot prove API provenance, missing data inside a
returned page, or prevent another agent acting outside that lock.

Snapshots require an identified account, the exact unfiltered SENT query, a
continuous page-token chain ending without a continuation, and unique message
IDs. They expire after 30 seconds (a conservative implementation choice).
Account mismatches, decreasing counts, missing own sends, date rollovers,
future timestamps, and incomplete evidence fail closed with ValueError.
Freshness and chronological comparisons normalize to UTC so the repeated
autumn hour cannot make an old or future snapshot appear current.

Epoch bounds use Jerusalem local midnight independently for both dates, so DST
days can be 23 or 25 hours. The query starts one second early to conservatively
include the exact midnight second. This can only reduce review budget; it must
not be used as a reason to discard a counted message or loosen the quota.

## Reproducible experiment — 14 November 2026, 12:19 Israel run

Run `python -m unittest discover -s automation -p 'test_gmail_send_policy.py' -v`.

The first implementation returned 5 remaining when a run began at 0 sent and
another agent raised the account count to 19. The regression test failed
(expected 1, got 5). The corrected implementation additionally caps remaining
budget by `20 - latest account count`.

All 13 test methods then passed locally (0.066 seconds). An exhaustive bounded
matrix checks nonnegative budget and all three upper bounds for valid initial,
current and run counts. Other cases cover actual observed count 38 => 0,
duplicate IDs, incomplete/cyclic pagination, filtered queries, freshness,
account mismatch, inconsistent counts, Israel midnight and both 2026 DST days.
This is local Python verification, not GitHub Actions or production deployment.

## Other routes checked during this run

- Account-wide Gmail SENT: 38 unique message IDs, one complete page, query
  `in:sent after:1794607200 before:1794693600`; zero sends attempted. Latest B2B
  automation result also reported 38 and no new B2B replies. No parallel sending
  requested. Recent incoming-mail searches returned no new messages.
- [Taskmarket](https://taskmarket.dev/tasks?status=open): five displayed tasks;
  TOC coding task has 104 submissions for $0.50, sales analysis has 91 for
  $0.50, Lumen marketing has 34 for $5, two FLAPJAX first-timer tasks. Token
  quantity/display valuation is not collected cash. No account, submission,
  payment, external promotion or wallet operation created.
- [tscircuit contributor program](https://github.com/tscircuit/tscircuit/blob/main/docs/CONTRIBUTOR_PROGRAM.md)
  describes $5–400/month, four contributions and Discord. The current
  [calculation document](https://github.com/tscircuit/contribution-tracker/blob/main/docs/sponsorship-calculation-explanation.md)
  describes $10–700 base tiers and maintainer bonuses. These documents differ;
  neither establishes a fixed reward for our work, eligibility or payout setup.
  [Onboarding issue 358](https://github.com/tscircuit/contribution-tracker/issues/358)
  has 11 comments from prospective contributors and no maintainer answer in the
  retrieved discussion. No repetitive onboarding question posted. AI use,
  Israel eligibility, individual onboarding/payment, exclusivity and duplicate
  payment conditions remain unverified. No vendor contribution submitted.

Run accounting: 2 new code/test files plus this report; 13 local test methods
pass; 0 Gmail sends; 0 external technical submissions; 0 merged PRs; 0 paid
proposals/contracts/invoices; ILS 0 verified collected. Any draft PR in this
repository is internal engineering and does not establish bounty eligibility.

Next: review and integrate with a genuinely shared dispatcher only after its
locking, recipient history and rate-limit evidence can be verified. Existing
GitHub billing blocker is not repaired or bypassed by this change. Continue
qualified paid-route research and existing warm deals without duplicate sends.

## Independent review and correction — 13:16 Israel run

Review of baseline commit f2bc50c3f1b337c5fcb981ceaf8ce48cd51361f0
reproduced two defects before integration:

1. Same-run observations 20, 19, 14 could return budgets 0, 1, 5. The pure
   calculation forgot the intermediate count. Retained `RunQuota` now latches
   a stop for the whole run and rejects decreasing intermediate observations
   and own-send counts. The pure function remains a calculation only.
2. On 25 October 2026, captured 01:30 +03:00 (fold=0) and now 01:30 +02:00
   (fold=1) were 3,600 seconds apart, but Python wall-time subtraction returned
   zero. UTC normalization now rejects that stale snapshot, a future snapshot
   across the repeated hour, and a future run start. A genuinely fresh snapshot
   crossing the repeated hour still passes.

Seven initial regressions against the old code yielded 3 failed assertions and
4 missing-wrapper import errors (20 total methods). Two further controls were
added. Final verification: all 22 methods pass, including a separate root-agent
rerun in 0.055 seconds. No sender integration, shared production lock, persisted
run checkpoint, deployment or GitHub Actions pass is established. A dispatcher
must preserve the wrapper state rather than recreating it after a stop.

No new PR was opened in this run; the existing internal draft PR #5 is updated.
External technical submissions, merges, sends, proposals, contracts, invoices and
verified collected ILS remain zero. Fresh route screening is recorded separately
in funding/route-screening-2026-11-14-1316.json.
