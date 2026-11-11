# HEB-SHIELD — Hebrew AI Security Benchmark (prototype)

A small, offline-first defensive evaluation toolkit for Hebrew prompt-injection and social-engineering scenarios. This is a **prototype**, not a validated research benchmark. All examples are synthetic and use fictitious entities.

## Run

```bash
python3 heb-shield/evaluate.py --input heb-shield/examples.jsonl --output heb-shield/results.json
```

The baseline is deliberately simple and rule-based. It is **not** a security filter for production use. The point is to make limitations measurable before evaluating actual models.

## Methodology

Each record includes `id`, `source`, `text`, `label` (benign or suspicious), `category`, and `expected_behavior`. Evaluation reports confusion matrix and precision/recall/F1 for the suspicious class. It does not send data to any API.

## Safety and privacy

No real credentials, personal information, malware, exploitation instructions, or live-target testing. Do not submit untrusted content to an agent with permissions without isolation and human review.

## Proposed next steps

Expand with independently reviewed cases, diverse dialects, benign controls, annotation guidelines, train/test split and inter-annotator agreement. Run controlled model evaluations only with owned synthetic data and disclosed model/version/settings. Publish aggregate results and error analysis.

Code is offered under MIT; synthetic examples under CC BY 4.0.
