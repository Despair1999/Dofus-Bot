"""Build a reproducible, version-isolated public builder dataset. No personal data."""
import sqlite3, json, hashlib, zipfile, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'packages/game-data/assets'
OUT.mkdir(parents=True, exist_ok=True)
def parsed(v, fallback=None):
    return json.loads(v) if isinstance(v,str) and v else (v if v is not None else fallback)
def database(path):
    c=sqlite3.connect('file:'+str(path).replace('\\','/')+'?mode=ro',uri=True)
    c.row_factory=sqlite3.Row
    return c
def numeric(e):
    low=int(e.get('int_minimum',0));high=low if e.get('ignore_int_max') else int(e.get('int_maximum',low))
    if e.get('ignore_int_min'):low=high
    return {'id':e['type']['id'],'min':min(low,high),'max':max(low,high),'label':e.get('formatted',e['type']['name']),'active':bool(e['type'].get('is_active'))}
api=json.loads((ROOT/'.data/catalog-supplement.json').read_text(encoding='utf8'))
assert api['version']=='3.7.12.12'
supplement=dict(api['items'])
set_snapshot=json.loads((ROOT/'.data/builder-sets.json').read_text(encoding='utf8'))
existing=database(ROOT/'.data/game-data.sqlite')
old_items={r['id']:json.loads(r['content']) for r in existing.execute('select id,content from catalog_items')}
slot_map={1:['amulet'],2:['weapon'],3:['ring'],4:['belt'],5:['boots'],7:['shield'],10:['hat'],11:['cape'],12:['companion'],13:['dofus']}
char_stat={1:12,23:8,10:45,11:9,12:10,13:22,14:36,15:13,16:30,18:29,19:31,25:32,26:28,27:75,28:39,33:63,34:37,35:17,36:16,37:34,44:24,48:25,49:121,54:15,55:14,56:82,57:60,58:33,69:106,70:112,78:59,79:26,82:64,83:50,84:62,85:70,86:38,87:46,88:48,89:61,90:27,91:47,92:49,120:71,121:108,122:41,123:93,124:40,125:65}
direct={91:('water','steal'),92:('earth','steal'),93:('air','steal'),94:('fire','steal'),95:('neutral','steal'),96:('water','damage'),97:('earth','damage'),98:('air','damage'),99:('fire','damage'),100:('neutral','damage'),108:('fire','heal')}
result={'schema':1,'versions':{},'sources':json.loads((ROOT/'design/builder-sources.json').read_text(encoding='utf8')),'historicalSources':json.loads((ROOT/'design/builder-raw-assets.json').read_text(encoding='utf8'))}
reports=[];icons={}
archive=zipfile.ZipFile(ROOT/'.data/images-spell.zip');available=set(archive.namelist())
raw36={}
for kind in ['itemsdata','itemsetsdata']:
    source=json.loads((ROOT/f'.data/3.6-{kind}.json').read_text(encoding='utf8'))
    raw36[kind]={entry['rid']:entry for entry in source['references']['RefIds']}
