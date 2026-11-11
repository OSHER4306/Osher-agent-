#!/usr/bin/env python3
"""Public GitHub issue discovery runner. No ChatGPT impersonation or outbound messages."""
import csv
import datetime as dt
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

SEARCHES = [
    'org:openai is:issue is:open label:bug',
    'org:google is:issue is:open label:bug',
    'org:microsoft is:issue is:open label:bug',
    'org:anthropics is:issue is:open',
    'org:cloudflare is:issue is:open label:bug',
]
FIELDS = ['company','title','url','created_at','updated_at','state','source_query','checked_at']
OUT = Path(__file__).with_name('opportunities.csv')

def fetch(query):
    params=urllib.parse.urlencode({'q':query,'per_page':20,'sort':'updated','order':'desc'})
    req=urllib.request.Request('https://api.github.com/search/issues?'+params,headers={
        'Accept':'application/vnd.github+json',
        'User-Agent':'Independent-Fixer-Research/1.0',
        **({'Authorization':'Bearer '+os.environ['GITHUB_TOKEN']} if os.getenv('GITHUB_TOKEN') else {})
    })
    with urllib.request.urlopen(req,timeout=20) as resp:
        return json.load(resp).get('items',[])

def main():
    existing={}
    if OUT.exists():
        with OUT.open(newline='',encoding='utf-8') as f:
            for row in csv.DictReader(f): existing[row['url']]=row
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    failures=[]
    for query in SEARCHES:
        try:
            for issue in fetch(query):
                url=issue['html_url']
                existing[url]={
                    'company':query.split()[0].split(':')[1],
                    'title':issue['title'].replace('\n',' '),
                    'url':url,
                    'created_at':issue['created_at'],
                    'updated_at':issue['updated_at'],
                    'state':issue['state'],
                    'source_query':query,
                    'checked_at':now,
                }
        except Exception as exc:
            failures.append({'query':query,'error':str(exc)[:200]})
    OUT.parent.mkdir(parents=True,exist_ok=True)
    with OUT.open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=FIELDS);writer.writeheader()
        writer.writerows(sorted(existing.values(),key=lambda x:x['updated_at'],reverse=True))
    print(json.dumps({'unique_public_issues':len(existing),'failures':failures,'output':str(OUT)}))
    if failures: raise SystemExit(1)

if __name__=='__main__':
    main()
