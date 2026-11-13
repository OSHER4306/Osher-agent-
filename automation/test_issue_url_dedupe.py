import unittest
from qualify import qualify

class IssueUrlDedupeTests(unittest.TestCase):
    def row(self, url):
        return dict(company="OpenAI", issue_url=url, problem="example",
                    source_status="open", paid_route="not confirmed")

    def test_case_variants_are_one_issue(self):
        urls = ["https://github.com/OpenAI/Codex/issues/60896",
                "https://github.com/openai/codex/issues/60896",
                "https://github.com/OPENAI/CODEX/issues/60896"]
        result = qualify([self.row(url) for url in urls])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["issue_url"], urls[1])
        self.assertFalse(result[0]["eligible_for_paid_pitch"])

    def test_distinct_repository_or_number_remains_distinct(self):
        urls = ["https://github.com/openai/codex/issues/60896",
                "https://github.com/openai/codex/issues/60897",
                "https://github.com/openai/other/issues/60896"]
        self.assertEqual(len(qualify([self.row(url) for url in urls])), 3)

    def test_normalization_is_idempotent(self):
        first = qualify([self.row("https://github.com/OpenAI/Codex/issues/60896")])
        self.assertEqual(qualify(first), first)

if __name__ == "__main__":
    unittest.main()
