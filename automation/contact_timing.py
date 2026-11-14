"""Offline timing review only. Does not authorize or send messages.

Calendar coverage must come from a verified business calendar. This module
cannot establish calendar provenance, complete recipient history, consent,
suppression, Gmail rate-limit status, quota, or a shared sender lock.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from gmail_send_policy import ISRAEL, _utc


@dataclass(frozen=True)
class BusinessCalendar:
    start: date
    end: date
    weekdays: frozenset
    closed_dates: frozenset

    def count_after(self, sent_day, today):
        if any(type(d) is not date for d in (self.start, self.end, sent_day, today)):
            raise ValueError("calendar dates required")
        if not self.start <= sent_day <= today <= self.end:
            raise ValueError("verified calendar must cover the whole interval")
        if (not isinstance(self.weekdays, frozenset) or not self.weekdays
                or any(type(n) is not int or not 0 <= n <= 6 for n in self.weekdays)):
            raise ValueError("explicit business weekdays required")
        if (not isinstance(self.closed_dates, frozenset)
                or any(type(d) is not date or not self.start <= d <= self.end
                       for d in self.closed_dates)):
            raise ValueError("closed dates must be within calendar coverage")
        day, count = sent_day, 0
        while day < today:
            day += timedelta(days=1)
            count += day.weekday() in self.weekdays and day not in self.closed_dates
        return count


def timing_blockers(*, last_sent_at, now, unsolicited, follow_up, calendar=None):
    """Return timing blockers, never permission to send.

    last_sent_at is the latest outgoing message across all agents to the
    verified recipient, not the latest message from the current campaign.
    No prior outgoing history is represented by None only after a complete
    recipient search. A response to an incoming request is not a follow-up.
    An empty result means only that these timing constraints passed.
    """
    current = _utc(now)
    if type(unsolicited) is not bool or type(follow_up) is not bool:
        raise ValueError("explicit contact classification required")
    if last_sent_at is None:
        if follow_up:
            raise ValueError("follow-up requires previous outgoing history")
        return ()
    elapsed = current - _utc(last_sent_at)
    if elapsed < timedelta(0):
        raise ValueError("outgoing history cannot be in the future")
    reasons = []
    if unsolicited and elapsed < timedelta(hours=72):
        reasons.append("unsolicited_repeat_within_72_hours")
    if follow_up:
        if not isinstance(calendar, BusinessCalendar):
            raise ValueError("verified business calendar required for follow-up")
        sent_local, now_local = last_sent_at.astimezone(ISRAEL), now.astimezone(ISRAEL)
        days = calendar.count_after(sent_local.date(), now_local.date())
        # Conservatively preserve the send's local clock on the second
        # business date; merely crossing midnight does not complete that day.
        if (now_local.date().weekday() in calendar.weekdays
                and now_local.date() not in calendar.closed_dates
                and now_local.time() < sent_local.time()):
            days -= 1
        if days < 2:
            reasons.append("follow_up_before_two_business_days")
    return tuple(reasons)
