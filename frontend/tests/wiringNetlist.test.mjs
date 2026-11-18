import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const m=JSON.parse(fs.readFileSync(path.join(root,'../src/modelConnections.json'),'utf8'));
const nets=m.connections;

test('33 explicitly named net connections with no duplicates or anonymous endpoints',()=>{
  assert.equal(nets.length,33);
  assert.equal(new Set(nets.map(n=>n.id)).size,nets.length);
  for(const n of nets){assert.ok(n.source.length>3);assert.ok(n.destination.length>3);}
});
test('the six specified ESP32 signal pins are mapped, never treated as 12V load terminals',()=>{
  for(const pin of ['GPIO34','GPIO35','GPIO32','GPIO4','GPIO26','GPIO27']){
    assert.ok(nets.some(n=>(n.source+' '+n.destination).includes(pin)),`${pin} missing`);
  }
  assert.ok(nets.some(n=>n.id==='relay_no_to_valve'&&n.domain==='12V'));
  assert.ok(nets.some(n=>n.id==='fused_12v_to_relay_com'&&n.domain==='12V'));
  assert.equal(nets.some(n=>n.domain==='12V'&&(n.destination.includes('GPIO')||n.source.includes('GPIO'))),false);
});
test('pH and turbidity signals pass through separate scaling stages',()=>{
  assert.ok(nets.some(n=>n.id==='ph_to_divider'));
  assert.ok(nets.some(n=>n.id==='ph_div_to_gpio34'));
  assert.ok(nets.some(n=>n.id==='turb_to_divider'));
  assert.ok(nets.some(n=>n.id==='turb_div_to_gpio35'));
});
test('DS18B20 pull-up, ground and 3V3 are explicit',()=>{
  for(const id of ['temperature_data','temperature_supply','temperature_ground','temperature_pullup'])
     assert.ok(nets.some(n=>n.id===id));
});
test('each probe lead terminates at its own conditioning module',()=>{
  const examples=[['ph_probe_to_bnc','PH-4502C'],['turb_probe_to_board','SEN0189'],['tds_probe_to_board','TDS Meter']];
  for(const [id,term] of examples)assert.match(nets.find(n=>n.id===id)?.destination||'',new RegExp(term));
});
