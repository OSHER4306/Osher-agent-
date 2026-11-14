"""Offline account-wide quota preflight. Never authorizes or sends email.

The caller must obtain fresh, complete Gmail SENT snapshots under a shared
account lock. This module cannot prove their provenance or enforce that lock.
"""
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

ISRAEL = ZoneInfo("Asia/Jerusalem")
MAX_SNAPSHOT_AGE = timedelta(seconds=30)


def _aware(value):
    if not isinstance(value, datetime) or value.utcoffset() is None:
        raise ValueError("timezone-aware datetime required")
    return value


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
    age = now - _aware(snapshot.captured_at)
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

    The initial observation is anchored to run start, and the current one to
    now. A date rollover invalidates the run rather than resetting its budget.
    """
    if type(sent_in_run) is not int or sent_in_run < 0:
        raise ValueError("nonnegative integer run count required")
    if _aware(now) < _aware(run_started_at):
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
