import React, {useState, useEffect} from 'react';
import {apiGet} from './api';

async function post(path, credentials, body){
  const res=await fetch(`/api/v1/${path}`,{method:'POST',headers:{'content-type':'application/json','x-user-id':credentials.id,'x-user-token':credentials.token},body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Request failed');return data;
}
export default function ResearchPanel({summary,credentials}){
  const [message,setMessage]=useState(''),[text,setText]=useState(''),[events,setEvents]=useState([]),[busy,setBusy]=useState(false),[inspected,setInspected]=useState(false);
  const device=summary?.selected_device_id,s=summary?.control,v=summary?.valve,m=summary?.model;
  useEffect(()=>{let active=true;setEvents([]);setText('');setMessage('');
    const refresh=()=>{if(device)apiGet(`control?device_id=${encodeURIComponent(device)}`,credentials).then(r=>{if(active)setEvents(r.events)}).catch(()=>{});};
    refresh();const t=setInterval(refresh,3000);return()=>{active=false;clearInterval(t)};
  },[device,credentials]);
  async function action(path,body){setBusy(true);setMessage('');try{const result=await post(path,credentials,{device_id:device,...body});if(result.text)setText(result.text);else setMessage('Recorded. State refreshes automatically.');}catch(e){setMessage(e.message);}finally{setBusy(false);}}
  return <section className="panel research-panel" aria-label="Detection and virtual valve">
    <div className="panel-header"><div><h3>Detection & virtual isolation</h3><p>Software simulation only · no physical actuation or flow measurement</p></div></div>
    <div className="parameter-grid">
      <div><h3>XGBoost</h3><p>{m?.status} · {m?.class||'No class'}</p><strong>Anomaly score: {m?.score==null?'unavailable':m.score.toFixed(4)}</strong><p>Threshold: {m?.threshold??'—'} · synthetic-only model</p></div>
      <div><h3>Persistence</h3><p>ML count: {s?.count??0} · Critical count: {s?.critical_count??0}</p><strong>{s?.outcome||'Awaiting data'}</strong><p>Confirmation: {s?.pending?'Requested — awaiting fresh repeat':'None pending'}</p></div>
      <div><h3>Virtual valve</h3><p>Commanded: <strong>{v?.commanded||'none'}</strong></p><p>Acknowledged: <strong>{v?.acknowledged||'none'}</strong></p><p>Verified (simulated): <strong>{v?.verified||'unknown'}</strong></p><p>Fault: <strong>{v?.fault||'none'}</strong></p><p>Supply: {v?.supply_status||'unknown'}</p></div>
    </div>
    <details><summary>Administrator simulation controls</summary><p>Viewer accounts are denied control by the server. Restoration requires fresh Normal rule and model results, resolved faults, and inspection acknowledgment.</p>
      <label><input type="checkbox" checked={inspected} onChange={e=>setInspected(e.target.checked)}/> I have inspected the simulated scenario and authorize virtual restoration.</label>
      <div className="simulation-actions"><button disabled={busy||!inspected} onClick={()=>action('control/restore',{inspected})}>Restore virtual supply</button>
        {['none','no_ack','stuck','no_feedback','power_loss'].map(mode=><button key={mode} disabled={busy} onClick={()=>action('control/fault',{mode})}>{mode==='none'?'Clear fault injection':`Simulate ${mode.replaceAll('_',' ')}`}</button>)}
      </div>
    </details>
    {message&&<p role="status">{message}</p>}
    <h3>AI explanation</h3><p>The free mock provider generates a template, not an LLM response. Explanations cannot change detection or valve decisions.</p>
    <div className="simulation-actions"><button disabled={busy} onClick={()=>action('explanations',{provider:'mock'})}>Explain current state</button><button disabled={busy} onClick={()=>action('explanations',{provider:'unavailable'})}>Demonstrate AI fallback</button></div>
    {text&&<p className="explanation-text" role="status">{text}</p>}
    <h3>Control event journal</h3><div className="table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>Details</th></tr></thead><tbody>{events.slice(0,12).map(e=><tr key={e.event_id}><td>{new Date(e.detail.at).toLocaleTimeString()}</td><td>{e.detail.kind}</td><td>{e.detail.target||e.detail.fault||e.detail.mode||e.detail.reason||'Virtual research event'}</td></tr>)}</tbody></table></div>
  </section>;
}
