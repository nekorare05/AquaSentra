import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, ArrowUpRight,
  Bell, CheckCircle2, ChevronDown, CircleHelp, Clock3, Database, Droplets,
  ExternalLink, FlaskConical, Gauge, History, LayoutDashboard, LockKeyhole, LogOut,
  Menu, Radio, RefreshCcw, Search, Settings2, ShieldAlert, ShieldCheck,
  SlidersHorizontal, Thermometer, Wifi, WifiOff, X, ZapOff, Sparkles, Wrench
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis,
  YAxis, ReferenceLine
} from 'recharts';
import { apiGet } from './api';

const LAB_URL = window.location.port === '4173' ? 'http://127.0.0.1:4174' : 'http://127.0.0.1:5174';

const FIELDS = [
  { key: 'pH', title: 'pH level', unit: 'pH', tint: 'mint', icon: FlaskConical, decimals: 2 },
  { key: 'turbidity', title: 'Turbidity', unit: 'NTU', tint: 'sky', icon: Droplets, decimals: 2 },
  { key: 'TDS', title: 'Dissolved solids', unit: 'mg/L', tint: 'violet', icon: Gauge, decimals: 0 },
  { key: 'temperature_c', title: 'Temperature', unit: '°C', tint: 'amber', icon: Thermometer, decimals: 1 }
];

const SIDEBAR = [
  { id: 'overview', name: 'Overview', icon: LayoutDashboard },
  { id: 'history', name: 'Reading history', icon: History },
  { id: 'alerts', name: 'Alerts & events', icon: Bell },
  { id: 'detection', name: 'Detection', icon: Activity },
  { id: 'valve', name: 'Valve Control', icon: ZapOff },
  { id: 'settings', name: 'Parameters', icon: Settings2 }
];

const num = (n, decimals = 1) => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(decimals) : '—';
const dt = value => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'No measurement';
const timeOnly = value => value ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
const safeRating = rating => ['Normal', 'Risky', 'Critical'].includes(rating) ? rating : null;
const ratingClass = rating => ({ Normal: 'normal', Risky: 'risky', Critical: 'critical' }[rating] || 'unknown');

