import csv, json, re, sys
from pathlib import Path
REQUIRED=('company','issue_url','problem','source_status','paid_route')
def qualify(rows):
    seen=set(); output=[]
    for row in rows:
        if not all(row.get(k,'').strip() for k in REQUIRED): continue
        url=row['issue_url'].strip()
        if not re.fullmatch(r'https://github\.com/[^/]+/[^/]+/issues/\d+',url): continue
        if url in seen: continue
        seen.add(url)
        status=row['source_status'].lower()
        route=row['paid_route'].lower()
        score=(4 if status == 'open' else 0)+(5 if status == 'verified' else 0)+(6 if route == 'confirmed' else 0)+(2 if 'contact' in route else 0)
        output.append({**row,'issue_url':url,'priority_score':score,'eligible_for_paid_pitch':route == 'confirmed'})
    return sorted(output,key=lambda r:(-r['priority_score'],r['company'],r['issue_url']))
def main():
    src=Path(sys.argv[1]); dst=Path(sys.argv[2])
    with src.open(encoding='utf-8',newline='') as f: rows=list(csv.DictReader(f))
    result=qualify(rows)
    dst.write_text(json.dumps({'count':len(result),'opportunities':result},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Qualified {len(result)} unique issue opportunities; confirmed paid routes: {sum(r["eligible_for_paid_pitch"] for r in result)}')
if __name__=='__main__':main()
