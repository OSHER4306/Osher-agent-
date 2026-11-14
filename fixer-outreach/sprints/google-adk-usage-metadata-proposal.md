# Google ADK Go — scoped fix proposal

Issue: https://github.com/google/adk-go/issues/2263
Reported problem: `LLMClassifier.Classify` drops `UsageMetadata` from the underlying model response. **Not independently reproduced**.

## Why it matters
Users may be unable to attribute token usage and costs to classification calls without custom model wrappers, making accounting and observability harder.

## Proposed minimal patch
1. Inspect `classifier.Response` and `LLMClassifier.Classify` on current upstream main and linked PRs.
2. Add optional `UsageMetadata` to the classifier response using the existing genai/model type if API compatibility allows; document field behavior for nil usage.
3. Thread the model response metadata through successful classification without mutating or reinterpreting it.
4. Add a deterministic fake-model unit test with synthetic usage values and a second test for absent metadata.
5. Run relevant Go tests and linters; check backwards compatibility and request maintainer review.

## Acceptance criteria
- Classifier returns exactly the model-provided usage values when available.
- Missing usage is handled safely.
- No changes to classification output semantics.
- No external API calls, credentials, or billable inference required by tests.

## Paid engagement
This is an unsolicited technical proposal, **not** a paid order or a bounty claim. If the maintainers approve an external contribution, provide a patch for review. For paid work, seek an official procurement/contractor engagement separately. Suggested scoping offer: paid diagnosis and test harness, then milestone-based implementation if authorized.

## Honest status
Problem sourced: yes. Reproduction: not yet. Patch: not yet. PR: not yet. Payment: none.


## Recheck 14 November 2026 — do not duplicate
Issue #2263 is still open. A maintainer has already posted a fake-model reproduction and linked the proposed fix:
https://github.com/google/adk-go/issues/2263#issuecomment-6799241455

Upstream PR #2264 is open and unmerged at head ffb3a527cff3ccdf56306da1ff860734264d88d4:
https://github.com/google/adk-go/pull/2264
Its author reports usage propagation, JSON round-trip coverage and passing race/build checks. Those are the author's test claims, not tests run by this workflow.

The earlier minimal patch and test plan now overlaps that PR. Status: defer; do not implement or submit a duplicate. Revisit only for a demonstrated gap after reading the actual patch and current maintainer feedback.

Local command check: `go version` exited 1 with “Go: Unknown option: version”; no compatible Go compiler was verified. No Google ADK tests, live model calls or independent reproduction were completed here. No source fix, technical comment, PR, bounty eligibility or income is claimed.
