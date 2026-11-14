import unittest
from qualify import qualify
class Tests(unittest.TestCase):
    def test_dedupe(self):
        r={'company':'OpenAI','issue_url':'https://github.com/openai/codex/issues/60896','problem':'path parsing','source_status':'open','paid_route':'not confirmed'}
        self.assertEqual(len(qualify([r,r])),1)
    def test_no_unverified_payment(self):
        r={'company':'OpenAI','issue_url':'https://github.com/openai/codex/issues/60896','problem':'path parsing','source_status':'open','paid_route':'not confirmed'}
        self.assertFalse(qualify([r])[0]['eligible_for_paid_pitch'])
    def test_bad_url(self):
        r={'company':'X','issue_url':'https://evil.example/issues/1','problem':'x','source_status':'open','paid_route':'none'}
        self.assertEqual(qualify([r]),[])
    def test_missing(self):
        self.assertEqual(qualify([{'company':'Google'}]),[])
    def test_confirmed_without_evidence_is_not_paid(self):
        r={'company':'Google','issue_url':'https://github.com/google/adk-go/issues/2267','problem':'aliasing','source_status':'open','paid_route':'confirmed'}
        self.assertFalse(qualify([r])[0]['eligible_for_paid_pitch'])
    def test_verified_official_route_is_paid(self):
        r={'company':'Google','issue_url':'https://github.com/google/adk-go/issues/2267','problem':'aliasing','source_status':'open','paid_route':'confirmed','paid_route_verified':'true','paid_route_status':'active','paid_route_deadline':'rolling','paid_route_url':'https://bughunters.google.com/','issue_in_scope':'true','eligibility_verified':'true'}
        self.assertTrue(qualify([r])[0]['eligible_for_paid_pitch'])
    def test_lookalike_domain_is_rejected(self):
        r={'company':'Google','issue_url':'https://github.com/google/adk-go/issues/2267','problem':'aliasing','source_status':'open','paid_route':'confirmed','paid_route_verified':'true','paid_route_status':'active','paid_route_deadline':'rolling','paid_route_url':'https://google.com.evil.example/','issue_in_scope':'true','eligibility_verified':'true'}
        self.assertFalse(qualify([r])[0]['eligible_for_paid_pitch'])

    def test_program_exists_but_issue_not_in_scope(self):
        r={'company':'Google','issue_url':'https://github.com/google/adk-go/issues/2267','problem':'aliasing','source_status':'open','paid_route':'confirmed','paid_route_verified':'true','paid_route_url':'https://bughunters.google.com/','issue_in_scope':'false','eligibility_verified':'true'}
        self.assertFalse(qualify([r])[0]['eligible_for_paid_pitch'])
    def test_eligibility_unverified(self):
        r={'company':'Google','issue_url':'https://github.com/google/adk-go/issues/2267','problem':'aliasing','source_status':'open','paid_route':'confirmed','paid_route_verified':'true','paid_route_url':'https://bughunters.google.com/','issue_in_scope':'true'}
        self.assertFalse(qualify([r])[0]['eligible_for_paid_pitch'])

if __name__=='__main__':unittest.main()