async function apiPost(path, credentials, body) {
  const res = await fetch(`/api/v1/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': credentials.id,
      'x-user-token': credentials.token
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function RatingPill({ rating, prefix = '' }) {
  const r = safeRating(rating);
  return <span className={`rating-pill ${ratingClass(r)}`}><span className="pill-dot"/>{prefix}{r || 'Not rated'}</span>;
}

function Empty({ icon: Icon = Database, title, message }) {
  return <div className="empty"><Icon size={28} strokeWidth={1.5}/><h3>{title}</h3><p>{message}</p></div>;
}

function LiveIcon({ status }) {
  return status === 'online' ? <Wifi size={14}/> : <WifiOff size={14}/>;
}

function MiniMetric({ field, reading, rating, selected, onClick }) {
  const Icon = field.icon;
  const v = reading?.payload?.[field.key];
  return <button type="button" className={`metric-card tint-${field.tint} ${selected ? 'metric-selected' : ''}`} onClick={onClick} aria-pressed={selected}>
    <div className="metric-top"><span className="metric-icon"><Icon size={18}/></span><span className="metric-trend">{field.key === 'temperature_c' ? 'Operational' : (rating?.[field.key] || 'Awaiting data')}</span></div>
    <div className="metric-title">{field.title}</div>
    <div className="metric-value">{num(v, field.decimals)} <span>{field.unit}</span></div>
  </button>;
}

function TrendGraph({ readings, field, limits, compact = false }) {
  const candidates = (readings || []).filter(r => r.validity?.is_valid && r.payload && Number.isFinite(r.payload[field.key]));
  const data = candidates.slice().sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at)).map((r, i) => ({
    index: i, date: r.measured_at, value: r.payload[field.key], rating: r.rule_rating, delayed: r.is_delayed
  }));
  if (!data.length) return <Empty icon={Activity} title="No valid readings yet" message="Virtual sensor readings will populate this graph once ingested."/>;
  const normalLimits = field.key === 'pH' ? [limits?.pH?.normal_min, limits?.pH?.normal_max] : field.key === 'turbidity' ? [limits?.turbidity?.normal_max] : field.key === 'TDS' ? [limits?.TDS?.normal_max] : [];
  return <div className={`chart-frame ${compact ? 'compact-chart' : ''}`} role="img" aria-label={`${field.title} time series from valid sensor readings`}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 10, bottom: 0, left: -16 }}>
        <defs><linearGradient id={`grad-${field.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0284c7" stopOpacity={0.2}/><stop offset="100%" stopColor="#0284c7" stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 4"/>
        <XAxis dataKey="date" tickFormatter={timeOnly} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} minTickGap={30}/>
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={55}/>
        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', color: '#0f172a' }} labelFormatter={dt} formatter={(value, _name, props) => [`${num(value, field.decimals)} ${field.unit} · ${props?.payload?.rating || 'Not rated'}${props?.payload?.delayed ? ' (delayed)' : ''}`, field.title]}/>
        {normalLimits.filter(Number.isFinite).map((v, i) => <ReferenceLine key={i} y={v} stroke="#94a3b8" strokeDasharray="3 3"/>)}
        <Area type="monotone" dataKey="value" name={field.title} stroke="#0284c7" strokeWidth={2} dot={data.length <= 18 ? { fill: '#0284c7', r: 3, strokeWidth: 0 } : false} fill={`url(#grad-${field.key})`} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

function Connect({ onConnect, busy, error }) {
  const [id, setId] = useState('research-viewer');
  const [token, setToken] = useState('');
  return <div className="login-outer">
    <div className="login-card">
      <div className="login-logo"><span className="brand-mark"><Droplets size={22}/></span><span>Aqua<span>Sentra</span></span></div>
      <h1>Water monitoring</h1>
      <p className="login-description">Sign in to see sensor readings, review alerts and track changes in water quality.</p>
      <form onSubmit={e => { e.preventDefault(); if (id.trim() && token) onConnect({ id: id.trim(), token }); }}>
        <label htmlFor="account-id">User ID</label>
        <input id="account-id" autoComplete="username" value={id} maxLength={64} onChange={e => setId(e.target.value)} placeholder="research-viewer or research-admin" required/>
        <label htmlFor="account-token">Access token</label>
        <input id="account-token" type="password" autoComplete="current-password" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste access token from backend/.env" required/>
        {error && <div className="form-error" role="alert"><AlertCircle size={15}/>{error}</div>}
        <button className="primary-button login-button" type="submit" disabled={busy}>{busy ? 'Connecting…' : 'Connect to dashboard'} <ArrowUpRight size={16}/></button>
      </form>
      <div className="login-note"><LockKeyhole size={14}/> Your access token stays in this tab until you close or reload it.</div>
      <a className="login-lab-link" href={`${LAB_URL}/#components`}>Explore the 3D component library <ArrowUpRight size={16}/></a>
    </div>
    <footer className="login-footer">AquaSentra Research Prototype · Stages 1–7 · Not a certified drinking-water safety device</footer>
  </div>;
}

function EventsList({ alerts, limit = 6 }) {
  if (!alerts?.length) return <Empty icon={Bell} title="No alerts recorded" message="Alerts trigger when eligible readings exceed provisional reference bounds or sensors fail validation."/>;
  return <div className="event-list">{alerts.slice(0, limit).map(a => {
    const critical = a.kind === 'critical', faulty = a.kind === 'sensor_fault';
    const Icon = critical ? ShieldAlert : faulty ? AlertCircle : AlertTriangle;
    return <div className="event-item" key={a._id}><span className={`event-icon ${critical ? 'critical' : faulty ? 'fault' : 'risky'}`}><Icon size={16}/></span>
      <div className="event-main"><h4>{a.title}</h4><p>{a.message}</p><div className="event-meta">{a.kind.replaceAll('_', ' ')} · {dt(a.occurred_at)} · {a.device_id}</div></div>
      <span className={`event-severity ${critical ? 'critical' : faulty ? 'fault' : 'risky'}`}>{a.severity}</span>
    </div>;
  })}</div>;
}

function SafetyBox({ small = false }) {
  return <div className={`safety-box ${small ? 'safety-small' : ''}`}><FlaskConical size={18}/><div><strong>Research prototype — not certified</strong><p>Rule ratings are provisional study-defined signals, not certified drinking-water determinations. Water potability requires professional laboratory chemical and bacteriological testing.</p></div></div>;
}

/** Integrated component for Detection & Virtual Isolation simulation controls.
 * Preserves exact headings, buttons and checkboxes required by Stage 7 tests while styling cleanly.
 */
function DetectionAndIsolationSection({ summary, credentials, standalone = false }) {
  const [message, setMessage] = useState('');
  const [text, setText] = useState('');
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [inspected, setInspected] = useState(false);
  const device = summary?.selected_device_id;
  const s = summary?.control;
  const v = summary?.valve;
  const m = summary?.model;

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (device && credentials) {
        apiGet(`control?device_id=${encodeURIComponent(device)}`, credentials)
          .then(r => { if (active) setEvents(r.events || []); })
          .catch(() => {});
      }
    };
    refresh();
    const t = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(t); };
  }, [device, credentials]);

  async function action(path, body) {
    setBusy(true); setMessage('');
    try {
      const result = await apiPost(path, credentials, { device_id: device, ...body });
      if (result.text) setText(result.text);
      else setMessage('Recorded. State refreshes automatically.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel research-panel" aria-label="Detection and virtual valve">
    <div className="panel-header">
      <div>
        <h3>Detection & virtual isolation</h3>
        <p>Software simulation only · no physical actuation or flow measurement</p>
      </div>
      <span className="card-title-badge"><Activity size={13}/> ML & Virtual Logic</span>
    </div>

    <div className="parameter-grid">
      <div className="panel">
        <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>XGBoost Anomaly Inference</h4>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-light)' }}>Status: <strong>{m?.status || 'Awaiting data'}</strong> · Class: <strong>{m?.class || 'No class'}</strong></p>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>Anomaly score: {m?.score == null ? 'unavailable' : m.score.toFixed(4)}</div>
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-light)' }}>Threshold: {m?.threshold ?? '—'} · synthetic-only training</p>
      </div>
      <div className="panel">
        <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>Persistence & Confirmation</h4>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-light)' }}>ML count: {s?.count ?? 0} · Critical count: {s?.critical_count ?? 0}</p>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>Outcome: {s?.outcome || 'Awaiting data'}</div>
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-light)' }}>Confirmation: {s?.pending ? 'Requested — awaiting fresh repeat' : 'None pending'}</p>
      </div>
      <div className="panel" style={{ gridColumn: standalone ? 'span 2' : 'span 2' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: '14px' }}>Virtual Valve State</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '12px' }}>
          <div>Commanded: <strong>{v?.commanded || 'none'}</strong></div>
          <div>Acknowledged: <strong>{v?.acknowledged || 'none'}</strong></div>
          <div>Verified: <strong className={v?.verified === 'closed' ? 'warn-text' : v?.verified === 'open' ? 'good-text' : 'muted-text'}>{v?.verified || 'unknown'}</strong></div>
          <div>Fault: <strong className={v?.fault ? 'danger-text' : ''}>{v?.fault || 'none'}</strong></div>
          <div>Supply: <strong>{v?.supply_status || 'unknown'}</strong></div>
        </div>
      </div>
    </div>

    <details>
      <summary>Administrator simulation controls</summary>
      <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: '8px 0' }}>Viewer accounts are denied control by the server. Restoration requires fresh Normal rule and model results, resolved faults, and inspection acknowledgment.</p>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', margin: '10px 0', cursor: 'pointer' }}>
        <input type="checkbox" checked={inspected} onChange={e => setInspected(e.target.checked)}/> I have inspected the simulated scenario and authorize virtual restoration.
      </label>
      <div className="simulation-actions">
        <button className="primary" disabled={busy || !inspected} onClick={() => action('control/restore', { inspected })}>Restore virtual supply</button>
        {['none', 'no_ack', 'stuck', 'no_feedback', 'power_loss'].map(mode => <button key={mode} disabled={busy} onClick={() => action('control/fault', { mode })}>{mode === 'none' ? 'Clear fault injection' : `Simulate ${mode.replaceAll('_', ' ')}`}</button>)}
      </div>
    </details>

    {message && <p role="status" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>{message}</p>}

    <h4 style={{ margin: '18px 0 4px', fontSize: '14px' }}>AI explanation</h4>
    <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: '0 0 10px' }}>The free mock provider generates a structured template, not an LLM response. Explanations cannot change detection or valve decisions.</p>
    <div className="simulation-actions">
      <button disabled={busy} onClick={() => action('explanations', { provider: 'mock' })}>Explain current state</button>
      <button disabled={busy} onClick={() => action('explanations', { provider: 'unavailable' })}>Demonstrate AI fallback</button>
    </div>
    {text && <p className="explanation-text" role="status">{text}</p>}

    <h4 style={{ margin: '18px 0 8px', fontSize: '14px' }}>Control event journal</h4>
    <div className="table-scroll" style={{ maxHeight: '200px' }}>
      <table className="reading-table">
        <thead>
          <tr><th>Time</th><th>Event</th><th>Details</th></tr>
        </thead>
        <tbody>
          {events.length ? events.slice(0, 10).map(e => <tr key={e.event_id}>
            <td className="mono-sm">{new Date(e.detail.at).toLocaleTimeString()}</td>
            <td><strong>{e.detail.kind}</strong></td>
            <td>{e.detail.target || e.detail.fault || e.detail.mode || e.detail.reason || 'Virtual research event'}</td>
          </tr>) : <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-light)' }}>No recorded control events</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}

