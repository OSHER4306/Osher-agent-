"""Convert discovered public GitHub issues into conservative qualification records."""
import csv
import json
from pathlib import Path
from qualify import qualify

ROOT=Path(__file__).parent
SRC=ROOT/'opportunities.csv'
DEST=ROOT/'qualified.json'

def main():
    if not SRC.exists():
        raise SystemExit('No opportunities.csv yet; run discovery first.')
    with SRC.open(newline='',encoding='utf-8') as f:
        issues=list(csv.DictReader(f))
    rows=[]
    for issue in issues:
        url=issue.get('url','')
        if not url.startswith('https://github.com/'):
            continue
        rows.append({
            'company':issue.get('company',''),
            'issue_url':url,
            'problem':issue.get('title',''),
            'source_status':issue.get('state','').lower(),
            'paid_route':'not confirmed',
            'checked_at':issue.get('checked_at',''),
        })
    result=qualify(rows)
    DEST.write_text(json.dumps({'count':len(result),'opportunities':result},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Qualified {len(result)} issues. Paid routes confirmed: 0 (requires separate verification).')

if __name__=='__main__':main()
