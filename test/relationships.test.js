import test from 'node:test';
import assert from 'node:assert/strict';
import {pillarRelationships} from '../src/relationships.js';
test('study board lists stems and branch relations, including break and self-punishment',()=>{
  const rows=pillarRelationships([{key:'year',label:'年柱',ganZhi:'甲子'},{key:'month',label:'月柱',ganZhi:'己酉'},{key:'day',label:'日柱',ganZhi:'丙午'},{key:'hour',label:'时柱',ganZhi:'戊午'}]);
  for(const kind of ['天干合','破','冲','自刑'])assert.ok(rows.some(r=>r.type===kind));
  assert.ok(rows.every(r=>r.keys.length>=2));
});
test('selected-period relationships include only contacts with the selected luck or year',()=>{
  const base=[{key:'year',label:'年柱',ganZhi:'甲子'},{key:'day',label:'日柱',ganZhi:'丙午'}];
  const rows=pillarRelationships([...base,{key:'luck',label:'大运',ganZhi:'己丑'},{key:'annual',label:'流年',ganZhi:'庚申'}],{touching:['luck','annual']});
  assert.ok(rows.length);
  assert.ok(rows.every(r=>r.keys.includes('luck')||r.keys.includes('annual')));
  assert.ok(rows.some(r=>r.type==='六合'));
});