raw_items36={entry['data']['id']:entry['data']for entry in raw36['itemsdata'].values()if entry['type']['class']in('ItemData','WeaponData')}
raw_sets36={entry['data']['id']:entry['data']for entry in raw36['itemsetsdata'].values()if entry['type']['class']=='ItemSetData'}
for version,file in [('3.6.12.16','upstream-3.6.sqlite'),('3.7.12.12','upstream.sqlite')]:
    db=database(ROOT/'.data'/file)
    tr={(int(r['id']),r['lang']):r['value']or'' for r in db.execute('select * from translations')}
    def text(id,lang='de'):return tr.get((int(id),lang),'') or tr.get((int(id),'fr'),'')
    definitions={r['id']:dict(r)for r in db.execute('select * from EffectData')}
    characteristic_names={r['id']:text(r['nameId'])for r in db.execute('select * from CharacteristicData')}
    missing_references=[]
    def raw_numeric(reference,kind):
        entry=raw36[kind].get(reference['rid'])
        if not entry:missing_references.append(str(reference['rid']));return None
        e=entry['data'];action=e.get('actionId',e.get('effectId',0));definition=definitions.get(action,{})
        low=e.get('diceNum',0);high=e.get('diceSide',0)or low
        low,high=min(low,high),max(low,high)
        characteristic=definition.get('characteristic');operator=definition.get('characteristicOperator')
        if characteristic in char_stat and operator in ('+','-'):
            if operator=='-':low,high=-high,-low
            id=char_stat[characteristic];label=characteristic_names.get(characteristic,'')
            return {'id':id,'actionId':action,'min':low,'max':high,'label':f'{low}'+(f' – {high}'if low!=high else'')+' '+label,'active':False}
        damage_ids={96:214,97:194,98:189,99:198,100:195}
        label=text(definition.get('descriptionId',0)).replace('#1',str(low)).replace('#2',str(high))
        return {'id':damage_ids.get(action,10000+action),'actionId':action,'min':low,'max':high,'label':label or f'Effekt {action}: {low}–{high}','active':action in direct}
    def spell_effect(e):
        action=e.get('actionId',e.get('effectId',0));definition=definitions.get(action,{})
        low=e.get('diceNum',0);high=e.get('diceSide',0)or low
        out={'actionId':action,'min':min(low,high),'max':max(low,high),'description':text(definition.get('descriptionId',0)),'targetMask':e.get('targetMask',''),'duration':e.get('duration',0),'delay':e.get('delay',0),'zone':parsed(e.get('zoneDescr'),{}),'supported':False}
        if action in direct:
            out['element'],out['kind']=direct[action]
            zone=out['zone'];conditional=e.get('delay',0)!=0 or e.get('duration',0)!=0 or e.get('random',0)!=0 or e.get('triggers','')not in ('','I') or e.get('modificator',0)!=0 or e.get('group',0)!=0
            out['supported']=not conditional
            if conditional:out['reason']='Bedingter, verzögerter oder zufälliger Effekt: keine exakte Gesamtsimulation.'
        elif definition.get('characteristic') in char_stat and definition.get('characteristicOperator') in ('+','-'):
            out['kind']='buff';out['statId']=char_stat[definition['characteristic']]
            if definition['characteristicOperator']=='-':out['min'],out['max']=-out['max'],-out['min']
            out['reason']='Buff muss ausdrücklich als Simulationsannahme aktiviert werden.'
        else:out['reason']='Spezialmechanik noch nicht verifiziert unterstützt.'
        return out
    spellrows={r['id']:dict(r)for r in db.execute('select * from SpellData')}
    levels={}
    for row in db.execute('select * from SpellLevelData'):
        r=dict(row);levels.setdefault(r['spellId'],[]).append({'id':r['id'],'grade':r['grade'],'level':r['minPlayerLevel'],'ap':r['apCost'],'minRange':r['minRange'],'maxRange':r['range'],'critical':r['criticalHitProbability'],'effects':[spell_effect(e)for e in parsed(r['effects'],[])],'criticalEffects':[spell_effect(e)for e in parsed(r['criticalEffect'],[])],'restrictions':{k:r[k]for k in ['m_flags','maxStack','maxCastPerTurn','maxCastPerTarget','minCastInterval','initialCooldown','globalCooldown','statesCriterion']}})
    variant_groups={}
    for r in db.execute('select * from SpellVariantData_spellIds_junction'):variant_groups.setdefault(r[0],[]).append(r[1])
    by_class={};variants={}
    for r in db.execute('select * from SpellVariantData'):
        ids=variant_groups.get(r['id'],[]);by_class.setdefault(r['breedId'],set()).update(ids)
        for id in ids:variants[id]=[x for x in ids if x!=id]
    spells=[];classes=[]
    for breed in db.execute('select * from BreedData'):
        cid=breed['id'];ids=set(parsed(breed['breedSpellsId'],[]))|by_class.get(cid,set())
        names=[text(breed['shortNameId'],lang)for lang in ['de','fr','en']]
        classes.append({'id':cid,'classId':cid,'name':names[0],'nameDe':names[0],'nameFr':names[1],'nameEn':names[2],'aliases':list(dict.fromkeys(names)),'icon':f'/classes/{cid}-thumb.webp','portrait':f'/classes/{cid}.webp','source':'dofus-sqlite '+version,'placeholder':False,'costs':{key:parsed(breed[key])for key in breed.keys()if key.startswith('statsPoints')}})
        for id in sorted(ids):
            spell=spellrows.get(id)
            if not spell:continue
            icon_id=spell['iconId'];icon=f'1x/sort_{icon_id}.png';icon_path=None
            if icon in available:
                icon_path=f'/spells/{icon_id}.png';icons[icon_id]=icon
            spells.append({'id':id,'classId':cid,'name':text(spell['nameId']),'nameFr':text(spell['nameId'],'fr'),'nameEn':text(spell['nameId'],'en'),'description':text(spell['descriptionId']),'icon':icon_path or '', 'iconId':icon_id,'version':version,'variants':variants.get(id,[]),'levels':sorted(levels.get(id,[]),key=lambda x:x['level'])})
    types={r['id']:dict(r)for r in db.execute('select * from ItemTypeData')}
    weapons={r['id']:dict(r)for r in db.execute('select * from WeaponData')}
    rawitems={r['id']:dict(r)for r in db.execute('select * from ItemData')};rawitems.update(weapons)
    items=[]
    for id,r in rawitems.items():
        t=types.get(r['typeId'],{});slots=slot_map.get(t.get('superTypeId'),[])
        if t.get('categoryId')!=0 or not slots:continue
        supplement_item=supplement.get(id,{})if version=='3.7.12.12'else{}
        old=old_items.get(id,{})if version=='3.7.12.12'else{}
        effects=[numeric(e)for e in supplement_item.get('effects')or []]
        if version=='3.6.12.16':effects=[effect for ref in raw_items36.get(id,{}).get('possibleEffects',{}).get('Array',[])if (effect:=raw_numeric(ref,'itemsdata'))is not None]
        item={'id':id,'name':text(r['nameId']),'level':r['level'],'typeId':r['typeId'],'type':text(t.get('nameId',0)),'imageUrl':old.get('imageUrl')or(f"https://api.dofusdu.de/dofus3/v1/img/item/{r['iconId']}-64.png"if r['iconId'] else None),'setId':r['itemSetId']if r['itemSetId']>0 else None,'setName':old.get('setName','')if version=='3.7.12.12'else text(raw_sets36.get(r['itemSetId'],{}).get('nameId',0)),'requirements':r['criterions'],'slots':slots,'effects':effects,'effectsKnown':bool(supplement_item)if version=='3.7.12.12'else id in raw_items36,'version':version}
        if id in weapons:
            item['weapon']={'ap':r['apCost'],'minRange':r['minRange'],'maxRange':r['range'],'critical':r['criticalHitProbability'],'criticalBonus':r['criticalHitBonus']}
        items.append(item)
    sets=[{'id':s['ankama_id'],'name':s['name'],'tiers':{n:[numeric(e)for e in effects or []]for n,effects in (s.get('effects')or{}).items()}}for s in set_snapshot['sets']]if version=='3.7.12.12'else[]
    if version=='3.6.12.16':
        for id,s in raw_sets36.items():
            tiers={}
            for index,tier in enumerate(s.get('effects',{}).get('Array',[])):
                tiers[index+1]=[effect for ref in tier.get('values',{}).get('Array',[])if(effect:=raw_numeric(ref,'itemsetsdata'))is not None]
            sets.append({'id':id,'name':text(s['nameId']),'tiers':tiers})
    coverage=[{'classId':c['id'],'count':sum(s['classId']==c['id']for s in spells),'missingLevels':[s['id']for s in spells if s['classId']==c['id']and not s['levels']],'missingIcons':[s['id']for s in spells if s['classId']==c['id']and not s['icon']]}for c in classes]
    report={'version':version,'items':len(items),'itemsWithNumericEffects':sum(i['effectsKnown']for i in items),'sets':len(sets),'spells':len(spells),'levels':sum(len(s['levels'])for s in spells),'coverage':coverage,'unresolvedEffectReferences':missing_references}
    item_ids={i['id']for i in items}
    extra_effects=[{'itemId':id,'effects':[numeric(e)for e in data.get('effects')or []]}for id,data in supplement.items()if id not in item_ids]if version=='3.7.12.12'else[]
    result['versions'][version]={'classes':classes,'items':items,'sets':sets,'spells':spells,'report':report,'catalogEffects':extra_effects};reports.append(report)
    db.close()
icon_root=ROOT/'apps/desktop/public/spells';icon_root.mkdir(parents=True,exist_ok=True)
for id,member in icons.items():(icon_root/f'{id}.png').write_bytes(archive.read(member))
payload=json.dumps(result,ensure_ascii=False,separators=(',',':')).encode('utf8')
(OUT/'builder-data.json').write_bytes(payload)
(ROOT/'design/builder-import-report.json').write_text(json.dumps({'versions':reports,'icons':len(icons),'sha256':hashlib.sha256(payload).hexdigest(),'limitations':['Complex spell effects remain explicitly unsupported.'],'historicalEffectResolution':'Original release JSON reference tables, parsed as exact Python integers; no rounded SQLite rid values used.'},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'versions':[{k:r[k]for k in ['version','items','sets','spells','levels']}for r in reports],'icons':len(icons),'bytes':len(payload)}))
