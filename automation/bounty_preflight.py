"""Offline review of Bounty API page exports. No network calls or marketplace writes."""
import json
import sys
from pathlib import Path


def candidate(row):
    if not isinstance(row, dict):
        raise ValueError('Bounty must be an object')
    identity = row.get('_id')
    version = row.get('version')
    if not isinstance(identity, str) or not identity.strip():
        raise ValueError('Missing bounty identity')
    if type(version) is not int or version < 1:
        raise ValueError('Invalid bounty version')
    if row.get('flow') not in ('bid', 'claim') or not isinstance(row.get('status'), str):
        raise ValueError('Invalid bounty lifecycle')
    if not isinstance(row.get('currency'), str) or not row['currency']:
        raise ValueError('Missing currency')
    for key in ('payout_cents', 'budget_cents'):
        if key not in row:
            raise ValueError('Missing payout or budget field')
        amount = row[key]
        if amount is not None and (type(amount) is not int or amount < 0):
            raise ValueError('Invalid monetary amount')
    if 'test' in row and row['test'] is not True:
        raise ValueError('Invalid test flag')
    return {
        'bounty_id': identity, 'expected_version': version,
        'flow': row['flow'], 'status': row['status'], 'currency': row['currency'],
        'payout_cents': row['payout_cents'], 'budget_cents': row['budget_cents'],
        'test': row.get('test', False),
    }


def review_pages(pages):
    """Require a complete bounded export; keep latest terms without dispatching work."""
    if not isinstance(pages, list) or not 1 <= len(pages) <= 100:
        raise ValueError('Expected between 1 and 100 pages')
    latest, versions, cursors = {}, {}, set()
    duplicates = 0
    for index, page in enumerate(pages):
        if not isinstance(page, dict) or not isinstance(page.get('bounties'), list):
            raise ValueError('Invalid bounty page')
        more = page.get('has_more')
        if type(more) is not bool or not isinstance(page.get('next_cursor'), str):
            raise ValueError('Missing pagination contract')
        if more != (index < len(pages) - 1):
            raise ValueError('Incomplete export or pages after completion')
        cursor = page['next_cursor']
        if more:
            if not cursor or cursor in cursors:
                raise ValueError('Missing or repeated continuation cursor')
            cursors.add(cursor)
        for raw in page['bounties']:
            item = candidate(raw)
            key = (item['bounty_id'], item['expected_version'])
            if key in versions:
                if versions[key] != item:
                    raise ValueError('Conflicting terms for the same version')
                duplicates += 1
            versions[key] = item
            previous = latest.get(item['bounty_id'])
            if previous is None or previous['expected_version'] < item['expected_version']:
                latest[item['bounty_id']] = item
    reviews = []
    for identity in sorted(latest):
        item = latest[identity]
        if item['status'] == 'open' and not item['test']:
            reviews.append({**item, 'requires_fresh_detail_and_eligibility_check': True})
    return {'review_candidates': reviews, 'duplicate_records': duplicates,
            'unique_bounties': len(latest), 'verified_earnings_cents': 0,
            'external_actions': 0}


def main():
    try:
        result = review_pages(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')))
    except (IndexError, OSError, UnicodeError, ValueError, RecursionError):
        print('Expected a complete valid Bounty page export', file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
