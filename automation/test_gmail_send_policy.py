import unittest
from datetime import datetime, timedelta, timezone
from gmail_send_policy import Snapshot, sent_query, verified_count, review_budget

NOW = datetime(2026, 11, 14, 10, 20, tzinfo=timezone.utc)


def snap(count=0, at=NOW, **changes):
    fields = dict(account_id="test-account", query=sent_query(at), captured_at=at,
                  pages=((None, tuple(f"m{i}" for i in range(count)), None),))
    fields.update(changes)
    return Snapshot(**fields)


class SendPolicyTests(unittest.TestCase):
    def budget(self, first, latest, sent=0):
        return review_budget(snap(first), snap(latest), run_started_at=NOW,
                             now=NOW, sent_in_run=sent)

    def test_real_run_over_cap_is_blocked(self):
        self.assertEqual(self.budget(38, 38), 0)

    def test_cap_and_per_run_limits(self):
        for first, latest, sent, expected in (
            (0, 0, 0, 5), (19, 19, 0, 1), (18, 19, 1, 1),
            (0, 5, 5, 0), (20, 20, 0, 0), (19, 20, 0, 0),
        ):
            with self.subTest(first=first, latest=latest, sent=sent):
                self.assertEqual(self.budget(first, latest, sent), expected)

    def test_other_agents_reduce_remaining_quota(self):
        self.assertEqual(self.budget(0, 19), 1)

    def test_budget_invariants_for_all_valid_count_combinations(self):
        for first in range(20):
            for sent in range(6):
                for latest in range(first + sent, 25):
                    result = self.budget(first, latest, sent)
                    self.assertGreaterEqual(result, 0)
                    self.assertLessEqual(result, max(0, 5 - sent))
                    self.assertLessEqual(result, max(0, 20 - first - sent))
                    self.assertLessEqual(result, max(0, 20 - latest))

    def test_filtered_query_is_rejected(self):
        with self.assertRaises(ValueError):
            verified_count(snap(query=sent_query(NOW) + " from:me"), NOW)

    def test_pagination_and_unique_ids(self):
        self.assertEqual(verified_count(snap(pages=(
            (None, ["a", "b"], "p2"), ("p2", ["b", "c"], None))), NOW), 3)

    def test_bad_pagination_is_rejected(self):
        for pages in ((), ((None, [], "p2"),), ((None, [], None), ("p2", [], None)),
                      ((None, [], "p2"), ("wrong", [], None)),
                      ((None, [], "p2"), ("p2", [], "p2"), ("p2", [], None)),
                      ((None, "not-an-id-list", None),), ((None, [""], None),)):
            with self.subTest(pages=pages), self.assertRaises(ValueError):
                verified_count(snap(pages=pages), NOW)

    def test_stale_future_and_naive_timestamps_fail(self):
        for at in (NOW - timedelta(seconds=31), NOW + timedelta(seconds=1),
                   NOW.replace(tzinfo=None)):
            with self.subTest(at=at), self.assertRaises(ValueError):
                verified_count(snap(captured_at=at), NOW)

    def test_day_rollover_does_not_reset_run_budget(self):
        later = datetime(2026, 11, 14, 22, 0, tzinfo=timezone.utc)
        with self.assertRaises(ValueError):
            review_budget(snap(), snap(at=later), run_started_at=NOW,
                          now=later, sent_in_run=0)

    def test_account_mismatch_and_inconsistent_counts_fail(self):
        with self.assertRaises(ValueError):
            review_budget(snap(), snap(account_id="other"),
                          run_started_at=NOW, now=NOW, sent_in_run=0)
        for first, latest, sent in ((5, 4, 0), (5, 5, 1)):
            with self.assertRaises(ValueError):
                self.budget(first, latest, sent)

    def test_invalid_run_count_fails(self):
        for count in (-1, True, 1.5):
            with self.assertRaises(ValueError):
                self.budget(0, 0, count)

    def test_epoch_window_matches_local_midnight(self):
        self.assertEqual(sent_query(NOW),
                         "in:sent after:1794607199 before:1794693600")

    def test_dst_days_are_not_assumed_24_hours(self):
        for iso, hours in (("2026-03-27T12:00:00+00:00", 23),
                           ("2026-10-25T12:00:00+00:00", 25)):
            query = sent_query(datetime.fromisoformat(iso))
            start = int(query.split("after:")[1].split()[0]) + 1
            end = int(query.split("before:")[1])
            self.assertEqual(end - start, hours * 3600)


if __name__ == "__main__":
    unittest.main()
