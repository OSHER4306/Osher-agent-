# Enterprise Fixer — Batch 001 (2026-11-12)

**Operating rules:** Public issue ≠ independently verified bug, procurement approval, or paid contract. No unsolicited repeated issue comments. No paid work claimed. Technical reproduction before offering a patch.

| Company | Public project | Evidence | Problem reported | Proposed measurable deliverable | Status |
|---|---|---|---|---|---|
| Google | ADK Go | https://github.com/google/adk-go/issues/2267 | In-memory memory service leaks mutable references, allowing stale keyword index and data race | Minimal test, deep-copy fix, race test, benchmarks | Qualified, not reproduced |
| Google | ADK Go | https://github.com/google/adk-go/issues/2263 | LLMClassifier discards usage metadata | Failing unit test and metadata-preserving patch | Needs technical triage |
| Google | ADK Go | https://github.com/google/adk-go/issues/2262 | Live grounding metadata dropped | Integration regression test, patch | Needs technical triage |
| Google | Gemini JS SDK | https://github.com/googleapis/js-genai/issues/2081 | Quadratic stream parsing of large events; PR already linked (#2080) | Verify whether existing PR resolves; do not duplicate work | Existing PR, deprioritize |
| Microsoft | Playwright | https://github.com/microsoft/playwright/issues/44052 | connectOverCDP may hang on busy renderer | Minimal CDP repro, bounded timeout tests | Qualified, not reproduced |
| Microsoft | Playwright | https://github.com/microsoft/playwright/issues/44053 | High CPU cost of tracing | Performance baseline and profiling, scoped optimization proposal | Needs technical triage |
| Microsoft | Playwright | https://github.com/microsoft/playwright/issues/44041 | Forced colors lost in full-page screenshots | Visual regression fixture, investigate capture path | Needs technical triage |
| OpenAI | Codex | https://github.com/openai/codex/issues/36889 | Bug-report entry not discoverable | Accessible Help menu entry and privacy-first opt-in diagnostics | Initial public comment posted previously |

## First execution sprint
1. Pick Google ADK Go #2267 and Microsoft Playwright #44052 for focused reproduction.
2. Verify upstream current code, maintainer responses, existing PRs, contributor rules and licensing.
3. Build minimal test with no secrets or third-party targeting.
4. If fix confirmed and maintainers accept external contribution, open scoped PR.
5. Seek compensation only through official contractor/procurement/bounty channels. Do not monetize a GitHub issue by demanding payment to fix it.

## Outreach identity
Independent AI/software fixer: I identify consequential problems, reproduce them responsibly, and deliver tested solutions. I want to create value and earn a living through authorized paid engineering engagements.

## Metrics
Identified companies: 3 (Google, Microsoft, OpenAI)
Documented issue opportunities: 8
Verified technical fixes completed: 0
New outreach messages sent in this batch: 0
Paid engagements signed: 0
Collected revenue: ₪0
