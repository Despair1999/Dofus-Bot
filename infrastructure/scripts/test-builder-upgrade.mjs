import assert from 'node:assert/strict';
import{spawn}from'node:child_process';
import{mkdtemp,copyFile,readFile,writeFile}from'node:fs/promises';
import{resolve,join}from'node:path';
import{randomUUID}from'node:crypto';
import{once}from'node:events';
import{createServer}from'node:net';
import{expect}from'@playwright/test';
const target=JSON.parse(await readFile('package.json','utf8')).version;
const folder=await mkdtemp(resolve('.data/builder-upgrade-'));
await copyFile('apps/desktop/src-tauri/resources/catalog-seed.sqlite',join(folder,'game-data.sqlite'));
const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const token=randomUUID()+randomUUID(),url='http://127.0.0.1:'+port,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
let child;
async function start(old=false){const service=resolve(old?'.data/portable-0.2.3/service':'apps/desktop/src-tauri/resources');child=spawn(join(service,'node.exe'),['backend.mjs'],{cwd:service,windowsHide:true,stdio:'ignore',env:{...process.env,DATA_DIR:folder,PORT:String(port),HOST:'127.0.0.1',COMPANION_TOKEN:token,COMPANION_CATALOG_SEED:''}});await expect.poll(async()=>{if(child.exitCode!==null)throw Error('Fixture exited early');try{return(await(await fetch(url+'/health')).json()).version;}catch{return'';}},{timeout:20000}).toBe(old?'0.2.3':target);}
async function stop(){if(child?.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}}
async function api(path,method='GET',body){const r=await fetch(url+path,{method,headers,body:body?JSON.stringify(body):undefined});const json=await r.json();assert.ok(r.ok,JSON.stringify(json));return json.data;}
try{
 await start(true);
 const character=await api('/api/characters','POST',{name:'Builder-Upgrade-Fixture',server:'Test',className:'Sacrieur',classId:11,level:123});
 await api('/api/characters/'+character.id+'/progress','PUT',{questId:1697,step:0,status:'paused',expectedVersion:0,mutationId:randomUUID()});
 const before=(await api('/api/characters')).find(c=>c.id===character.id),progress=await api('/api/characters/'+character.id+'/progress');
 await stop();await start();
 const after=(await api('/api/characters')).find(c=>c.id===character.id);assert.deepEqual(after,before);assert.deepEqual(await api('/api/characters/'+character.id+'/progress'),progress);
 const build=await api('/api/builder/builds','POST',{name:'Persistenz im echten Paket',characterId:character.id,classId:11,level:123,gameVersion:'3.7.12.12',equipment:{ring1:{itemId:2469,rolls:{},exos:{8:1}}},active:true});
 const summary=await api('/api/builder/builds/'+build.id+'/summary');assert.equal(summary.calculation.total[12],8);assert.equal(summary.calculation.total[8],4);
 await stop();await start();
 assert.deepEqual(await api('/api/builder/builds/'+build.id),build);assert.deepEqual(await api('/api/characters/'+character.id+'/progress'),progress);
 const versions=await api('/api/builder/versions');assert.equal(versions.length,2);for(const v of versions)for(const c of v.classes){const spells=await api('/api/builder/spells?version='+v.version+'&classId='+c.id);assert.equal(spells.length,44);assert.ok(spells.every(s=>s.name&&s.levels.length&&s.icon));}
 const report={version:target,testedAt:new Date().toISOString(),fromVersion:'0.2.3',scope:'Actual old and new bundled Node/backend services; separate SQLite fixture, no user databases modified',serviceUpgradePassed:true,existingCharacterPreserved:true,existingProgressPreserved:true,buildAndExoPreservedAfterRestart:true,allClassesAndVersionsEnumerated:true};
 await writeFile('docs/builder-service-upgrade-test.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await stop();}