/* Page 1: Overview */
function OverviewPage({ summary, readings, alerts, params, selectedMetric, onMetric, setPage, credentials }) {
  const selected = FIELDS.find(f => f.key === selectedMetric) || FIELDS[0];
  const latest = summary?.latest_live_valid_reading;
  const status = summary?.device_status || 'never_seen';
  const rating = safeRating(latest?.rule_rating);
  const ratingMessage = {
    Normal: 'The measured indicators are within the study ranges.',
    Risky: 'At least one indicator has reached the early-warning range.',
    Critical: 'At least one indicator has crossed a critical threshold.'
  };

  return <>
    <section className={`water-summary ${ratingClass(rating)}`} aria-label="Latest water assessment">
      <div className="water-assessment">
        <h2>Latest water assessment</h2>
        <RatingPill rating={rating}/>
        <p>{ratingMessage[rating] || 'Waiting for a valid, rated sensor reading.'}</p>
        <small>Study thresholds for pH, turbidity and dissolved solids. Drinking-water safety requires laboratory testing.</small>
      </div>
      <div className="water-device">
        <span>Monitoring device</span>
        <strong>{summary?.selected_device_id || 'No device selected'}</strong>
        <span><LiveIcon status={status}/> {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'No contact yet'}</span>
        <small>Last contact · {dt(summary?.devices?.find(d => d.device_id === summary.selected_device_id)?.last_seen_at)}</small>
      </div>
    </section>
    <div className="readings-heading">
      <div><h2>Sensor readings</h2><p>Select a measurement to see its trend.</p></div>
      <small>{latest && dt(latest.measured_at)}</small>
    </div>
    <div className="metric-grid">
      {FIELDS.map(field => <MiniMetric key={field.key} field={field} reading={latest} rating={latest?.rule_details?.individual} selected={selectedMetric === field.key} onClick={() => onMetric(field.key)}/>)}
    </div>

    <div className="content-grid">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Measurement Trend</h3>
            <p>Valid readings · {selected.title}</p>
          </div>
          <select className="compact-select" aria-label="Chart parameter" value={selectedMetric} onChange={e => onMetric(e.target.value)}>
            {FIELDS.map(f => <option key={f.key} value={f.key}>{f.title}</option>)}
          </select>
        </div>
        <TrendGraph readings={readings} field={selected} limits={params?.rule_rating}/>
        <div className="chart-caption"><span className="legend-dot"/> Reference limits marked with dashed guides. Historical/delayed records never trigger live alarms.</div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>System Status</h3>
            <p>Device, model and valve</p>
          </div>
          <Activity size={18} className="header-icon"/>
        </div>
        <div className="status-list">
          <div><span><Radio size={15}/> Sensor connection</span><strong className={status === 'online' ? 'good-text' : 'muted-text'}>{status === 'online' ? 'Recent contact' : 'No contact'}</strong></div>
          <div><span><ShieldCheck size={15}/> Threshold checks</span><strong className="good-text">Study ranges</strong></div>
          <div><span><Activity size={15}/> Anomaly detection</span><strong className="muted-text">{summary?.model?.class || summary?.model?.status || 'Awaiting data'}</strong></div>
          <div><span><ZapOff size={15}/> Simulated valve</span><strong className={summary?.valve?.verified === 'closed' ? 'warn-text' : 'muted-text'}>{summary?.valve?.verified || 'Virtual / Unknown'}</strong></div>
          <div><span><Droplets size={15}/> Water flow</span><strong className="muted-text">Unknown (No Flow Meter)</strong></div>
        </div>
        <div className="status-note"><CircleHelp size={16}/> Virtual valve acknowledgment and simulated position feedback are separate. Physical fluid flow remains unmeasured.</div>
      </div>
    </div>

    <div className="content-grid">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Recent Alerts & Events</h3>
            <p>Operational warnings and sensor notices</p>
          </div>
          <button className="text-button" onClick={() => setPage('alerts')}>View all alerts <ArrowUpRight size={14}/></button>
        </div>
        <EventsList alerts={alerts} limit={3}/>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Data Quality</h3>
            <p>Recently received sensor readings</p>
          </div>
          <Database size={18} className="header-icon"/>
        </div>
        <div className="quality-stat"><span>Readings received</span><strong>{summary?.recent_count ?? 0}</strong></div>
        <div className="quality-stat"><span>Flagged readings</span><strong>{summary?.recent_invalid_count ?? 0}</strong></div>
        <div className="quality-stat"><span>Risky / Critical Events</span><strong>{(summary?.recent_risky_count ?? 0) + (summary?.recent_critical_count ?? 0)}</strong></div>
        <div className="data-quality-foot"><CheckCircle2 size={14}/> Invalid records are excluded from live rating calculations.</div>
      </div>
    </div>

    <details className="advanced-monitoring">
      <summary>Detection details and simulation controls</summary>
      <DetectionAndIsolationSection summary={summary} credentials={credentials}/>
    </details>
  </>;
}

