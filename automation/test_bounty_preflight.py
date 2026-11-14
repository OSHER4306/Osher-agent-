import unittest
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from bounty_preflight import review_pages


def bounty(**changes):
    return {'_id': 'synthetic_task', 'version': 1, 'flow': 'claim',
            'status': 'open', 'currency': 'usd', 'payout_cents': 1000,
            'budget_cents': None, 'amount_cents': 1100, **changes}


def page(rows, more=False, cursor=''):
    return {'bounties': rows, 'has_more': more, 'next_cursor': cursor}


class PreflightTests(unittest.TestCase):
    def test_cli_reads_an_export_without_dispatching(self):
        with tempfile.TemporaryDirectory() as directory:
            export = Path(directory) / 'pages.json'
            export.write_text(json.dumps([page([bounty()])]), encoding='utf-8')
            result = subprocess.run([sys.executable, str(Path(__file__).with_name('bounty_preflight.py')),
                                     str(export)], capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report['unique_bounties'], 1)
            self.assertEqual(report['external_actions'], 0)

    def test_cli_invalid_input_fails_without_echoing_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            export = Path(directory) / 'invalid.json'
            export.write_text('private-sentinel invalid json', encoding='utf-8')
            result = subprocess.run([sys.executable, str(Path(__file__).with_name('bounty_preflight.py')),
                                     str(export)], capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 1)
            self.assertNotIn('private-sentinel', result.stdout + result.stderr)

    def test_payout_is_not_buyer_total_or_collected_cash(self):
        result = review_pages([page([bounty()])])
        self.assertEqual(result['review_candidates'][0]['payout_cents'], 1000)
        self.assertNotIn('amount_cents', result['review_candidates'][0])
        self.assertEqual(result['verified_earnings_cents'], 0)
        self.assertEqual(result['external_actions'], 0)

    def test_bid_budget_is_not_a_guaranteed_payout(self):
        result = review_pages([page([bounty(flow='bid', payout_cents=None, budget_cents=50000)])])
        self.assertIsNone(result['review_candidates'][0]['payout_cents'])
        self.assertTrue(result['review_candidates'][0]['requires_fresh_detail_and_eligibility_check'])

    def test_test_work_never_becomes_cash_candidate(self):
        result = review_pages([page([bounty(test=True, payout_cents=50000)])])
        self.assertEqual(result['review_candidates'], [])

    def test_short_and_empty_pages_do_not_end_discovery(self):
        pages = [page([], True, 'opaque:a'), page([bounty()], True, 'opaque:b'),
                 page([bounty(), bounty(_id='second')])]
        result = review_pages(pages)
        self.assertEqual(len(result['review_candidates']), 2)
        self.assertEqual(result['duplicate_records'], 1)

    def test_new_version_cancels_stale_open_candidate(self):
        result = review_pages([page([bounty(), bounty(version=2, status='claimed'), bounty()])])
        self.assertEqual(result['review_candidates'], [])

    def test_conflicting_same_version_terms_are_rejected(self):
        with self.assertRaises(ValueError):
            review_pages([page([bounty(), bounty(payout_cents=2000)])])

    def test_incomplete_repeated_or_deprecated_pagination_rejected(self):
        invalid = [[], [page([], True, 'a')], [page([]), page([])],
                   [page([], True, 'a'), page([], True, 'a'), page([])],
                   [{'bounties': [], 'is_done': True, 'next_cursor': ''}]]
        for pages in invalid:
            with self.subTest(pages=pages), self.assertRaises(ValueError):
                review_pages(pages)

    def test_malformed_money_and_identity_fail_closed(self):
        for changes in ({'version': True}, {'payout_cents': True}, {'payout_cents': -1},
                        {'payout_cents': '1000'}, {'budget_cents': 1.5}, {'_id': ''}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                review_pages([page([bounty(**changes)])])
        missing = bounty()
        del missing['payout_cents']
        with self.assertRaises(ValueError):
            review_pages([page([missing])])


if __name__ == '__main__':
    unittest.main()
