"""Fetch a bounded public DofusDB snapshot, without credentials or image downloads."""
import concurrent.futures,datetime,json,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[2]
def read(url):
    with urllib.request.urlopen(url,timeout=30) as response:return json.load(response)
base='https://api.dofusdb.fr/recoltables2'; version=read('https://api.dofusdb.fr/version')
first=read(base+'?$limit=50&$skip=0'); total=first['total']; rows=first['data']
if not 0<total<100000:raise ValueError('Unexpected source size')
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for data in pool.map(lambda skip:read(base+'?$limit=50&$skip='+str(skip))['data'],range(50,total,50)):rows.extend(data)
if len(rows)!=total or len({r['id'] for r in rows})!=total:raise ValueError('Pagination incomplete or duplicate map IDs')
if read('https://api.dofusdb.fr/version')!=version:raise ValueError('Source version changed during snapshot; retry explicitly')
out=root/'.data/dofusdb-resource-snapshot.json';out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({'source':base,'sourceVersion':version,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'total':total,'data':rows},ensure_ascii=False),encoding='utf8')
first_skills=read('https://api.dofusdb.fr/skills?$limit=50');skills=first_skills['data']
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for data in pool.map(lambda skip:read('https://api.dofusdb.fr/skills?$limit=50&$skip='+str(skip))['data'],range(50,first_skills['total'],50)):skills.extend(data)
if len(skills)!=first_skills['total']:raise ValueError('Incomplete skill metadata')
(root/'.data/dofusdb-skills.json').write_text(json.dumps(skills,ensure_ascii=False),encoding='utf8')
print(json.dumps({'maps':len(rows),'sourceVersion':version,'snapshot':str(out)}))
