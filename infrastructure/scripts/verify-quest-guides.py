"""Use published sitemap links plus successful HTTP and matching article titles.
Never invent a URL. Ambiguous or failed matches are omitted.
"""
import concurrent.futures, datetime, html, json, re, sqlite3, unicodedata, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',html.unescape(s)).encode('ascii','ignore').decode().lower())
def slug(url):
    s=url.rsplit('/',1)[-1].removesuffix('.html')
    for entity,value in html.entities.html5.items():
        name=entity.rstrip(';')
        if any(x in name.lower() for x in ['acute','grave','circ','uml','cedil','lig']):s=s.replace(name,value)
    return norm(s)
urls=[e.text for e in ET.fromstring((ROOT/'.data/dpln-sitemap.xml').read_bytes()).iter() if e.tag.endswith('loc')]
lookup={}
for url in urls:lookup.setdefault(slug(url),[]).append(url)
c=sqlite3.connect(ROOT/'.data/upstream.sqlite')
quests=list(c.execute("select q.id,t.value from QuestData q join translations t on q.nameId=t.id where t.lang='fr'"))
candidates=[(id,name,lookup[norm(name)][0]) for id,name in quests if len(lookup.get(norm(name),[]))==1]
def verify(entry):
    id,name,url=entry
    try:
        with urllib.request.urlopen(url,timeout=15) as r:
            if r.status!=200 or 'dofuspourlesnoobs.com' not in r.url:return None
            s=r.read().decode('utf8','replace')
        titles=re.findall(r'<title[^>]*>(.*?)</title>|<h[12][^>]*>(.*?)</h[12]>',s,re.S|re.I)
        if not any(norm(name) in norm(re.sub('<[^>]+>','',a+b)) for a,b in titles):return None
        return str(id),{'nameFr':name,'url':url,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    except Exception:return None
verified={}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for i,result in enumerate(pool.map(verify,candidates)):
        if result:verified[result[0]]=result[1]
        if i%100==0: print('Verified',i,'of',len(candidates),flush=True)
(ROOT/'packages/game-data/src/quest-guides.ts').write_text('/* Generated from verified article responses; do not infer missing URLs. */\nexport const questGuides:Record<string,{nameFr:string;url:string;checkedAt:string}>='+json.dumps(verified,ensure_ascii=False,indent=2)+';\n',encoding='utf8')
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sitemap':'https://www.dofuspourlesnoobs.com/sitemap.xml','catalogQuests':len(quests),'publishedSitemapLinks':len(urls),'uniqueCandidates':len(candidates),'verifiedArticles':len(verified),'unmappedQuests':len(quests)-len(verified),'policy':'Only URLs from published sitemap with successful HTTP response and matching title. No invented slugs, ambiguous or failed pages omitted.'}
(ROOT/'docs/QUEST_GUIDE_AUDIT.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report))
