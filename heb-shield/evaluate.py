#!/usr/bin/env python3
"""Offline educational baseline for synthetic Hebrew AI security examples."""
import argparse
import json
import re
from pathlib import Path

PATTERNS = [
    r"התעלם מכל ההוראות", r"ignore previous instructions", r"system override",
    r"קוד האימות", r"שלח לי את הסיסמה", r"בלי לאמת", r"חשוף את המידע הסודי",
    r"ללא אישור המשתמש", r"שמור זאת בסוד", r"קודמות להוראות המשתמש",
]

def predict(text):
    return "suspicious" if any(re.search(p, text, re.I) for p in PATTERNS) else "benign"

def evaluate(records):
    counts = {"tp": 0, "tn": 0, "fp": 0, "fn": 0}
    details = []
    for record in records:
        expected = record["label"]
        if expected not in {"benign", "suspicious"}:
            raise ValueError(f"Invalid label for {record.get('id')}")
        observed = predict(record["text"])
        key = ("tp" if expected == observed == "suspicious" else
               "tn" if expected == observed == "benign" else
               "fp" if observed == "suspicious" else "fn")
        counts[key] += 1
        details.append({"id": record["id"], "expected": expected, "predicted": observed})
    tp, fp, fn = counts["tp"], counts["fp"], counts["fn"]
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"n": len(records), "counts": counts, "precision": precision, "recall": recall, "f1": f1, "details": details}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="examples.jsonl")
    parser.add_argument("--output", default="results.json")
    args = parser.parse_args()
    with open(args.input, encoding="utf-8") as f:
        records = [json.loads(line) for line in f if line.strip()]
    result = evaluate(records)
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "details"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
