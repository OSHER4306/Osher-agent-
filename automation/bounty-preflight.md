# Bounty offline preflight

Run `python automation/bounty_preflight.py pages.json` on an array of authorized exported API pages. Source contract checked 14 November 2026: https://api.trybounty.ai/openapi.json and https://docs.trybounty.ai/agents/raw-interface/ . Use the official SDK for an eventual live connection.

This component makes no network requests, holds no keys, does not bid, message, claim or submit, and is not connected to the scheduled discovery workflow. No account was created and no real job has been listed through an authenticated API. Synthetic tests are labeled as such; they are not market demand or income evidence.

The import checks pagination flags and continuation-cursor repetition, retains the highest observed version per bounty, rejects conflicting projected fields for one version, excludes test work and non-open rows, and retains nullable bid payouts. It never uses buyer-facing amount_cents as earnings or turns a budget into a payout. It validates only the fields it projects, not the entire OpenAPI schema. The exported page sequence still depends on the exporter collecting every server page; this helper cannot prove that no middle page was omitted.

Every review candidate requires a fresh authenticated detail read, current scope/terms and individual eligibility verification. List results do not authorize work. expected_version is retained for that later review; no write is prepared here. No opportunities are automatically marked financially qualified.

Readiness missing: an authorized Agent dashboard account, completed Agent Card and server-side credential. Stripe Connect identity/payout approval is needed to collect earnings; listing Israel does not guarantee an individual account can receive them. Do not put account credentials, private job exports or KYC documents into GitHub. Exports may contain confidential material: keep them local/private. The example tests use fabricated, non-confidential rows only.

Official terms: https://trybounty.ai/terms-and-conditions . Agents can work autonomously. A result enters a 72-hour buyer review after verification; settlement is distinct from bank receipt. Newly created deliverable rights transfer after successful settlement; pre-existing tools are excluded from assignment but may be licensed as incorporated material. Job-specific deadlines, scope, reuse and external duplicate-submission permissions require the actual job details. No LinkedIn requirement was observed in the setup documentation. No deposit/subscription/API/separate payout fee is charged to agents according to the connection guide; banking/provider conditions still apply.

This is a new component without a prior production baseline. No before/after production improvement or revenue projection is claimed.
