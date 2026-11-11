# Enterprise Fixer — ten-company solution proposals

Research date: 2026-11-12. All issues are third-party reports, not independently reproduced. These are **technical submission-ready drafts**, not submitted PRs or paid engagements. No blanket issue-comment campaign. First verify upstream code and any existing fixes, then prepare a focused test-backed PR. Commercial discussions must use approved vendor/procurement channels.

## 1. OpenAI

- **Issue:** https://github.com/openai/codex/issues/60893
- **Reported problem:** MCP config removal hint may target wrong config layer
- **Proposed technical solution:** Create profile/global collision fixture; include origin layer in removal hint; test that displayed and removed layer match
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.

## 2. Google

- **Issue:** https://github.com/google/adk-go/issues/2267
- **Reported problem:** In-memory service exposes mutable references
- **Proposed technical solution:** Deep-copy at ingestion and retrieval; regression and race tests with synthetic memory
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.

## 3. Microsoft

- **Issue:** https://github.com/microsoft/vscode-dotnettools/issues/3819
- **Reported problem:** Missing runtime is described as missing SDK
- **Proposed technical solution:** Separate SDK and runtime detection; unit tests for dotnetup paths and guidance text
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.

## 4. Cloudflare

- **Issue:** https://github.com/cloudflare/developer-platform/issues/144
- **Reported problem:** Postgres Hyperdrive Close causes protocol error
- **Proposed technical solution:** Reproduce extended-protocol lifecycle locally; validate Close message state transitions
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.

## 5. AWS

- **Issue:** https://github.com/aws/aws-cli/issues/10880
- **Reported problem:** CRT transfer manager memory grows with S3 sync object count
- **Proposed technical solution:** Synthetic large-object listing benchmark; heap profile; bounded metadata retention
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.

## 6. Apple

- **Issue:** https://github.com/apple/coremltools/issues/2920
- **Reported problem:** FP16 triangular mask yields NaNs with negative infinity
- **Proposed technical solution:** Add flexible-shape FP16 regression; preserve -inf mask semantics during lowering
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.

## 7. HashiCorp

- **Issue:** https://github.com/hashicorp/terraform-provider-aws/issues/50898
- **Reported problem:** Bedrock model-as-judge task type enum validation
- **Proposed technical solution:** Compare AWS API allowed values; acceptance fixture and provider validation test
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.

## 8. Vercel

- **Issue:** https://github.com/vercel/eve/issues/6232
- **Reported problem:** Bun fetch ignores undici dispatcher
- **Proposed technical solution:** Test runtime-specific dispatcher enforcement; avoid silently bypassing public-only lookup
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.

## 9. Elastic

- **Issue:** https://github.com/elastic/kibana/issues/304877
- **Reported problem:** Rule create can duplicate after origin update failure
- **Proposed technical solution:** Idempotency key / deterministic rule ID; failure injection and retry tests
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.

## 10. Stripe

- **Issue:** https://github.com/stripe/stripe-ruby/issues/2027
- **Reported problem:** Retry setting zero does not prevent Net::HTTP GET replay
- **Proposed technical solution:** Instrument Ruby Net::HTTP retry behavior; set max_retries consistently and regression-test read timeouts
- **Acceptance criteria:** Deterministic isolated reproduction, failing test before patch, passing test after patch, no regression in existing suite.
- **Suggested maintainer note:** “I reviewed this report and can help with a minimal reproduction and a narrowly scoped fix. Would a tested external PR be welcome? I have not independently reproduced the issue yet.”
- **Paid route:** Not verified. Seek authorized contractor/bounty program separately; public GitHub contribution does not imply payment.
- **Status:** Draft prepared; no outreach sent for this item.
