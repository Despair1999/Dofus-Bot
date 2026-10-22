"""Validate explicit DofusDB item/cell/map records; never expand regional occurrences.
Run after import-world-data.py. Snapshot is fetched separately and retained with SHA256.
Different patch versions remain unconfirmed and require explicit UI opt-in.
"""
import hashlib, json
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2]
snapshot=ROOT/'.data/dofusdb-resource-snapshot.json'
raw=snapshot.read_bytes(); source=json.loads(raw)
path=ROOT/'packages/game-data/assets/world-data.json'; world=json.loads(path.read_text(encoding='utf8'))
maps={m['id']:m for m in world['maps']}; resources={}
for r in world['resources']: resources.setdefault(r['itemId'],[]).append(r)
counts=Counter(); nodes=[]; seen=set()
for row in source['data']:
    counts['sourceMaps']+=1
    position=maps.get(row['id']); p=row.get('pos') or {}
    for q in row.get('quantities',[]):
        counts['sourceResourceCells']+=1
        if not position: counts['missingMap']+=1; continue
        if any(position[k]!=p.get(v) for k,v in [('x','posX'),('y','posY'),('subAreaId','subAreaId')]): counts['coordinateOrRegionMismatch']+=1; continue
        if position.get('sourceWorldId',position['worldId'])!=p.get('worldMap'): counts['worldMismatch']+=1;continue
        if not isinstance(q.get('cell'),int) or not 0<=q['cell']<560: counts['invalidCell']+=1;continue
        matches=list({(r['jobId'],r['level']):r for r in reversed(resources.get(q.get('item'),[])) if r['jobId'] in [2,24,26,28,36,41]}.values())
        if not matches: counts['unmatchedItem']+=1;continue
        for r in matches:
            key=(position['id'],r['id'],q['cell'],q.get('criterion',''))
            if key in seen: counts['duplicates']+=1;continue
            seen.add(key)
            verified=source['sourceVersion']==world['version']
            nodes.append({'id':':'.join(map(str,key[:3])),'mapId':position['id'],'resourceId':r['id'],'itemId':r['itemId'],'cellId':q['cell'],'x':position['x'],'y':position['y'],'worldId':position['worldId'],'subAreaId':position['subAreaId'],'jobId':r['jobId'],'level':r['level'],'quantity':q.get('quantity',1),'criterion':q.get('criterion',''),'verification':'verified' if verified else 'unconfirmed-version','sourceVersion':source['sourceVersion']})
            counts['validatedMapResourceReferences']+=1
            counts['verifiedCurrentPatch' if verified else 'unconfirmedPatch']+=1
            if r['jobId']==36:counts['fishingCells']+=1
world['gatheringNodes']=nodes
world['gatheringSource']={'url':source['source'],'version':source['sourceVersion'],'fetchedAt':source['fetchedAt'],'sha256':hashlib.sha256(raw).hexdigest()}
world['report']['documentedGatheringCells']=len(nodes)
world['report']['confirmedGatheringNodes']=counts['verifiedCurrentPatch']
path.write_text(json.dumps(world,ensure_ascii=False,separators=(',',':')),encoding='utf8')
report={'datasetVersion':world['version'],'source':world['gatheringSource'],'counts':dict(counts),'resources':len(world['resources']),'regions':sum(len(r['regions']) for r in world['resources']),'byJob':dict(Counter(n['jobId'] for n in nodes)),'policy':'Exact map/cell/item references validated, not region-expanded. Different source patch is unconfirmed, hidden by default and excluded from verified farm routes. No spawn coordinates or walkable edges inferred.'}
report['canonicalProfessionResourcesByJob']=dict(Counter(str(job) for job,item,level in {(r['jobId'],r['itemId'],r['level']) for r in world['resources'] if r['jobId']!=1}))
report['sourceVerifiedCurrentPatch']=counts['verifiedCurrentPatch']
skills_path=ROOT/'.data/dofusdb-skills.json'
if skills_path.exists():
    skills={s['id']:s for s in json.loads(skills_path.read_text(encoding='utf8'))}
    differences=[r['id'] for r in world['resources'] if not (r['id'] in skills and (r['jobId'],r['itemId'],r['level'])==(skills[r['id']]['parentJobId'],skills[r['id']]['gatheredRessourceItem'],skills[r['id']]['levelMin']))]
    report['skillCrossCheck']={'source':'https://api.dofusdb.fr/skills','sourceVersion':source['sourceVersion'],'checked':len(world['resources']),'matchingJobItemLevel':len(world['resources'])-len(differences),'differingSkillIds':differences}
(ROOT/'docs/GATHERING_DATA_AUDIT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
