"""Reproducible public world export. No private profile data, guessed nodes or inferred edges."""
import argparse, hashlib, json, sqlite3, os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--source', default=str(ROOT / '.data/upstream.sqlite'))
parser.add_argument('--maps', default=str(ROOT / '.data/world-maps-source.sqlite'))
parser.add_argument('--release', default=str(ROOT / '.data/release.json'))
parser.add_argument('--out', default=str(ROOT / 'packages/game-data/assets/world-data.json'))
args = parser.parse_args()
release = json.loads(Path(args.release).read_text(encoding='utf8'))
version = release['tag_name'].removeprefix('v6.0_')

def sha(path):
    with open(path, 'rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()

def connect(path):
    db = sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok': raise ValueError('SQLite integrity failed')
    return db

def verified(path, filename):
    expected = next(a for a in release['assets'] if a['name'] == filename)
    digest = sha(path)
    if expected.get('digest') != 'sha256:'+digest or Path(path).stat().st_size != expected['size']:
        raise ValueError('Release source integrity mismatch: '+filename)
    return digest

source_hash = verified(args.source, 'dofus.sqlite')
db = connect(args.source)
translations = {(r['id'],r['lang']):r['value'] for r in db.execute("select * from translations where lang in ('de','fr','en')")}
def text(id, lang='de'): return translations.get((id,lang)) or translations.get((id,'fr')) or ''
areas = {r['id']:dict(r) for r in db.execute('select * from AreaData')}
regions = {r['id']:dict(r) for r in db.execute('select * from SubAreaData')}
items = {r['id']:dict(r) for r in db.execute('select id,nameId,iconId from ItemData')}
jobs = {r['id']:text(r['nameId']) for r in db.execute('select id,nameId from JobData')}
super_areas = {r['id']:dict(r) for r in db.execute('select * from SuperAreaData')}
worlds = [{'id':r['id'],'name':text(r['nameId']) or f"Welt {r['id']}",'nameFr':text(r['nameId'],'fr'),'minScale':r['minScale'],'maxScale':r['maxScale']} for r in db.execute('select * from WorldMapData')]
maps = []
for r in db.execute('select * from MapInformationData'):
    sub = regions.get(r['subAreaId'], {}); area = areas.get(sub.get('areaId'), {})
    world = r['worldMap']
    if world < 0:
        candidates = [sub.get('customWorldMapId', -1), area.get('worldmapId', 0), super_areas.get(area.get('superAreaId'), {}).get('worldmapId', 0)]
        world = next((w for w in candidates if w > 0 and any(v['id'] == w for v in worlds)), world)
    maps.append({'sourceWorldId': r['worldMap'], 'interior': r['worldMap'] < 0, 'id':r['id'],'x':r['posX'],'y':r['posY'],'worldId':world,'subAreaId':r['subAreaId'],'areaId':sub.get('areaId',-1),'name':text(r['nameId']),'subAreaName':text(sub.get('nameId',0)),'areaName':text(area.get('nameId',0))})
map_ids = {m['id'] for m in maps}
resources = []
for r in db.execute('select * from SkillData where gatheredRessourceItem>0 order by parentJobId,levelMin,id'):
    item = items.get(r['gatheredRessourceItem'])
    if not item: continue
    found = []
    for sub in regions.values():
        if item['id'] in json.loads(sub['harvestables']):
            area = areas.get(sub['areaId'],{})
            found.append({'id':sub['id'],'name':text(sub['nameId']),'areaId':sub['areaId'],'areaName':text(area.get('nameId',0))})
    resources.append({'id':r['id'],'skillId':r['id'],'itemId':item['id'],'name':text(item['nameId']),'nameFr':text(item['nameId'],'fr'),'nameEn':text(item['nameId'],'en'),'jobId':r['parentJobId'],'jobName':jobs.get(r['parentJobId'],''),'level':r['levelMin'],'iconId':item['iconId'],'regions':found})
transitions = []; invalid_edges = 0
for row in db.execute('select * from MapScrollActionData'):
    for direction in ['right','bottom','left','top']:
        if not row[direction+'Exists']: continue
        if row['id'] not in map_ids or row[direction+'MapId'] not in map_ids:
            invalid_edges += 1; continue
        transitions.append({'from':row['id'],'to':row[direction+'MapId'],'direction':direction,'cost':1,'source':'MapScrollActionData'})
interactions = []; maps_hash = None; unknown_map_interactions = 0
if Path(args.maps).exists():
    maps_hash = verified(args.maps,'maps.sqlite'); mdb = connect(args.maps)
    for r in mdb.execute('select * from map_interactions'):
        if r['mapId'] not in map_ids: unknown_map_interactions += 1; continue
        interactions.append({'mapId':r['mapId'],'cellId':r['cellId'],'gfxId':r['gfxId'],'interactionId':r['interactionId'],'status':'unresolved'})
    mdb.close()
report = {'worlds':len(worlds),'maps':len(maps),'areas':len(areas),'subAreas':len(regions),'gatherableResources':len(resources),'interactions':len(interactions),'unresolvedInteractions':len(interactions),'confirmedGatheringNodes':0,'routingNodes':len({e['from'] for e in transitions}|{e['to'] for e in transitions}),'transitions':len(transitions),'rejectedTransitions':invalid_edges,'interactionsWithoutMap':unknown_map_interactions,'missingWorldImages':len(worlds) - len(json.loads((ROOT / 'apps/desktop/public/game-assets/manifest.json').read_text(encoding='utf8'))['worlds']),'exactResourceMapping':'Keine eindeutige Referenz von gfxId/interactionId auf SkillData; keine Zuordnung geraten.','routingCoverage':'MapScrollActionData ist ein unvollständiger gerichteter Teilgraph ohne Zell-/Zonenbedingungen.'}
result = {'schemaVersion':1,'version':version,'importedAt':datetime.now(timezone.utc).isoformat(),'source':'https://github.com/ledouxm/dofus-sqlite/releases/tag/'+release['tag_name'],'sourceSha256':source_hash,'mapsSha256':maps_hash,'worlds':worlds,'maps':maps,'resources':resources,'transitions':transitions,'interactions':interactions,'report':report}
out = Path(args.out); out.parent.mkdir(parents=True,exist_ok=True)
temp = out.with_suffix('.json.tmp'); temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf8'); os.replace(temp,out)
print(json.dumps({'version':version,'sourceSha256':source_hash,'mapsSha256':maps_hash,**report},ensure_ascii=False,indent=2))
