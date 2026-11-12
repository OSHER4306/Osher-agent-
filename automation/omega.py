"""Auditable deterministic OMEGA candidate selection and simulation."""
from dataclasses import dataclass
import random

@dataclass(frozen=True)
class Candidate:
    name: str
    value: float
    cost: float
    risk: float
    evidence: float

def score(c, weights=(.4,.2,.25,.15)):
    if not all(0 <= x <= 1 for x in (c.value,c.cost,c.risk,c.evidence)):
        raise ValueError('metrics outside [0,1]')
    a,b,d,e=weights
    return a*c.value-b*c.cost-d*c.risk+e*c.evidence

def adversarial_check(c):
    findings=[]
    if c.evidence < .5: findings.append('weak evidence')
    if c.risk > .7: findings.append('high risk')
    if c.cost > c.value: findings.append('cost exceeds expected value')
    return findings

def choose(candidates):
    if not candidates or len({c.name for c in candidates})!=len(candidates):
        raise ValueError('empty or duplicate candidates')
    valid=[c for c in candidates if not adversarial_check(c)]
    return max(valid,key=lambda c:(score(c),c.name)) if valid else None

def monte_carlo(candidates, n=5000, seed=42):
    rng=random.Random(seed)
    wins={c.name:0 for c in candidates}
    valid=[c for c in candidates if not adversarial_check(c)]
    for _ in range(n):
        weights=[rng.uniform(.1,.5) for _ in range(4)]
        total=sum(weights); weights=[w/total for w in weights]
        if not valid: break
        best=max(valid,key=lambda c:(score(c,weights),c.name))
        wins[best.name]+=1
    return {name:count/n for name,count in wins.items()}
