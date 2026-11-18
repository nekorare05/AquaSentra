'use strict';
const mongoose=require('mongoose');
const {Schema}=mongoose;
const control=require('./control');
const config=require('../../config/control.json');
const {explain}=require('./explanation');
const {SensorReading}=require('../models');
const State=mongoose.model('ControlState',new Schema({device_id:{type:String,unique:true},snapshot:Schema.Types.Mixed}));
const Detection=mongoose.model('AnomalyDetection',new Schema({device_id:String,reading_id:{type:Schema.Types.ObjectId,unique:true},model:Schema.Types.Mixed,decision:Schema.Types.Mixed,created_at:{type:Date,default:Date.now}}));
const ValveEvent=mongoose.model('ValveEvent',new Schema({event_id:{type:String,unique:true},device_id:String,detail:Schema.Types.Mixed}));
const Explanation=mongoose.model('Explanation',new Schema({device_id:String,provider:String,service_status:String,text:String,created_at:{type:Date,default:Date.now}}));
let queue=Promise.resolve();
function serialized(fn){const next=queue.then(fn);queue=next.catch(()=>{});return next;}
async function load(id){return (await State.findOne({device_id:id}).lean())?.snapshot||control.initial();}
async function save(id,s){
  // Journal before updating snapshot or allowing the next virtual tick. Idempotent IDs.
  for(const e of s.events)await ValveEvent.updateOne({event_id:e.id},{$setOnInsert:{event_id:e.id,device_id:id,detail:e}},{upsert:true});
  s.events=[];await State.updateOne({device_id:id},{$set:{snapshot:s}},{upsert:true});
}
async function infer(r){
  if(!r.validity?.is_valid || !r.eligible_for_live_decision)return {status:'excluded',score:null,class:null};
  try{
    const body=Object.fromEntries(['pH','turbidity','TDS','temperature_c'].map(k=>[k,r.payload[k]]));
    const response=await fetch(`${process.env.ML_URL||'http://127.0.0.1:8001'}/predict`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(2500)});
    if(!response.ok)throw Error('inference response');
    const m=await response.json();
    if(m.status!=='available'||!Number.isFinite(m.score)||m.score<0||m.score>1||!Number.isFinite(m.threshold)||m.threshold<0||m.threshold>1||m.class!==(m.score>=m.threshold?'Anomalous':'Normal'))throw Error('invalid inference');
    return m;
  }catch{return {status:'unavailable',score:null,class:null};}
}
async function assess(r){return serialized(async()=>{
  const model=await infer(r),s=await load(r.device_id);
  control.processReading(s,r,model,config);
  const decision={outcome:s.outcome,count:s.count,critical_count:s.critical_count,pending:s.pending,configuration_version:config.version};
  await Detection.updateOne({reading_id:r._id},{$setOnInsert:{device_id:r.device_id,reading_id:r._id,model,decision}},{upsert:true});
  await SensorReading.updateOne({_id:r._id},{$set:{model,decision}});
  await save(r.device_id,s);return {model,decision,valve:s.valve};
});}
async function snapshot(id){const state=await load(id);const detection=await Detection.findOne({device_id:id}).sort({created_at:-1,_id:-1}).lean();return {state,model:detection?.model||{status:'awaiting_data',score:null,class:null}};}
function mutate(id,action,body){return serialized(async()=>{const s=await load(id);if(action==='restore')control.restore(s,config,body.inspected);else control.setFault(s,body.mode);await save(id,s);return s;});}
function startTicker(){control.validate(config);const timer=setInterval(()=>serialized(async()=>{for(const row of await State.find().lean()){control.tick(row.snapshot,config);await save(row.device_id,row.snapshot);}}).catch(e=>console.error('virtual-tick',e.message)),500);timer.unref();return timer;}
async function explanation(id,provider){const result=explain(await load(id),provider);return Explanation.create({device_id:id,...result});}
module.exports={assess,snapshot,mutate,startTicker,explanation,config,State,Detection,ValveEvent,Explanation};