/* Page 2: Readings and History */
function HistoryPage({ readings, params, selectedMetric, onMetric, period, setPeriod }) {
  const [onlyFaults, setOnlyFaults] = useState(false);
  const field = FIELDS.find(f => f.key === selectedMetric) || FIELDS[0];
  const rows = onlyFaults ? readings.filter(r => !r.validity?.is_valid || r.rule_rating === 'Critical' || r.rule_rating === 'Risky') : readings;

  return <>
    <div className="page-filter"><select className="compact-select" aria-label="History time range" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">All available (latest 500)</option><option value="24h">Past 24 hours</option><option value="7d">Past 7 days</option></select></div>
    <div className="panel wide-chart">
      <div className="panel-header">
        <div>
          <h3>{field.title} Time Series</h3>
          <p>Valid readings with provisional reference overlay</p>
        </div>
        <select className="compact-select" value={selectedMetric} onChange={e => onMetric(e.target.value)} aria-label="Select history metric">
          {FIELDS.map(f => <option value={f.key} key={f.key}>{f.title}</option>)}
        </select>
      </div>
      <TrendGraph readings={readings} field={field} limits={params?.rule_rating}/>
    </div>

    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Stored Sensor Records</h3>
          <p>Showing {rows.length} records · includes flagged records</p>
        </div>
        <label className="check-filter" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <input type="checkbox" checked={onlyFaults} onChange={e => setOnlyFaults(e.target.checked)}/> Warnings / faults only
        </label>
      </div>
      {rows.length ? <div className="table-scroll">
        <table className="reading-table">
          <thead>
            <tr>
              <th>Measured At</th>
              <th>pH</th>
              <th>Turbidity</th>
              <th>TDS</th>
              <th>Temp</th>
              <th>Rule Rating</th>
              <th>Record Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => <tr key={r._id}>
              <td className="mono-sm">{dt(r.measured_at)}</td>
              <td>{num(r.payload?.pH, 2)}</td>
              <td>{num(r.payload?.turbidity, 2)} <small>NTU</small></td>
              <td>{num(r.payload?.TDS, 0)} <small>mg/L</small></td>
              <td>{num(r.payload?.temperature_c, 1)} <small>°C</small></td>
              <td>{r.validity?.is_valid ? <RatingPill rating={r.rule_rating}/> : <span style={{ color: 'var(--critical-text)' }}>Not rated</span>}</td>
              <td><span className={`status-tag ${!r.validity?.is_valid ? 'bad' : r.is_delayed ? 'delayed' : 'good'}`}>{!r.validity?.is_valid ? `Invalid: ${(r.validity.codes || []).join(', ')}` : r.is_delayed ? 'Delayed' : 'Valid'}</span></td>
            </tr>)}
          </tbody>
        </table>
      </div> : <Empty title="No matching records" message="Adjust filters or run simulator."/>}
    </div>
  </>;
}

