import unittest
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from contact_timing import BusinessCalendar, timing_blockers

UTC = timezone.utc


def dt(value):
    return datetime.fromisoformat(value)


def calendar(closed=()):
    # Explicit fictional calendar: Sun-Thu, with supplied closure dates.
    # This is test data, not a verified Israeli holiday calendar.
    return BusinessCalendar(date(2026, 1, 1), date(2026, 12, 31),
                            frozenset((6, 0, 1, 2, 3)), frozenset(closed))


class ContactTimingTests(unittest.TestCase):
    def review(self, sent, now, unsolicited=True, follow_up=False, cal=None):
        return timing_blockers(last_sent_at=sent, now=now,
                               unsolicited=unsolicited, follow_up=follow_up,
                               calendar=cal)

    def test_72_hour_boundary(self):
        sent = dt('2026-11-10T10:00:00+02:00')
        self.assertTrue(self.review(sent, sent + timedelta(hours=72, microseconds=-1)))
        self.assertEqual(self.review(sent, sent + timedelta(hours=72)), ())

    def test_weekend_does_not_count_as_business_days(self):
        sent = dt('2026-11-12T10:00:00+02:00')  # Thursday
        self.assertIn('follow_up_before_two_business_days', self.review(
            sent, dt('2026-11-15T11:00:00+02:00'), follow_up=True, cal=calendar()))
        self.assertEqual(self.review(sent, dt('2026-11-16T11:00:00+02:00'),
                                     follow_up=True, cal=calendar()), ())

    def test_verified_closure_delays_follow_up(self):
        sent = dt('2026-11-12T10:00:00+02:00')
        self.assertTrue(self.review(sent, dt('2026-11-16T11:00:00+02:00'),
            follow_up=True, cal=calendar((date(2026, 11, 15),))))

    def test_two_business_days_do_not_override_72_hours(self):
        sent = dt('2026-11-09T10:00:00+02:00')
        self.assertEqual(self.review(sent, sent + timedelta(hours=48),
            follow_up=True, cal=calendar()), ('unsolicited_repeat_within_72_hours',))

    def test_requested_reply_is_not_treated_as_unsolicited_follow_up(self):
        sent = dt('2026-11-14T10:00:00+02:00')
        self.assertEqual(self.review(sent, sent + timedelta(minutes=1),
                                     unsolicited=False), ())

    def test_follow_up_without_calendar_or_coverage_fails_closed(self):
        sent = dt('2026-11-12T10:00:00+02:00')
        for cal in (None, BusinessCalendar(date(2026, 11, 13), date(2026, 11, 30),
                                            frozenset((0,)), frozenset())):
            with self.assertRaises(ValueError):
                self.review(sent, sent + timedelta(days=4), follow_up=True, cal=cal)

    def test_first_contact_and_inconsistent_follow_up(self):
        now = dt('2026-11-14T10:00:00+02:00')
        self.assertEqual(self.review(None, now), ())
        with self.assertRaises(ValueError):
            self.review(None, now, follow_up=True, cal=calendar())

    def test_bad_flags_future_and_naive_times_fail_closed(self):
        now = dt('2026-11-14T10:00:00+02:00')
        for sent in (now + timedelta(seconds=1), now.replace(tzinfo=None)):
            with self.assertRaises(ValueError):
                self.review(sent, now)
        with self.assertRaises(ValueError):
            self.review(now, now, unsolicited=1)

    def test_dst_72_hours_uses_elapsed_time(self):
        zone = ZoneInfo('Asia/Jerusalem')
        sent = datetime(2026, 3, 26, 12, tzinfo=zone)
        # Three calendar days here are only 71 elapsed hours.
        now = datetime(2026, 3, 29, 12, tzinfo=zone)
        self.assertTrue(self.review(sent, now))
        self.assertEqual(self.review(sent, datetime(2026, 3, 29, 13, tzinfo=zone)), ())

    def test_calendar_uses_jerusalem_dates(self):
        sent = dt('2026-11-11T22:00:00+00:00')  # Thu 00:00 Israel
        now = dt('2026-11-15T22:01:00+00:00')  # Mon 00:01 Israel
        self.assertEqual(self.review(sent, now, follow_up=True, cal=calendar()), ())

    def test_second_business_day_midnight_is_not_enough(self):
        sent = dt('2026-11-12T23:59:00+02:00')
        for iso in ('2026-11-16T00:00:00+02:00', '2026-11-16T23:58:59+02:00'):
            self.assertIn('follow_up_before_two_business_days', self.review(
                sent, dt(iso), follow_up=True, cal=calendar()))
        self.assertEqual(self.review(sent, dt('2026-11-16T23:59:00+02:00'),
                                     follow_up=True, cal=calendar()), ())

    def test_two_completed_days_still_pass_on_later_closed_day(self):
        sent = dt('2026-11-12T23:59:00+02:00')
        self.assertEqual(self.review(sent, dt('2026-11-17T00:00:00+02:00'),
            follow_up=True, cal=calendar((date(2026, 11, 17),))), ())

    def test_invalid_calendar_inputs_fail(self):
        for weekdays, closed in ((frozenset((7,)), frozenset()),
                                  (frozenset((True,)), frozenset()),
                                  (frozenset((0,)), frozenset((date(2027, 1, 1),)))):
            cal = BusinessCalendar(date(2026, 1, 1), date(2026, 12, 31), weekdays, closed)
            with self.assertRaises(ValueError):
                cal.count_after(date(2026, 11, 12), date(2026, 11, 16))


if __name__ == '__main__':
    unittest.main()
