"""Tests for public evidence qualification. No network calls."""
import unittest
from qualify import qualify, verified_payment_route

BASE={
    'company':'Google',
    'issue_url':'https://github.com/google/adk-go/issues/2267',
    'problem':'memory aliasing',
    'source_status':'open',
    'paid_route':'confirmed',
    'paid_route_status':'active',
    'paid_route_verified':'true',
    'paid_route_url':'https://bughunters.google.com/',
    'issue_in_scope':'true',
    'eligibility_verified':'true'
}

class PaymentEvidenceTests(unittest.TestCase):
    def test_explicit_confirmed_route(self):
        self.assertTrue(verified_payment_route(BASE))
    def test_unverified_scope(self):
        self.assertFalse(verified_payment_route({**BASE,'issue_in_scope':'false'}))
    def test_unverified_eligibility(self):
        self.assertFalse(verified_payment_route({**BASE,'eligibility_verified':'false'}))
    def test_missing_source(self):
        self.assertFalse(verified_payment_route({**BASE,'paid_route_url':''}))
    def test_non_https(self):
        self.assertFalse(verified_payment_route({**BASE,'paid_route_url':'http://bughunters.google.com/'}))
    def test_lookalike_host(self):
        self.assertFalse(verified_payment_route({**BASE,'paid_route_url':'https://google.com.evil.example/'}))
    def test_unconfirmed_route(self):
        self.assertFalse(verified_payment_route({**BASE,'paid_route':'not confirmed'}))
    def test_inactive_or_unverified_program(self):
        for status in ('closed', 'completed', 'paused', 'unknown', '', None):
            with self.subTest(status=status):
                row={**BASE, 'paid_route_status':status}
                self.assertFalse(verified_payment_route(row))
                self.assertFalse(qualify([row])[0]['eligible_for_paid_pitch'])
        row={k:v for k,v in BASE.items() if k!='paid_route_status'}
        self.assertFalse(verified_payment_route(row))
    def test_closed_issue_does_not_mean_closed_program(self):
        self.assertTrue(verified_payment_route({**BASE,'source_status':'closed'}))
    def test_active_program_still_requires_scope(self):
        self.assertFalse(verified_payment_route({**BASE,'issue_in_scope':'false'}))
    def test_duplicate(self):
        self.assertEqual(len(qualify([BASE,BASE])),1)

if __name__=='__main__':
    unittest.main()