/* Page 3: Alerts */
function AlertsPage({ alerts }) {
  const [type, setType] = useState('all');
  const list = type === 'all' ? alerts : alerts.filter(a => a.kind === type);

  return <>
    <div className="page-filter"><select className="compact-select" value={type} onChange={e => setType(e.target.value)} aria-label="Filter alert type"><option value="all">All alert types</option><option value="critical">Critical</option><option value="early_warning">Early warning</option><option value="sensor_fault">Sensor fault</option></select></div>
    <div className="alert-summary">
      <div className="alert-summary-item"><span className="alert-icon-critical"><ShieldAlert size={20}/></span><div><strong>{alerts.filter(a => a.kind === 'critical').length}</strong><span>Critical Alerts</span></div></div>
      <div className="alert-summary-item"><span className="alert-icon-warning"><AlertTriangle size={20}/></span><div><strong>{alerts.filter(a => a.kind === 'early_warning').length}</strong><span>Early Warnings</span></div></div>
      <div className="alert-summary-item"><span className="alert-icon-fault"><AlertCircle size={20}/></span><div><strong>{alerts.filter(a => a.kind === 'sensor_fault').length}</strong><span>Sensor Faults</span></div></div>
    </div>
    <div className="panel"><EventsList alerts={list} limit={500}/></div>
    <div className="info-banner"><CircleHelp size={16}/> Alerts record study-defined condition crossings. They do not initiate automated valve isolation without independent confirmation and persistence.</div>
  </>;
}

/* Page 4: Detection */
function DetectionPage({ summary, credentials }) {
  const m = summary?.model;
  const s = summary?.control;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function requestExplanation(provider) {
    setBusy(true); setMessage('');
    try {
      const res = await apiPost('explanations', credentials, { device_id: summary?.selected_device_id, provider });
      setText(res.text || 'No explanation returned.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    
    <div className="detection-grid">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>XGBoost Machine Learning Model</h3>
            <p>Supervised anomaly detector trained on synthetic water quality episodes</p>
          </div>
          <span className="card-title-badge"><Sparkles size={12}/> AI / ML</span>
        </div>
        <div className="setting-row"><span>Inference Service Status</span><strong>{m?.status || 'Awaiting inference'}</strong></div>
        <div className="setting-row"><span>Current Prediction Class</span><strong className={m?.class === 'Anomalous' ? 'danger-text' : 'good-text'}>{m?.class || 'No class'}</strong></div>
        <div className="setting-row"><span>Decision Anomaly Score</span><strong>{m?.score == null ? '—' : m.score.toFixed(4)}</strong></div>
        <div className="setting-row"><span>Decision Threshold</span><strong>{m?.threshold ?? '—'}</strong></div>
        <div className="setting-row"><span>Artifact Format</span><strong>model.ubj (Universal Binary JSON)</strong></div>
        <div className="setting-row"><span>Dataset Lineage</span><strong>Synthetic generator (180/60/60 episodes)</strong></div>
        <p style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '14px', lineHeight: 1.5 }}>
          Note: High synthetic evaluation scores demonstrate generator separability, not validated real-world performance.
        </p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Persistence & Confirmation Logic</h3>
            <p>Protection against single-sample false alarms</p>
          </div>
          <span className="card-title-badge"><ShieldCheck size={12}/> Safety Logic</span>
        </div>
        <div className="setting-row"><span>ML Consecutive Anomaly Count (K)</span><strong>{s?.count ?? 0} / 3</strong></div>
        <div className="setting-row"><span>Critical Rule Crossing Count</span><strong>{s?.critical_count ?? 0}</strong></div>
        <div className="setting-row"><span>Confirmation Sample (C)</span><strong className={s?.pending ? 'warn-text' : ''}>{s?.pending ? 'Pending fresh verification' : 'None pending'}</strong></div>
        <div className="setting-row"><span>Pipeline Outcome</span><strong>{s?.outcome || 'Evaluating readings'}</strong></div>
        <div className="setting-row"><span>Decision Option</span><strong>Option A (Default strict rule & ML)</strong></div>
        <div className="setting-row"><span>Recovery Protocol</span><strong>Consecutive Normal samples clear counters</strong></div>
        <p style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '14px', lineHeight: 1.5 }}>
          Single abnormal readings never trigger virtual isolation. At least K persistent anomalies and a separate confirmation are required.
        </p>
      </div>
    </div>

    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Secondary AI Explanations</h3>
          <p>Textual rationale for current telemetry and isolation state</p>
        </div>
        <span className="card-title-badge">Informational Only</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: '0 0 12px' }}>
        AI explanations are provided for human operator comprehension. They are completely decoupled from control and cannot alter detection or virtual valve commands.
      </p>
      <div className="simulation-actions">
        <button disabled={busy} onClick={() => requestExplanation('mock')}>Explain current state</button>
        <button disabled={busy} onClick={() => requestExplanation('unavailable')}>Demonstrate AI fallback</button>
      </div>
      {message && <p role="status" style={{ fontSize: '12px', color: 'var(--critical-text)' }}>{message}</p>}
      {text && <div className="explanation-text" role="status"><strong>Generated Explanation:</strong><p style={{ margin: '6px 0 0' }}>{text}</p></div>}
    </div>
  </>;
}

