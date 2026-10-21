"""Build offline image assets from the checksum-pinned original game release.

Run with: uv run --with pillow python infrastructure/scripts/import-game-images.py
Archives must first be downloaded to .data/ using release.json's asset URLs.
"""
import hashlib
import json
import math
import sqlite3
import zipfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
release = json.loads((ROOT / 'packages/game-data/assets/image-sources.json').read_text(encoding='utf8'))
out = ROOT / 'apps/desktop/public/game-assets'
out.mkdir(parents=True, exist_ok=True)
db = sqlite3.connect((ROOT / '.data/upstream.sqlite').as_uri() + '?mode=ro', uri=True)
db.row_factory = sqlite3.Row
manifest = {'version': release['tag_name'], 'source': release['html_url'], 'archives': {}, 'worlds': {}, 'monsters': {}, 'items': {}}

def archive(name):
    path = ROOT / '.data' / name
    meta = next(a for a in release['assets'] if a['name'] == name)
    digest = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
    if meta['digest'] != 'sha256:' + digest or meta['size'] != path.stat().st_size:
        raise ValueError('Archive checksum mismatch: ' + name)
    manifest['archives'][name] = digest
    return zipfile.ZipFile(path)

z = archive('images-worldmap.zip')
for row in db.execute('SELECT * FROM WorldMapData'):
    scales = {float(n.split('/')[1]) for n in z.namelist() if n.startswith(str(row['id']) + '/')}
    if not scales or row['mapWidth'] <= 0 or row['mapHeight'] <= 0:
        continue
    scale = min(scales, key=lambda s: abs(s - 0.4))
    prefix = f"{row['id']}/{scale:g}/"
    tiles = sorted([n for n in z.namelist() if n.startswith(prefix)], key=lambda n: int(Path(n).stem))
    width, height = round(row['totalWidth'] * scale), round(row['totalHeight'] * scale)
    image = Image.new('RGBA', (width, height))
    cols = math.ceil(width / 1024)
    for n in tiles:
        index = int(Path(n).stem) - 1
        image.paste(Image.open(z.open(n)), ((index % cols) * 1024, (index // cols) * 1024))
    target = out / 'worlds' / f"{row['id']}.webp"
    target.parent.mkdir(exist_ok=True)
    image.save(target, quality=88, method=6)
    manifest['worlds'][str(row['id'])] = {
        'url': f"/game-assets/worlds/{row['id']}.webp",
        'x': -row['origineX'] / row['mapWidth'] - 0.5,
        'y': -row['origineY'] / row['mapHeight'] - 0.5,
        'width': row['totalWidth'] / row['mapWidth'],
        'height': row['totalHeight'] / row['mapHeight'],
        'aspect': row['mapHeight'] / row['mapWidth'],
    }
print('World backgrounds:', len(manifest['worlds']), flush=True)

data = json.loads((ROOT / 'packages/game-data/assets/dungeon-data.json').read_text(encoding='utf8'))
z = archive('images-monster.zip')
names = set(z.namelist())
for m in data['versions']['3.7.12.12']['monsters']:
    name = f"2x/{m['gfxId']}.png"
    if name not in names: continue
    target = out / 'monsters' / f"{m['gfxId']}.webp"
    target.parent.mkdir(exist_ok=True)
    Image.open(z.open(name)).save(target, lossless=True, method=4)
    manifest['monsters'][str(m['id'])] = f"/game-assets/monsters/{m['gfxId']}.webp"

z = archive('images-item.zip')
for name in z.namelist():
    if not name.startswith('1x/') or not name.endswith('.png'): continue
    icon = Path(name).stem
    target = out / 'items' / f'{icon}.webp'
    target.parent.mkdir(exist_ok=True)
    Image.open(z.open(name)).save(target, lossless=True, method=4)
    manifest['items'][icon] = f'/game-assets/items/{icon}.webp'

manifest['itemIcons'] = {str(r['id']): r['iconId'] for r in db.execute('SELECT id, iconId FROM ItemData') if str(r['iconId']) in manifest['items']}
manifest['spells'] = {}
z = archive('images-spell.zip')
names = set(z.namelist())
for icon in {s['iconId'] for v in data['versions'].values() for m in v['monsters'] for s in m['spells']}:
    name = next((n for n in [f'2x/sort_{icon}.png', f'1x/sort_{icon}.png'] if n in names), None)
    if not name: continue
    target = out / 'spells' / f'{icon}.webp'
    target.parent.mkdir(exist_ok=True)
    Image.open(z.open(name)).save(target, lossless=True, method=4)
    manifest['spells'][str(icon)] = f'/game-assets/spells/{icon}.webp'
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
print(json.dumps({k: len(manifest[k]) for k in ['worlds', 'monsters', 'items', 'itemIcons']}))
