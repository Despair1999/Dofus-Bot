"""Add version-matched, identity-checked HintData without changing existing records."""
import hashlib
import json
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / '.data/upstream.sqlite'
target = root / 'packages/game-data/assets/world-data.json'
data = json.loads(target.read_text(encoding='utf8'))
with source.open('rb') as stream:
    assert hashlib.file_digest(stream, 'sha256').hexdigest() == data['sourceSha256'], 'Version/source mismatch'
db = sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True)
db.row_factory = sqlite3.Row
translations = {(r['id'], r['lang']): r['value'] for r in db.execute("select * from translations where lang in ('de','fr')")}
def text(id):
    return translations.get((id, 'de')) or translations.get((id, 'fr')) or ''
categories = {r['id']: text(r['nameId']) for r in db.execute('select * from HintCategoryData')}
maps = {m['id']: m for m in data['maps']}
worlds = {w['id'] for w in data['worlds']}
points = []
rejected = 0
for r in db.execute('select * from HintData order by id'):
    if r['mapId'] not in maps or r['worldMapId'] not in worlds:
        rejected += 1
        continue
    name = text(r['nameId'])
    if not name:
        rejected += 1
        continue
    # Exact translated source label; other transport hints are never classified as Zaaps.
    kind = 'zaap' if r['categoryId'] == 9 and name == 'Zaap' else 'dungeon' if r['categoryId'] == 6 else 'poi'
    points.append(dict(id=r['id'], mapId=r['mapId'], worldId=r['worldMapId'], x=r['x'], y=r['y'], name=name, categoryId=r['categoryId'], category=categories.get(r['categoryId'], ''), kind=kind))
data['points'] = points
data['report']['mapHints'] = len(points)
data['report']['rejectedMapHints'] = rejected
data['report']['hintSource'] = 'HintData.id/mapId/worldMapId/x/y/categoryId; hint coordinates describe the displayed landmark, not necessarily the interior map position.'
target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
print(json.dumps({'points': len(points), 'rejected': rejected, 'kinds': {kind: sum(p['kind'] == kind for p in points) for kind in ['zaap', 'dungeon', 'poi']}}))
