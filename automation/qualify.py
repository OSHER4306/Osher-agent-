import csv, json, re, sys
from pathlib import Path
from urllib.parse import urlsplit

REQUIRED=('company','issue_url','problem','source_status','paid_route')
OFFICIAL_PAYMENT_DOMAINS={
    'openai.com','google.com','microsoft.com','github.com','hackerone.com',
    'bugcrowd.com','cloudflare.com','aws.amazon.com','amazon.com',
    'apple.com','stripe.com','hashicorp.com','vercel.com','elastic.co'
}

def verified_payment_route(row):
    """Only explicit verification + an official source permits a paid pitch."""
    if row.get('paid_route','').strip().lower() != 'confirmed':
        return False
    if str(row.get('paid_route_verified','')).strip().lower() not in ('true','yes','1'):
        return False
    url=row.get('paid_route_url','').strip()
    try:
        parsed=urlsplit(url)
        host=(parsed.hostname or '').lower()
        return parsed.scheme=='https' and any(host==d or host.endswith('.'+d) for d in OFFICIAL_PAYMENT_DOMAINS)
    except ValueError:
        return False

def qualify(rows):
    seen=set(); output=[]
    for row in rows:
        if not all(str(row.get(k,'')).strip() for k in REQUIRED): continue
        url=row['issue_url'].strip()
        if not re.fullmatch(r'https://github\.com/[^/]+/[^/]+/issues/\d+',url): continue
        if url in seen: continue
        seen.add(url)
        status=row['source_status'].strip().lower()
        paid=verified_payment_route(row)
        score=(4 if status=='open' else 0)+(5 if status=='verified' else 0)+(6 if paid else 0)
        output.append({**row,'issue_url':url,'priority_score':score,'eligible_for_paid_pitch':paid})
    return sorted(output,key=lambda r:(-r['priority_score'],r['company'],r['issue_url']))

def main():
    src=Path(sys.argv[1]); dst=Path(sys.argv[2])
    with src.open(encoding='utf-8',newline='') as f: rows=list(csv.DictReader(f))
    result=qualify(rows)
    dst.write_text(json.dumps({'count':len(result),'opportunities':result},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Qualified {len(result)} unique issue opportunities; verified paid routes: {sum(r["eligible_for_paid_pitch"] for r in result)}')

if __name__=='__main__':main()
