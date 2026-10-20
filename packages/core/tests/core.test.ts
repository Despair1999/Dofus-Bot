import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materials, profit, normalize, matchCandidates, prerequisiteOrder, route, characterInput, progressInput } from '../src/index.js';

test('normalizes French/German accents and rejects empty matches', () => {
  assert.equal(normalize('Épée — Stärke'), 'epee starke');
  assert.equal(matchCandidates('', [{name:'Gelano'}]).length, 0);
  assert.equal(matchCandidates('Andere Zeile\nÉpée de Bois', [{name:'Épée de Bois'}])[0]?.score, 1);
});
test('aggregates materials and deducts stock once', () => {
  assert.deepEqual(materials([{recipe:[{itemId:1,quantity:3}],quantity:2},{recipe:[{itemId:1,quantity:5}],quantity:1}], {1:4}), [{itemId:1,required:11,missing:7}]);
  assert.throws(() => materials([{recipe:[],quantity:0}]));
});
test('profit accounts for explicit fee and zero sale', () => {
  assert.deepEqual(profit(50,100,2), {cost:50,sale:100,fees:2,profit:48,marginPercent:48});
  assert.equal(profit(10,0).marginPercent,0); assert.throws(() => profit(-1,100));
});
test('quest graph orders dependencies and rejects cycles', () => {
  assert.deepEqual(prerequisiteOrder(3,{3:[2],2:[1]}),[1,2,3]);
  assert.throws(() => prerequisiteOrder(1,{1:[2],2:[1]}), /Zyklus/);
});
test('navigation never invents a missing edge', () => {
  assert.deepEqual(route('a','c',{a:['b'],b:['c']}),['a','b','c']);
  assert.equal(route('a','z',{a:['b']}),null);
});
test('validates user inputs and optimistic versions', () => {
  assert.equal(characterInput.safeParse({name:'',server:'D',className:'Iop',level:200}).success,false);
  assert.equal(progressInput.safeParse({questId:1,step:0,status:'active',expectedVersion:-1,mutationId:crypto.randomUUID()}).success,false);
});
