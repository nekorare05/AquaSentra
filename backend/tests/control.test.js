const {test}=require('node:test');const assert=require('node:assert/strict');
const ctl=require('../src/services/control');const base=require('../config/control.json');
const {explain}=require('../src/services/explanation');
const A={status:'available',class:'Anomalous',score:.99},N={status:'available',class:'Normal',score:.01};
let t=1000000;
function state(){const s=ctl.initial();s.valve.verified='open';s.valve.commanded='open';return s;}
function row(rating='Risky',purpose='routine',extra={}){t+=1000;return {measured_at:new Date(t),rule_rating:rating,purpose,validity:{is_valid:true,codes:[]},eligible_for_live_decision:true,...extra};}
function feed(s,rating='Risky',m=A,purpose='routine',c=base,extra={}){const r=row(rating,purpose,extra);ctl.processReading(s,r,m,c,t);return s;}
function qualify(s,c=base){for(let i=0;i<c.K;i++)feed(s,'Risky',A,'routine',c);return s;}
function confirm(s,rating='Risky',m=A,c=base){t+=3000;return feed(s,rating,m,'repeat_confirmation',c);}
test('configuration rejects physical mode and invalid counters',()=>{assert.throws(()=>ctl.validate({...base,mode:'hardware'}));assert.throws(()=>ctl.validate({...base,K:0}));assert.throws(()=>ctl.validate({...base,K:1.5}));});
for(const rating of ['Normal','Risky','Critical'])for(const model of [N,A])test(`decision table ${rating}/${model.class}`,()=>{
  const s=state();for(let i=0;i<3;i++)feed(s,rating,model);confirm(s,rating,model);
  assert.equal(s.valve.commanded==='closed',model===A&&rating!=='Normal');
});
test('single anomaly cannot close; K requires independent confirmation',()=>{const s=state();feed(s);assert.equal(s.count,1);assert.equal(s.pending,null);feed(s);feed(s);assert.ok(s.pending);assert.equal(s.valve.commanded,'open');confirm(s);assert.equal(s.valve.commanded,'closed');assert.equal(s.valve.acknowledged,null);assert.equal(s.valve.verified,null);});
test('normal recovery resets counters without close',()=>{const s=qualify(state());confirm(s,'Normal',N);assert.equal(s.count,0);assert.equal(s.outcome,'recovered');assert.equal(s.valve.commanded,'open');});
test('invalid pauses to M then resets',()=>{const s=state();feed(s);for(let i=0;i<base.M;i++)feed(s,'Risky',A,'routine',base,{validity:{is_valid:false}});assert.equal(s.count,1);feed(s,'Risky',A,'routine',base,{validity:{is_valid:false}});assert.equal(s.count,0);});
test('delayed and duplicates do not increment or reset',()=>{const s=state();feed(s);feed(s,'Normal',N,'routine',base,{is_delayed:true});feed(s,'Normal',N,'routine',base,{validity:{is_valid:false,codes:['DUPLICATE_READING']}});assert.equal(s.count,1);});
test('out-of-order records excluded',()=>{const s=state();feed(s);const before=s.count;ctl.processReading(s,{...row(),measured_at:new Date(s.last_measurement-100)},A,base,t);assert.equal(s.count,before);});
test('confirmation cannot reuse triggering sample or arrive early',()=>{const s=qualify(state());const r=row('Risky','repeat_confirmation');r.measured_at=new Date(s.last_measurement);ctl.processReading(s,r,A,base,t);assert.equal(s.valve.commanded,'open');const early={...r,measured_at:new Date(s.last_measurement+1)};ctl.processReading(s,early,A,base,s.pending.not_before-1);assert.equal(s.valve.commanded,'open');});
test('confirmation timeout cannot command',()=>{const s=qualify(state());ctl.tick(s,base,t+31000);assert.equal(s.pending,null);assert.equal(s.outcome,'confirmation_timeout');assert.equal(s.valve.commanded,'open');});
test('invalid confirmation retry budget is bounded',()=>{const s=qualify(state());for(let i=0;i<3;i++)feed(s,'Risky',A,'repeat_confirmation',base,{validity:{is_valid:false}});assert.equal(s.pending,null);assert.equal(s.outcome,'confirmation_retry_exhausted');});
test('maximum age clears persistence',()=>{const s=state();feed(s);ctl.tick(s,base,t+181000);assert.equal(s.count,0);});
test('missing intervals reset and report communication fault',()=>{const s=state();feed(s);ctl.tick(s,base,t+181000);assert.equal(s.count,0);assert.equal(s.outcome,'communication_fault');assert.equal(s.valve.commanded,'open');});
test('model unavailable cannot authorize isolation',()=>{const s=qualify(state());confirm(s,'Critical',{status:'unavailable'});assert.equal(s.valve.commanded,'open');});
test('Option B allows confirmed persistent Critical with Normal model',()=>{const c={...base,option:'B'},s=state();for(let i=0;i<3;i++)feed(s,'Critical',N,'routine',c);confirm(s,'Critical',N,c);assert.equal(s.valve.commanded,'closed');});
test('simultaneous pathways produce exactly one command',()=>{const c={...base,option:'B'},s=state();for(let i=0;i<3;i++)feed(s,'Critical',A,'routine',c);confirm(s,'Critical',A,c);assert.equal(s.events.filter(e=>e.kind==='commanded').length,1);});
test('acknowledgment and position verification are separate',()=>{const s=qualify(state());confirm(s);const when=t;ctl.tick(s,base,when+1000);assert.equal(s.valve.acknowledged,'closed');assert.equal(s.valve.verified,null);ctl.tick(s,base,when+2000);assert.equal(s.valve.verified,'closed');});
for(const [mode,fault] of [['no_ack','ack_timeout'],['stuck','position_mismatch'],['no_feedback','verification_timeout']])test(`${mode} never reports verified closure`,()=>{const s=qualify(state());ctl.setFault(s,mode,t);confirm(s);ctl.tick(s,base,t+9000);assert.equal(s.valve.verified,null);assert.equal(s.valve.fault,fault);});
test('power loss deenergizes without inventing acknowledgment or verification',()=>{const s=state();ctl.setFault(s,'power_loss',t);assert.equal(s.valve.relay_energized,false);assert.equal(s.valve.simulated_position,'closed');assert.equal(s.valve.verified,null);});
test('restoration requires inspection and fresh Normal',()=>{const s=state();assert.throws(()=>ctl.restore(s,base,true,t));feed(s,'Normal',N);assert.throws(()=>ctl.restore(s,base,false,t));ctl.restore(s,base,true,t);assert.equal(s.valve.commanded,'open');assert.equal(s.valve.verified,null);assert.ok(s.holdoff_until>t);});
test('holdoff suppresses re-arm and requires new persistence afterward',()=>{const s=state();feed(s,'Normal',N);ctl.restore(s,base,true,t);ctl.tick(s,base,t+2000);qualify(s);assert.equal(s.count,0);assert.equal(s.pending,null);t+=11000;qualify(s);confirm(s);assert.equal(s.valve.commanded,'closed');});
test('explanations cannot mutate decisions; fallback explicit',()=>{const s=qualify(state()),before=JSON.stringify(s);assert.equal(explain(s).provider,'mock');assert.equal(explain(s,'offline').provider,'fallback');assert.equal(JSON.stringify(s),before);});

test('new commands clear old acknowledgment and verification timestamps',()=>{const s=state();s.valve.acknowledged_at=20;s.valve.verified_at=30;qualify(s);confirm(s);assert.equal(s.valve.acknowledged_at,null);assert.equal(s.valve.verified_at,null);});
test('repeat measured before request readiness is excluded',()=>{const s=qualify(state()),stamp=s.pending.not_before-1;const r={...row('Risky','repeat_confirmation'),measured_at:new Date(stamp)};ctl.processReading(s,r,A,base,s.pending.not_before+1000);assert.equal(s.valve.commanded,'open');});
test('invalid latest observation blocks restoration',()=>{const s=state();feed(s,'Normal',N);feed(s,'Normal',N,'routine',base,{validity:{is_valid:false}});assert.throws(()=>ctl.restore(s,base,true,t));});
