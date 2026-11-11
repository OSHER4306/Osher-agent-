# Enterprise fixer — issue-based outreach (drafts, not sent)

## Positioning

I am an independent AI/software builder and practical **fixer**. I look for high-impact, measurable problems, reproduce them responsibly, and propose small, tested solutions. I want to create real value and make a living doing it. I welcome paid scoping, contractor work, or published bounty programs; I never assume a public issue implies payment.

## Microsoft Edge DevTools — #468

Source: https://github.com/MicrosoftEdge/DevTools/issues/468
Status when checked: open; reporter says Edge DevTools Network panel is unreliable and opening DevTools appears to stall WebSockets and requests. **Not independently reproduced.**

### Proposed work
1. Build a minimal local repro with WebSocket echo + concurrent fetch.
2. Compare browser traffic with DevTools closed/open and docked/undocked, on the affected build.
3. Separate actual networking stall from Network-panel rendering/logging failure.
4. Collect sanitized diagnostics, identify regression and propose a focused patch/test.

### Message draft
Hello Edge DevTools team, I saw issue #468 describing a potentially disruptive regression in Network inspection and WebSocket behavior. I can offer a structured reproduction and regression-analysis effort, with a minimal test case, sanitized traces and a proposed patch if the cause is identified. I work as an independent fixer: I find consequential software problems and turn them into tested solutions. My aim is to deliver value while also earning a living from this work. Is there an approved paid engineering, contractor or bounty pathway for external contributors? If not, could you confirm the relevant code path and whether a community PR would be welcome? I have not reproduced the issue yet and would not claim a fix before verification.

## OpenAI Codex Desktop — #36889

Source: https://github.com/openai/codex/issues/36889
Status when checked: open, enhancement request for a discoverable bug-report/feedback entry.
An initial public GitHub comment offering help was previously posted: https://github.com/openai/codex/issues/36889#issuecomment-6809516071

### Proposed work
Add Help > Report a bug / Send feedback, privacy-first opt-in diagnostics, optional screenshot/log preview, keyboard accessibility and clear confirmation ID. Verify maintainer preference before implementation.

### Paid engagement message draft (not sent)
Hello Codex maintainers, I would be glad to contribute a scoped, testable implementation for issue #36889 if it aligns with your roadmap. I am an independent AI/software builder and a fixer who looks for real problems and solves them. I care about improving the product and also seek sustainable paid engineering opportunities. Is there an approved paid contractor, grant, or bounty channel for this kind of contribution? I understand a public GitHub issue does not imply a paid engagement.

## Commercial safeguards
- Do not post unsolicited repeated commercial pitches to issue threads.
- Seek official vendor/contractor contact channels for compensation discussions.
- No claims of internal access, guaranteed payment, or validated bugs without evidence.
- Public issue discussions should stay technical; compensation requests should go through appropriate channels.
