"""Offline account-wide quota preflight. Never authorizes or sends email.

The caller must obtain fresh, complete Gmail SENT snapshots under a shared
account lock. This module cannot prove their provenance or enforce that lock.
"""
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

ISRAEL = ZoneInfo("Asia/Jerusalem")
MAX_SNAPSHOT_AGE = timedelta(seconds=30)


def _aware(value):
    if not isinstance(value, datetime) or value.utcoffset() is None:
        raise ValueError("timezone-aware datetime required")
    return value


def _utc(value):
    # Direct subtraction/comparison with the same ZoneInfo uses wall time,
    # which loses elapsed time and ordering during a repeated DST hour.
    return _aware(value).astimezone(timezone.utc)


def sent_query(now):
    """Use epoch bounds; include the exact midnight second conservatively."""
    day = _aware(now).astimezone(ISRAEL).date()
    start = datetime.combine(day, time.min, ISRAEL)
    end = datetime.combine(day + timedelta(days=1), time.min, ISRAEL)
    return f"in:sent after:{int(start.timestamp()) - 1} before:{int(end.timestamp())}"


@dataclass(frozen=True)
class Snapshot:
    account_id: str
    query: str
    captured_at: datetime
    # Each page is (requested page token, message IDs, next page token).
    pages: tuple


def verified_count(snapshot, now):
    """Reject filtered, stale, incomplete, cyclic or malformed snapshots."""
    _aware(now)
    if not isinstance(snapshot, Snapshot) or not snapshot.account_id:
        raise ValueError("identified account required")
    age = _utc(now) - _utc(snapshot.captured_at)
    if not timedelta(0) <= age <= MAX_SNAPSHOT_AGE:
        raise ValueError("snapshot must be fresh and not from the future")
    if snapshot.query != sent_query(now):
        raise ValueError("exact current-day account-wide SENT query required")
    if not snapshot.pages:
        raise ValueError("at least one completed page required")
    expected, seen_tokens, ids = None, set(), set()
    for index, page in enumerate(snapshot.pages):
        if not isinstance(page, tuple) or len(page) != 3:
            raise ValueError("invalid page")
        requested, message_ids, next_token = page
        if requested != expected or requested in seen_tokens:
            raise ValueError("missing or repeated page")
        seen_tokens.add(requested)
        if not isinstance(message_ids, (tuple, list)) or any(
            not isinstance(mid, str) or not mid for mid in message_ids
        ):
            raise ValueError("invalid message IDs")
        ids.update(message_ids)
        if next_token is not None and (
            not isinstance(next_token, str) or not next_token
        ):
            raise ValueError("invalid continuation token")
        if (index == len(snapshot.pages) - 1) != (next_token is None):
            raise ValueError("incomplete pagination or pages after completion")
        expected = next_token
    return len(ids)


def review_budget(initial, current, *, run_started_at, now, sent_in_run):
    """Return remaining quota for REVIEW, never permission to send.

    Pure numerical calculation only: use one retained RunQuota instance for
    run-wide stop enforcement. This function has no observation history.
    A date rollover invalidates the run rather than resetting its budget.
    """
    if type(sent_in_run) is not int or sent_in_run < 0:
        raise ValueError("nonnegative integer run count required")
    if _utc(now) < _utc(run_started_at):
        raise ValueError("run cannot start in the future")
    if run_started_at.astimezone(ISRAEL).date() != now.astimezone(ISRAEL).date():
        raise ValueError("restart quota review after local midnight")
    first = verified_count(initial, run_started_at)
    latest = verified_count(current, now)
    if initial.account_id != current.account_id:
        raise ValueError("account mismatch")
    if first >= 20 or latest >= 20:
        return 0
    # Account-wide count must include our own successful sends. Fail closed
    # when observations decrease or omit sends; don't regain deleted quota.
    if latest < first + sent_in_run:
        raise ValueError("inconsistent account-wide sent count")
    return max(0, min(min(5, 20 - first) - sent_in_run, 20 - latest))


class RunQuota:
    """In-memory run checkpoint; retain this same instance for the whole run.

    Still only review quota: no sender, persistence, shared lock or proof of
    snapshot provenance. A dispatcher must retain state under its account lock
    and must not recreate this object to erase a stop or gain a new allowance.
    """

    def __init__(self, initial, *, run_started_at):
        self._initial = initial
        self._started = run_started_at
        self._highest = verified_count(initial, run_started_at)
        self._sent = 0
        self._last_now = _utc(run_started_at)
        self._stopped = self._highest >= 20

    @property
    def stopped(self):
        return self._stopped

    def observe(self, current, *, now, sent_in_run):
        if self._stopped:
            return 0
        budget = review_budget(self._initial, current,
                               run_started_at=self._started, now=now,
                               sent_in_run=sent_in_run)
        latest = verified_count(current, now)
        # Once a valid account-wide count reaches 20, no later observation
        # (including a lower count after deletion) may reopen this run.
        if latest >= 20:
            self._stopped = True
            return 0
        if _utc(now) < self._last_now:
            raise ValueError("observations cannot go backwards in time")
        if sent_in_run < self._sent:
            raise ValueError("run send count cannot decrease")
        if latest < self._highest + sent_in_run - self._sent:
            raise ValueError("decreasing count or missing new run sends")
        self._highest = latest
        self._sent = sent_in_run
        self._last_now = _utc(now)
        return budget
