import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {GameDataStore} from '../../packages/game-data/src/index';
import {fetchCatalogSupplement,type CatalogSupplement} from '../../packages/game-data/src/catalog';
await mkdir('.data',{recursive:true});
let supplement:CatalogSupplement;
try{const cached=JSON.parse(await readFile('.data/catalog-supplement.json','utf8'));supplement={...cached,items:new Map(cached.items)};}catch{supplement=await fetchCatalogSupplement();await writeFile('.data/catalog-supplement.json',JSON.stringify({...supplement,items:[...supplement.items.entries()]}));}
const store=new GameDataStore('.data/game-data.sqlite');
try{console.log(JSON.stringify(store.importSqlite('.data/upstream.sqlite','v6.0_3.7.12.12',supplement)));console.log(JSON.stringify(store.status()));await writeFile('design/catalog-import-v2.json',JSON.stringify({testedAt:new Date().toISOString(),...store.status()},null,2));}finally{store.close();}
