import test from 'node:test';
import assert from 'node:assert/strict';
import {projectHardwareState, componentFromMeshName, sensorLabel, COMPONENT_BY_ID} from '../src/hardwareTwinState.js';
const base=(v={})=>({device_status:'online',valve:{...v},latest_live_valid_reading:{rule_rating:'Risky',measured_at:'2026-11-18T00:00:00Z',payload:{pH:7.2,turbidity:13,TDS:255,temperature_c:26.7}}});
test('unknown valve is NOT depicted as flowing',()=>assert.equal(projectHardwareState(base()).canShowFlow,false));
test('a command to open without acknowledgment does NOT depict flow',()=>assert.equal(projectHardwareState(base({commanded:'open'})).canShowFlow,false));
test('acknowledgment to open without verification does NOT depict flow',()=>assert.equal(projectHardwareState(base({commanded:'open',acknowledged:'open',supply_status:'simulated_open'})).canShowFlow,false));
test('an independent virtual verification of open depicts flow only when device online',()=>{
 assert.equal(projectHardwareState(base({commanded:'open',acknowledged:'open',verified:'open',supply_status:'simulated_open'})).canShowFlow,true);
 assert.equal(projectHardwareState({...base({verified:'open',supply_status:'simulated_open'}),device_status:'offline'}).canShowFlow,false);
});
test('fault blocks flow even after verified open',()=>assert.equal(projectHardwareState(base({verified:'open',supply_status:'simulated_open',fault:'verification_timeout'})).canShowFlow,false));
test('verified closed means simulated isolated, never flowing',()=>{
 let state=projectHardwareState(base({commanded:'closed',acknowledged:'closed',verified:'closed',supply_status:'simulated_isolated'}));
 assert.equal(state.valveStage,'verified_closed');assert.equal(state.canShowFlow,false);
});
test('turbidity haze clamps and missing values never invent readings',()=>{
 assert.equal(projectHardwareState(base()).haze>0,true);
 const s=projectHardwareState({device_status:'never_seen'});
 assert.equal(sensorLabel(COMPONENT_BY_ID.ph,s),'Awaiting simulated reading');
});
test('model and rule rating remain distinct',()=>{
 const state=projectHardwareState({...base(),model:{status:'available',class:'Normal',score:.15}});
 assert.equal(state.rating,'Risky');assert.equal(state.model.class,'Normal');
});
test('mesh metadata maps real CAD components to inspector',()=>{
 assert.equal(componentFromMeshName('ph:probe-body'),'ph');
 assert.equal(componentFromMeshName('led:ph-light'),'ph');
 assert.equal(componentFromMeshName('valve:coil'),'valve');
 assert.equal(componentFromMeshName('wire:power-bus'),null);
});
