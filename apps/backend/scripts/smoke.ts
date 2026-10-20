import {PersonalStore} from '../src/store.js';
import {Dofusdude} from '../src/dofusdude.js';
const store=new PersonalStore(':memory:');
const api=new Dofusdude(store);
try {
 const items=await api.search('Gelano');
 if(!items.data.length)throw new Error('Keine Items erhalten');
 const item=await api.itemDetail(items.data[0]!.id,items.data[0]!.category);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const almanax=await api.almanax(date);const version=await api.version();
 console.log(JSON.stringify({test:'live-smoke',time:new Date().toISOString(),items:items.data.length,detail:{id:item.data.id,name:item.data.name,ingredients:item.data.recipe.length},almanaxDate:almanax.data.date,version:version.data.version},null,2));
}finally{store.close();}
