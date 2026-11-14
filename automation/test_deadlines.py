"""An active program must also have an open, explicit submission window."""
import unittest
from datetime import datetime, timezone
from qualify import qualify
from test_payment_evidence import BASE

NOW = datetime(2026, 11, 14, 0, 0, tzinfo=timezone.utc)

class DeadlineTests(unittest.TestCase):
    def test_expired_active_program_is_not_eligible(self):
        row = {**BASE, 'paid_route_deadline': '2000-01-01T00:00:00Z'}
        self.assertFalse(qualify([row])[0]['eligible_for_paid_pitch'])

    def test_unknown_window_is_not_eligible(self):
        row = {k: v for k, v in BASE.items() if k != 'paid_route_deadline'}
        self.assertFalse(qualify([row])[0]['eligible_for_paid_pitch'])

    def test_cutoff_and_timezone_equivalence(self):
        for cutoff in ('2026-11-14T00:00:00Z', '2026-11-14T02:00:00+02:00',
                       '2026-11-13T19:00:00-05:00'):
            with self.subTest(cutoff=cutoff):
                row = {**BASE, 'paid_route_deadline': cutoff}
                self.assertFalse(qualify([row], now=NOW)[0]['eligible_for_paid_pitch'])

    def test_before_cutoff_and_expiry_remove_paid_priority(self):
        row = {**BASE, 'paid_route_deadline': '2026-11-14T00:00:01Z'}
        before = qualify([row], now=NOW)[0]
        after = qualify([row], now=datetime(2026, 11, 14, 0, 0, 1, tzinfo=timezone.utc))[0]
        self.assertTrue(before['eligible_for_paid_pitch'])
        self.assertFalse(after['eligible_for_paid_pitch'])
        self.assertEqual(before['priority_score'] - after['priority_score'], 6)
        self.assertEqual(before['issue_url'], after['issue_url'])

    def test_malformed_and_ambiguous_windows_fail_closed(self):
        for cutoff in ('', None, 0, [], 'tomorrow', '2026-11-14',
                       '2026-11-14T12:00:00', '2026-13-14T00:00:00Z'):
            with self.subTest(cutoff=cutoff):
                row = {**BASE, 'paid_route_deadline': cutoff}
                self.assertFalse(qualify([row], now=NOW)[0]['eligible_for_paid_pitch'])

    def test_rolling_still_requires_other_evidence(self):
        row = {**BASE, 'paid_route_deadline': ' ROLLING '}
        self.assertTrue(qualify([row], now=NOW)[0]['eligible_for_paid_pitch'])
        self.assertFalse(qualify([{**row, 'issue_in_scope': 'false'}], now=NOW)[0]['eligible_for_paid_pitch'])

    def test_naive_evaluation_time_is_rejected(self):
        with self.assertRaises(ValueError):
            qualify([BASE], now=datetime(2026, 11, 14))

if __name__ == '__main__':
    unittest.main()