/* Page 5: Valve Control */
function ValveControlPage({ summary, credentials }) {
  const v = summary?.valve;
  const s = summary?.control;
  const device = summary?.selected_device_id;
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [inspected, setInspected] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchJournal = () => {
      if (device && credentials) {
        apiGet(`control?device_id=${encodeURIComponent(device)}`, credentials)
          .then(r => { if (active) setEvents(r.events || []); })
          .catch(() => {});
      }
    };
    fetchJournal();
    const t = setInterval(fetchJournal, 3000);
    return () => { active = false; clearInterval(t); };
  }, [device, credentials]);

  async function sendAction(path, body) {
    setBusy(true); setMessage('');
    try {
      await apiPost(path, credentials, { device_id: device, ...body });
      setMessage('Action executed successfully.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    
    <div className="detection-grid">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Virtual Valve State</h3>
            <p>Simulated 12 V NC solenoid barrier</p>
          </div>
          <span className="card-title-badge"><ZapOff size={12}/> Actuation</span>
        </div>
        <div className="setting-row"><span>Commanded Valve State</span><strong>{v?.commanded || 'none'}</strong></div>
        <div className="setting-row"><span>Relay Acknowledgment</span><strong>{v?.acknowledged || 'none'}</strong></div>
        <div className="setting-row"><span>Simulated Position Verification</span><strong className={v?.verified === 'closed' ? 'warn-text' : v?.verified === 'open' ? 'good-text' : 'muted-text'}>{v?.verified || 'unknown'}</strong></div>
        <div className="setting-row"><span>Fault Status</span><strong className={v?.fault ? 'danger-text' : 'good-text'}>{v?.fault || 'none'}</strong></div>
        <div className="setting-row"><span>Virtual Supply State</span><strong>{v?.supply_status || 'unknown'}</strong></div>
        <div className="status-note" style={{ marginTop: '16px' }}>
          <CircleHelp size={16}/> <strong>Critical Safety Disclaimer:</strong> Relay acknowledgment is strictly distinct from verified mechanical closure. The software virtual verification is an illustrative research prototype; no physical valve or flow meter is connected.
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Administrator Simulation Controls</h3>
            <p>Authorized control commands (Requires research-admin)</p>
          </div>
          <span className="card-title-badge"><Wrench size={12}/> Admin Only</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: '0 0 10px' }}>
          Viewer roles will receive a 403 Forbidden response. Supply restoration requires confirmed Normal telemetry, cleared faults, and physical inspection sign-off.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', margin: '12px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={inspected} onChange={e => setInspected(e.target.checked)}/> I have inspected the simulated scenario and authorize virtual restoration.
        </label>
        <div className="simulation-actions">
          <button className="primary" disabled={busy || !inspected} onClick={() => sendAction('control/restore', { inspected })}>Restore virtual supply</button>
        </div>
        <h4 style={{ margin: '14px 0 6px', fontSize: '13px' }}>Simulate Virtual Fault Injection</h4>
        <div className="simulation-actions">
          {['none', 'no_ack', 'stuck', 'no_feedback', 'power_loss'].map(mode => <button key={mode} disabled={busy} onClick={() => sendAction('control/fault', { mode })}>{mode === 'none' ? 'Clear fault' : `Simulate ${mode.replaceAll('_', ' ')}`}</button>)}
        </div>
        {message && <p role="status" style={{ fontSize: '12px', fontWeight: 600, color: message.includes('failed') || message.includes('forbidden') ? 'var(--critical-text)' : 'var(--primary)' }}>{message}</p>}
      </div>
    </div>

    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Control Event Journal</h3>
          <p>Auditable log of commands, acknowledgments, faults, and restorations</p>
        </div>
        <Database size={18} className="header-icon"/>
      </div>
      <div className="table-scroll">
        <table className="reading-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event Kind</th>
              <th>Target / Mode / Reason</th>
              <th>Outcome Details</th>
            </tr>
          </thead>
          <tbody>
            {events.length ? events.slice(0, 15).map(e => <tr key={e.event_id}>
              <td className="mono-sm">{dt(e.detail.at)}</td>
              <td><strong>{e.detail.kind}</strong></td>
              <td>{e.detail.target || e.detail.fault || e.detail.mode || e.detail.reason || 'Virtual command'}</td>
              <td>{JSON.stringify(e.detail)}</td>
            </tr>) : <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '20px' }}>No control events recorded</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </>;
}

