'use strict';
const { randomUUID } = require('node:crypto');
function validate(c) {
  if (c.mode !== 'virtual_only' || !['A','B'].includes(c.option)) throw Error('Only virtual mode and options A/B are allowed');
  for (const key of ['K','K_c','M','T_max_seconds','confirmation_wait_seconds','confirmation_timeout_seconds','retry_limit','offline_threshold_N','sampling_interval_seconds','rearm_holdoff_seconds','valve_ack_timeout_seconds','max_closure_time_seconds','simulated_ack_seconds','simulated_verification_seconds']) {
    if (!Number.isFinite(c[key]) || c[key] <= 0) throw Error(`Invalid control parameter ${key}`);
  }
  for (const key of ['K','K_c','M','retry_limit','offline_threshold_N']) if (!Number.isInteger(c[key])) throw Error(`Integer required: ${key}`);
  if (c.confirmation_timeout_seconds <= c.confirmation_wait_seconds || c.max_closure_time_seconds <= c.valve_ack_timeout_seconds) throw Error('Invalid timeout ordering');
}
function initial() {
  return { count:0, critical_count:0, invalid_count:0, last_measurement:0, last_valid:0, last_contact:0, missing:0, pending:null, holdoff_until:0, outcome:'startup_inspection_required', fault_mode:'none', valve:{virtual:true, commanded:null, acknowledged:null, verified:null, fault:null, relay_energized:false, simulated_position:'closed', supply_status:'unknown', command_id:null}, events:[] };
}
function event(s,kind,now,details={}) { s.events.push({id:randomUUID(),kind,at:new Date(now).toISOString(),...details}); }
function reset(s) { s.count=0; s.critical_count=0; s.pending=null; }
function command(s,target,now,reason) {
  const id=randomUUID();
  s.valve={...s.valve,command_id:id,commanded:target,commanded_at:now,acknowledged:null,acknowledged_at:null,verified:null,verified_at:null,fault:null,supply_status:'unknown'};
  event(s,'commanded',now,{command_id:id,target,reason,virtual:true});
  s.outcome=target==='closed'?'isolation_commanded':'restoration_commanded'; reset(s);
}
function expire(s,c,now) {
  if(s.last_valid && now-s.last_valid > c.T_max_seconds*1000 && (s.count || s.critical_count || s.pending)) { reset(s);s.outcome='persistence_expired';event(s,'persistence_expired',now); }
  if(s.pending && now>s.pending.deadline){ reset(s); s.outcome='confirmation_timeout';event(s,'confirmation_timeout',now); }
}
function processReading(s,r,model,c,now=Date.now()) {
  validate(c); expire(s,c,now); s.last_contact=now;s.missing=0;
  const stamp=new Date(r.measured_at).getTime();
  // Historical and duplicate data have no effect on live counters or confirmations.
  if(r.is_delayed || r.validity?.codes?.includes('DUPLICATE_READING') || (stamp && stamp<=s.last_measurement)) return s;
  if(!r.validity?.is_valid || !r.eligible_for_live_decision || model.status!=='available') {
    s.invalid_count++; s.last_observation_valid=false; s.outcome=model.status==='unavailable'?'model_unavailable':'invalid_reading';
    if(s.pending && r.purpose==='repeat_confirmation'){
      s.pending.retries++; if(s.pending.retries>c.retry_limit){reset(s);s.outcome='confirmation_retry_exhausted';}
    }
    if(s.invalid_count>c.M) reset(s);
    event(s,'excluded',now,{reason:s.outcome});return s;
  }
  s.invalid_count=0;s.last_observation_valid=true;s.last_valid=now;s.last_measurement=stamp;
  const anomalous=model.class==='Anomalous', critical=r.rule_rating==='Critical', risky=['Risky','Critical'].includes(r.rule_rating);
  s.last_rating=r.rule_rating;s.last_model=model.class;
  // A single independent repeat record confirms either/both already-qualified pathways.
  if(s.pending && r.purpose==='repeat_confirmation' && stamp>s.pending.measurement && stamp>=s.pending.not_before && now>=s.pending.not_before){
    const p=s.pending;
    const modelPath=p.model && anomalous && risky;
    const criticalPath=c.option==='B' && p.critical && critical;
    if((modelPath || criticalPath) && now>=s.holdoff_until && s.valve.verified==='open' && !s.valve.fault){
      event(s,'confirmed',now,{model_path:modelPath,critical_path:criticalPath}); command(s,'closed',now,'confirmed_abnormality');
    } else {s.pending=null;if(!anomalous)s.count=0;if(!critical)s.critical_count=0;s.outcome=(!anomalous&&!critical)?'recovered':'confirmation_not_authorized';event(s,s.outcome,now);}
    return s;
  }
  if(r.purpose==='repeat_confirmation') {event(s,'unsolicited_or_early_confirmation',now);return s;}
  s.count=anomalous?s.count+1:0; s.critical_count=critical?s.critical_count+1:0;
  if(!anomalous && !critical){reset(s);s.outcome='normal';return s;}
  const modelReady=s.count>=c.K, criticalReady=c.option==='B' && s.critical_count>=c.K_c;
  if(now<s.holdoff_until){reset(s);s.outcome='rearm_holdoff';return s;}
  if(s.valve.commanded==='closed' || s.valve.fault){reset(s);s.outcome='isolated_or_fault';return s;}
  if(modelReady || (critical && !anomalous) || criticalReady){
    if(!s.pending) {
      s.pending={id:randomUUID(),model:modelReady,critical:criticalReady,measurement:stamp,not_before:now+c.confirmation_wait_seconds*1000,deadline:now+c.confirmation_timeout_seconds*1000,retries:0};
      event(s,'confirmation_requested',now,{request_id:s.pending.id,disagreement:critical&&!anomalous});
    }else { s.pending.model ||= modelReady;s.pending.critical ||= criticalReady; }
    s.outcome='awaiting_confirmation';
  } else s.outcome=anomalous?'unconfirmed_anomaly':'reference_warning';
  return s;
}
function tick(s,c,now=Date.now()) {
  expire(s,c,now);
  if(s.last_contact){
    const missing=Math.floor((now-s.last_contact)/(c.sampling_interval_seconds*1000));
    if(missing>s.missing){s.missing=missing;if(missing>c.M)reset(s);if(missing>=c.offline_threshold_N){s.outcome='communication_fault';event(s,'communication_fault',now,{missing});}}
  }
  const v=s.valve;if(!v.command_id || v.verified || v.fault)return s;
  const elapsed=(now-v.commanded_at)/1000;
  if(!v.acknowledged && elapsed>=c.simulated_ack_seconds && s.fault_mode!=='no_ack'){
    v.acknowledged=v.commanded;v.acknowledged_at=now;v.relay_energized=v.commanded==='open';event(s,'acknowledged',now,{command_id:v.command_id,virtual:true});
  }
  if(!v.acknowledged && elapsed>=c.valve_ack_timeout_seconds){v.fault='ack_timeout';event(s,'valve_fault',now,{command_id:v.command_id,fault:v.fault});return s;}
  if(v.acknowledged && elapsed>=c.simulated_verification_seconds && !['stuck','no_feedback'].includes(s.fault_mode)){
    v.simulated_position=v.commanded;v.verified=v.commanded;v.verified_at=now;v.supply_status=v.commanded==='closed'?'simulated_isolated':'simulated_open';
    event(s,'verified',now,{command_id:v.command_id,virtual:true,source:'simulated_independent_position'});
  }else if(!v.verified && elapsed>=c.max_closure_time_seconds){v.fault=s.fault_mode==='stuck'?'position_mismatch':'verification_timeout';event(s,'valve_fault',now,{command_id:v.command_id,fault:v.fault});}
  return s;
}
function restore(s,c,inspected,now=Date.now()) {
  if(inspected!==true || !s.last_observation_valid || !s.last_valid || now-s.last_valid>c.T_max_seconds*1000 || s.last_rating!=='Normal' || s.last_model!=='Normal' || s.pending || s.fault_mode!=='none' || (s.valve.command_id&&!s.valve.verified&&!s.valve.fault)) throw Error('Inspection, fresh Normal rule/model, no pending confirmation and resolved simulated fault required');
  command(s,'open',now,'authorized_inspection');s.holdoff_until=now+c.rearm_holdoff_seconds*1000;
  return s;
}
function setFault(s,mode,now=Date.now()){
  if(!['none','no_ack','stuck','no_feedback','power_loss'].includes(mode))throw Error('Unknown fault mode');
  s.fault_mode=mode;event(s,'fault_injected',now,{mode,virtual:true});
  if(mode==='power_loss'){reset(s);s.valve={...s.valve,relay_energized:false,simulated_position:'closed',command_id:null,commanded:null,acknowledged:null,verified:null,fault:'power_loss',supply_status:'unknown'};}
  return s;
}
module.exports={validate,initial,processReading,tick,restore,setFault};
