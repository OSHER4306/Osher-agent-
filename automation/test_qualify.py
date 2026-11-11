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
if __name__=='__main__':unittest.main()