/* Page 6: Settings & Parameters */
function SettingsPage({ params, credentials }) {
  const r = params?.rule_rating;
  return <>
    
    <div className="panel parameter-head">
      <div>
        <div className="eyebrow" style={{ color: '#166534' }}>ACTIVE PARAMETER REGISTER</div>
        <h3>{params?.parameter_set_version || 'Not loaded'}</h3>
        <p>Provisional reference boundaries · adviser review pending · virtual simulation only</p>
      </div>
      <span className="parameter-chip"><LockKeyhole size={14}/> Read-only config</span>
    </div>

    <div className="parameter-grid">
      <div className="panel">
        <h3>pH Reference Limits</h3>
        <p>Measured in pH units. Normal is inclusive. Risky is outside Normal but within outer limits.</p>
        <div className="setting-row"><span>Normal Range</span><strong>{r ? `${r.pH.normal_min} – ${r.pH.normal_max} pH` : '—'}</strong></div>
        <div className="setting-row"><span>Risky Outer Bounds</span><strong>{r ? `${r.pH.risky_outer_min} – ${r.pH.risky_outer_max} pH` : '—'}</strong></div>
        <div className="setting-row"><span>Critical Bound</span><strong>Beyond Risky limits</strong></div>
      </div>

      <div className="panel">
        <h3>Turbidity Limits</h3>
        <p>Measured in Nephelometric Turbidity Units (NTU). User-defined early warning categories.</p>
        <div className="setting-row"><span>Normal Range</span><strong>≤ {r?.turbidity.normal_max ?? '—'} NTU</strong></div>
        <div className="setting-row"><span>Risky Range</span><strong>≤ {r?.turbidity.risky_max ?? '—'} NTU (above Normal)</strong></div>
        <div className="setting-row"><span>Critical Bound</span><strong>&gt; {r?.turbidity.risky_max ?? '—'} NTU</strong></div>
      </div>

      <div className="panel">
        <h3>Total Dissolved Solids (TDS)</h3>
        <p>Measured in mg/L (ppm). Illustrative study references.</p>
        <div className="setting-row"><span>Normal Range</span><strong>≤ {r?.TDS.normal_max ?? '—'} mg/L</strong></div>
        <div className="setting-row"><span>Risky Range</span><strong>≤ {r?.TDS.risky_max ?? '—'} mg/L (above Normal)</strong></div>
        <div className="setting-row"><span>Critical Bound</span><strong>&gt; {r?.TDS.risky_max ?? '—'} mg/L</strong></div>
      </div>

      <div className="panel">
        <h3>Operational Telemetry</h3>
        <p>System operational references and communication timeouts.</p>
        <div className="setting-row"><span>Operational Temperature</span><strong>{r ? `${r.temperature_operational_reference.min}–${r.temperature_operational_reference.max} °C` : '—'}</strong></div>
        <div className="setting-row"><span>Offline Timeout</span><strong>{params?.dashboard_offline_after_seconds ?? '—'} seconds</strong></div>
        <div className="setting-row"><span>Nominal Sampling Interval</span><strong>{params?.sampling_interval_seconds ?? '—'} seconds</strong></div>
      </div>
    </div>

    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>User Session & Permissions</h3>
          <p>Current authenticated account access level</p>
        </div>
        <LockKeyhole size={18} className="header-icon"/>
      </div>
      <div className="setting-row"><span>User Account ID</span><strong>{credentials?.id || '—'}</strong></div>
      <div className="setting-row"><span>Session Role</span><strong style={{ color: 'var(--primary)' }}>{credentials?.id?.includes('admin') ? 'Administrator (Full simulation control)' : 'Viewer (Read-only monitoring)'}</strong></div>
      <div className="setting-row"><span>Credential Storage</span><strong>Tab memory only (No persistent browser storage)</strong></div>
      <div className="setting-row"><span>Backend Node.js API</span><strong>https://127.0.0.1:8444/api/v1</strong></div>
    </div>

    <SafetyBox/>
    <div className="info-banner">
      <SlidersHorizontal size={18}/>
      <span>To update provisional threshold bounds, modify <code>backend/config/parameters.json</code>, increment <code>parameter_set_version</code>, restart the Node.js server, and run backend tests. Existing rated records retain their historical version tag and are never silently reclassified.</span>
    </div>
  </>;
}

