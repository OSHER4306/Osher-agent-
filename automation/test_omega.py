import unittest
from omega import Candidate,score,choose,monte_carlo,adversarial_check

class OmegaTests(unittest.TestCase):
    def test_invalid(self):
        with self.assertRaises(ValueError):score(Candidate('x',2,0,0,0))
    def test_weak_evidence(self):
        self.assertIn('weak evidence',adversarial_check(Candidate('x',.9,.2,.1,.1)))
    def test_high_risk(self):
        self.assertIsNone(choose([Candidate('x',.9,.2,.9,.9)]))
    def test_prefer_tested(self):
        a=Candidate('tested',.9,.2,.1,.9)
        b=Candidate('cheap',.3,.1,.1,.7)
        self.assertEqual(choose([a,b]).name,'tested')
    def test_determinism(self):
        c=[Candidate('a',.9,.2,.1,.9),Candidate('b',.7,.3,.2,.8)]
        self.assertEqual(monte_carlo(c,100,4),monte_carlo(c,100,4))
    def test_duplicates(self):
        with self.assertRaises(ValueError):choose([Candidate('a',.5,.2,.1,.9)]*2)
    def test_empty(self):
        with self.assertRaises(ValueError):choose([])

if __name__=='__main__':unittest.main()