export default function App() {
  const [credentials, setCredentials] = useState(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [page, setPage] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [period, setPeriod] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('pH');
  const [summary, setSummary] = useState(null);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [params, setParams] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const refresh = useCallback(async (creds, chosenDevice = '', range = 'all') => {
    if (!creds) return;
    const device = chosenDevice ? `device_id=${encodeURIComponent(chosenDevice)}` : '';
    let from = '';
    if (range !== 'all') {
      from = `from=${encodeURIComponent(new Date(Date.now() - (range === '24h' ? 1 : 7) * 86400000).toISOString())}`;
    }
    const search = [device, from, 'limit=500'].filter(Boolean).join('&');
    const dashSearch = device ? `?${device}` : '';
    const [dash, history, alarms, config] = await Promise.all([
      apiGet(`dashboard${dashSearch}`, creds),
      apiGet(`readings?${search}`, creds),
      apiGet(`alerts?${[device, 'limit=500'].filter(Boolean).join('&')}`, creds),
      apiGet('parameters', creds)
    ]);
    return { dash, history, alarms, config };
  }, []);

  const connect = async creds => {
    setLoginError(''); setLoginBusy(true);
    try {
      const result = await refresh(creds, '', period);
      setCredentials(creds);
      setSummary(result.dash);
      setReadings(result.history.readings || []);
      setAlerts(result.alarms.alerts || []);
      setParams(result.config);
      setDeviceId(result.dash.selected_device_id || '');
      setLastRefresh(new Date());
    } catch (error) {
      setLoginError(error.message === 'Failed to fetch' ? 'Cannot connect to local backend API. Ensure backend is running.' : error.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const logout = () => {
    setCredentials(null);
    setSummary(null);
    setReadings([]);
    setAlerts([]);
    setParams(null);
    setFetchError('');
    setPage('overview');
  };

  useEffect(() => {
    if (!credentials) return;
    let active = true;
    let busy = false;
    const update = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const result = await refresh(credentials, deviceId, period);
        if (active) {
          setSummary(result.dash);
          setReadings(result.history.readings || []);
          setAlerts(result.alarms.alerts || []);
          setParams(result.config);
          setLastRefresh(new Date());
          setFetchError('');
        }
      } catch (error) {
        if (active) {
          setFetchError(error.message === 'Failed to fetch' ? 'Backend unavailable. Check Node.js server.' : error.message);
          if (error.status === 401) logout();
        }
      } finally {
        busy = false;
        if (active) setLoading(false);
      }
    };
    update();
    const timer = setInterval(update, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [credentials, deviceId, period, tick, refresh]);

  const selectedDevice = summary?.selected_device_id || deviceId;
  const setView = view => { setPage(view); setMenuOpen(false); window.scrollTo(0, 0); };

  if (!credentials) return <Connect onConnect={connect} busy={loginBusy} error={loginError}/>;

  return <div className="app-shell">
    {menuOpen && <div className="mobile-scrim" onClick={() => setMenuOpen(false)}/>}
    
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand">
        <span className="brand-mark"><Droplets size={22}/></span>
        <div className="brand-name">Aqua<span>Sentra</span><small>HOUSEHOLD MONITORING</small></div>
        <button className="mobile-close icon-button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18}/></button>
      </div>


      <nav aria-label="Primary navigation">
        {SIDEBAR.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${page === id ? 'active' : ''}`}
            aria-current={page === id ? 'page' : undefined}
            onClick={() => setView(id)}
          >
            <Icon size={17}/>
            <span>{name}</span>
            {page === id && <span className="nav-active-dot"/>}
          </button>
        ))}
      </nav>

      <div className="sidebar-divider"/>


      <a
        href={LAB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="lab-link-card"
        title="Open interactive 3D Device Lab in a new tab"
      >
        <div className="lab-link-header">
          <div><Activity size={15}/> <span>AquaSentra 3D Lab</span></div>
          <ExternalLink size={13}/>
        </div>
        <div className="lab-link-desc">Explore the hardware and simulation.</div>
      </a>

      <div className="sidebar-spacer"/>

    </aside>

    <div className="app-main">
      <header className="topbar">
        <div className="top-left">
          <button className="menu-button icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={18}/></button>
          <div className="breadcrumb">AquaSentra <span>/</span> <strong>{SIDEBAR.find(s => s.id === page)?.name}</strong></div>
        </div>
        <div className="top-right">
          <div className="header-device">
            <Radio size={15}/>
            <select aria-label="Select device" value={selectedDevice || ''} onChange={e => setDeviceId(e.target.value)}>
              {(summary?.devices || []).map(d => <option key={d.device_id} value={d.device_id}>{d.device_id}</option>)}
            </select>
            <ChevronDown size={13}/>
          </div>
          <button className="icon-button refresh-button" title="Refresh" aria-label="Refresh" onClick={() => { setLoading(true); setTick(v => v + 1); }}>
            <RefreshCcw size={16} className={loading ? 'spin' : ''}/>
          </button>
          <button className="signout-button" aria-label="Sign out" onClick={logout}>
            <LogOut size={15}/>
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <main className="page-content">
        <div className="page-intro">
          <div className="intro-left">
            <h1>{page === 'overview' ? 'Water quality overview' : page === 'settings' ? 'Reference parameters' : SIDEBAR.find(s => s.id === page)?.name}</h1>
            <p>{page === 'overview' ? 'Latest readings and alerts for the selected device.' : page === 'history' ? 'Review past measurements and filter flagged readings.' : page === 'alerts' ? 'Review threshold warnings and sensor faults.' : page === 'detection' ? 'See which readings the model flagged and whether a repeat reading confirmed them.' : page === 'valve' ? 'Compare the valve command with simulated position feedback.' : 'View the study thresholds and sampling settings.'}</p>
          </div>
          <div className="intro-right">
            <div className="refresh-state">
              <span className={`live-orb ${fetchError || !online ? 'interrupted' : ''}`}/> {fetchError || !online ? 'Updates paused' : 'Monitoring'}
              <span className="refresh-time">· Updated {lastRefresh ? timeOnly(lastRefresh) : '—'}</span>
            </div>
          </div>
        </div>

        {(!online || fetchError) && <div className="error-banner"><WifiOff size={16}/>{!online ? 'Browser offline. Cached telemetry may be stale.' : fetchError}</div>}

        {page === 'overview' && <OverviewPage summary={summary} readings={readings} alerts={alerts} params={params} selectedMetric={selectedMetric} onMetric={setSelectedMetric} setPage={setView} credentials={credentials}/>}
        {page === 'history' && <HistoryPage readings={readings} params={params} selectedMetric={selectedMetric} onMetric={setSelectedMetric} period={period} setPeriod={setPeriod}/>}
        {page === 'alerts' && <AlertsPage alerts={alerts}/>}
        {page === 'detection' && <DetectionPage summary={summary} credentials={credentials}/>}
        {page === 'valve' && <ValveControlPage summary={summary} credentials={credentials}/>}
        {page === 'settings' && <SettingsPage params={params} credentials={credentials}/>}

        <footer className="app-footer">
          <span>© 2026 AquaSentra · Stages 1–7 Research Prototype</span>
          <span><ShieldAlert size={14}/> Not a certified drinking-water safety device · Virtual simulation only</span>
        </footer>
      </main>
    </div>
  </div>;
}
