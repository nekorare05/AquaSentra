import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight,
  Bell, CheckCircle2, ChevronDown, CircleHelp, Clock3, Database, Droplets,
  FlaskConical, Gauge, History, LayoutDashboard, LockKeyhole, LogOut,
  Menu, Radio, RefreshCcw, Search, Settings2, ShieldAlert, ShieldCheck,
  SlidersHorizontal, Thermometer, Wifi, WifiOff, X, ZapOff
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis,
  YAxis, ReferenceLine
} from 'recharts';
import { apiGet } from './api';
import ResearchPanel from './ResearchPanel';

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
  { id: 'settings', name: 'Parameters', icon: Settings2 }
];
const num = (n, decimals = 1) => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(decimals) : '—';
const dt = value => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'No measurement';
const timeOnly = value => value ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
const safeRating = rating => ['Normal', 'Risky', 'Critical'].includes(rating) ? rating : null;
const ratingClass = rating => ({ Normal: 'normal', Risky: 'risky', Critical: 'critical' }[rating] || 'unknown');

function RatingPill({ rating, prefix = '' }) {
  const r = safeRating(rating);
  return <span className={`rating-pill ${ratingClass(r)}`}><span className="pill-dot"/>{prefix}{r || 'Not rated'}</span>;
}
function SectionHeading({ eyebrow, title, detail, action }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}
function Empty({ icon: Icon = Database, title, message }) {
  return <div className="empty"><Icon size={29} strokeWidth={1.5}/><h3>{title}</h3><p>{message}</p></div>;
}
function LiveIcon({ status }) {
  return status === 'online' ? <Wifi size={15}/> : <WifiOff size={15}/>;
}
function MiniMetric({ field, reading, rating, selected, onClick }) {
  const Icon = field.icon;
  const v = reading?.payload?.[field.key];
  return <button type="button" className={`metric-card tint-${field.tint} ${selected ? 'metric-selected' : ''}`} onClick={onClick}>
    <div className="metric-top"><span className="metric-icon"><Icon size={19}/></span><span className="metric-trend">{field.key === 'temperature_c' ? 'Operational only' : (rating?.[field.key] || 'Awaiting data')}</span></div>
    <div className="metric-title">{field.title}</div>
    <div className="metric-value">{num(v, field.decimals)} <span>{field.unit}</span></div>
    <div className="metric-bottom"><span className="metric-dot"/>{reading ? 'Latest eligible reading' : 'No eligible reading'}</div>
  </button>;
}
function TrendGraph({ readings, field, limits, compact = false }) {
  const candidates = (readings || []).filter(r => r.validity?.is_valid && r.payload && Number.isFinite(r.payload[field.key]));
  const data = candidates.slice().sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at)).map((r, i) => ({
    index: i, date: r.measured_at, value: r.payload[field.key], rating: r.rule_rating, delayed: r.is_delayed
  }));
  if (!data.length) return <Empty icon={Activity} title="No valid readings yet" message="Run the virtual sensor simulator to populate the trend chart."/>;
  const normalLimits = field.key === 'pH' ? [limits?.pH?.normal_min, limits?.pH?.normal_max] : field.key === 'turbidity' ? [limits?.turbidity?.normal_max] : field.key === 'TDS' ? [limits?.TDS?.normal_max] : [];
  return <div className={`chart-frame ${compact ? 'compact-chart' : ''}`} role="img" aria-label={`${field.title} time series from valid sensor readings`}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 16, right: 10, bottom: 0, left: -16 }}>
        <defs><linearGradient id={`grad-${field.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ed7bd" stopOpacity={0.25}/><stop offset="100%" stopColor="#2ed7bd" stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#24374a" strokeDasharray="4 6"/>
        <XAxis dataKey="date" tickFormatter={timeOnly} tick={{ fill: '#8295a8', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={30}/>
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#8295a8', fontSize: 11 }} tickLine={false} axisLine={false} width={65}/>
        <Tooltip contentStyle={{ background: '#11283a', border: '1px solid #315068', borderRadius: 12, color: '#eefcff' }} labelFormatter={dt} formatter={(value, _name, props) => [`${num(value, field.decimals)} ${field.unit} · ${props?.payload?.rating || 'Not rated'}${props?.payload?.delayed ? ' (delayed)' : ''}`, field.title]}/>
        {normalLimits.filter(Number.isFinite).map((v,i) => <ReferenceLine key={i} y={v} stroke="#738a9a" strokeDasharray="3 5" strokeOpacity={0.65}/>)}
        <Area type="monotone" dataKey="value" name={field.title} stroke="#2ed7bd" strokeWidth={2.5} dot={data.length <= 18 ? { fill:'#2ed7bd', r: 3, strokeWidth: 0 } : false} fill={`url(#grad-${field.key})`} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}
function Connect({ onConnect, busy, error }) {
  const [id, setId] = useState('research-viewer');
  const [token, setToken] = useState('');
  return <div className="login-outer"><div className="login-glow"/>
    <div className="login-card"><div className="login-logo"><span className="brand-mark"><Droplets size={27}/></span><span>Aqua<span>Sentra</span></span></div>
      <div className="login-graphic"><span className="pulse-ring ring1"/><span className="pulse-ring ring2"/><Droplets size={54} strokeWidth={1.35}/></div>
      <div className="eyebrow">RESEARCH MONITORING PORTAL</div>
      <h1>See the water.<br/><span>Understand the signals.</span></h1>
      <p className="login-description">Connect to your local AquaSentra API to view simulated sensor readings, provisional ratings, and alerts.</p>
      <form onSubmit={e => { e.preventDefault(); if (id.trim() && token) onConnect({ id: id.trim(), token }); }}>
        <label htmlFor="account-id">User ID</label><input id="account-id" autoComplete="username" value={id} maxLength={64} onChange={e => setId(e.target.value)} placeholder="research-viewer" required/>
        <label htmlFor="account-token">Access token</label><input id="account-token" type="password" autoComplete="current-password" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste BOOTSTRAP_VIEWER_TOKEN" required/>
        {error && <div className="form-error" role="alert"><AlertCircle size={16}/>{error}</div>}
        <button className="primary-button login-button" type="submit" disabled={busy}>{busy ? 'Connecting…' : 'Connect to dashboard'} <ArrowUpRight size={17}/></button>
      </form>
      <div className="login-note"><LockKeyhole size={15}/> Token stays in this browser tab's memory; it is not saved to local storage.</div>
    </div>
    <footer className="login-footer">Research prototype · Not a certified drinking-water safety device</footer>
  </div>;
}
function EventsList({ alerts, limit = 6 }) {
  if (!alerts?.length) return <Empty icon={Bell} title="No alerts in this view" message="Alerts appear when eligible readings exceed provisional reference ranges or records fail validation."/>;
  return <div className="event-list">{alerts.slice(0, limit).map(a => {
    const critical = a.kind === 'critical', faulty = a.kind === 'sensor_fault';
    const Icon = critical ? ShieldAlert : faulty ? AlertCircle : AlertTriangle;
    return <div className="event-item" key={a._id}><span className={`event-icon ${critical ? 'critical' : faulty ? 'fault' : 'risky'}`}><Icon size={18}/></span>
      <div className="event-main"><h4>{a.title}</h4><p>{a.message}</p><div className="event-meta">{a.kind.replaceAll('_', ' ')} · {dt(a.occurred_at)} · {a.device_id}</div></div>
      <span className={`event-severity ${critical ? 'critical' : faulty ? 'fault' : 'risky'}`}>{a.severity}</span>
    </div>;
  })}</div>;
}
function SafetyBox({ small = false }) {
  return <div className={`safety-box ${small ? 'safety-small' : ''}`}><FlaskConical size={19}/><div><strong>Research prototype — not certified</strong><p>Ratings are provisional study-defined signals, not drinking-water safety determinations. Confirm concerns through appropriate laboratory testing.</p></div></div>;
}
function Overview({ summary, readings, alerts, params, selectedMetric, onMetric, setPage }) {
  const selected = FIELDS.find(f => f.key === selectedMetric) || FIELDS[0];
  const latest = summary?.latest_live_valid_reading;
  const last = summary?.latest_reading;
  const status = summary?.device_status || 'never_seen';
  const color = ratingClass(latest?.rule_rating);
  const unRated = latest && !latest.rule_rating;
  return <>
    <div className="hero-grid"><div className="hero-card"><div className="hero-watermark"><Droplets size={180} strokeWidth={0.5}/></div>
      <div className="eyebrow"><span className="eyebrow-dot"/> LIVE MONITORING · STAGES 1-7</div><h1>Clarity in every <span>reading.</span></h1>
      <p>Track household water-quality indicators from your virtual ESP32, with transparent research-only classification.</p>
      <div className="hero-meta"><span className={`online-tag ${status}`}><LiveIcon status={status}/>{status === 'online' ? 'Device online · recent contact' : status === 'offline' ? 'Device offline · no recent contact' : 'Device not yet seen'}</span><span className="hero-timestamp"><Clock3 size={14}/> Last contact: {dt(summary?.devices?.find(d => d.device_id === summary.selected_device_id)?.last_seen_at)}</span></div>
    </div><div className={`classification-card ${color}`}><div className="classification-top"><span>Overall rule rating</span><ShieldCheck size={22}/></div>
      <div className="classification-label"><RatingPill rating={latest?.rule_rating}/></div>
      <div className="classification-title">{!latest ? 'Awaiting live data' : unRated ? 'Backfill earlier readings' : latest.rule_rating === 'Normal' ? 'Within provisional Normal references' : latest.rule_rating === 'Risky' ? 'Early warning recorded' : 'Critical reference-range alert'}</div>
      <p>Based on pH, turbidity and TDS only. A Normal rating does <strong>not</strong> certify water potability.</p>
      <div className="classification-foot"><span>Parameter set</span><strong>{params?.parameter_set_version || '—'}</strong></div>
    </div></div>
    <div className="section-title-row"><div><h2>Water indicators</h2><p>Most recent valid, live-eligible measurement</p></div><span className="subtle-time"><Clock3 size={14}/> {dt(latest?.measured_at)}</span></div>
    <div className="metric-grid">{FIELDS.map(field => <MiniMetric key={field.key} field={field} reading={latest} rating={latest?.rule_details?.individual} selected={selectedMetric === field.key} onClick={() => onMetric(field.key)}/>)}</div>
    <div className="content-grid"><div className="panel chart-panel"><div className="panel-header"><div><h3>Measurement trend</h3><p>Valid records only · {selected.title}</p></div><select className="compact-select" aria-label="Chart parameter" value={selectedMetric} onChange={e => onMetric(e.target.value)}>{FIELDS.map(f => <option key={f.key} value={f.key}>{f.title}</option>)}</select></div>
      <TrendGraph readings={readings} field={selected} limits={params?.rule_rating}/><div className="chart-caption"><span className="legend-dot"/> Provisional reference boundaries shown as dashed guides. Delayed readings may appear in history but never trigger live alerts.</div>
    </div><div className="panel context-panel"><div className="panel-header"><div><h3>System overview</h3><p>Research status at a glance</p></div><Activity size={21} className="header-icon"/></div>
      <div className="status-list"><div><span><Radio size={17}/> Data acquisition</span><strong className={status === 'online' ? 'good-text' : 'muted-text'}>{status === 'online' ? 'Recent contact' : 'No recent contact'}</strong></div>
        <div><span><ShieldCheck size={17}/> Rules engine</span><strong className="good-text">Active · provisional</strong></div>
        <div><span><Activity size={17}/> XGBoost detection</span><strong className="muted-text">{summary?.model?.class || summary?.model?.status || 'Awaiting data'}</strong></div>
        <div><span><ZapOff size={17}/> Valve isolation</span><strong className="muted-text">{summary?.valve?.verified || 'Virtual / unknown'}</strong></div>
        <div><span><Droplets size={17}/> Water flow</span><strong className="muted-text">Unknown · no sensor</strong></div></div>
      <div className="status-note"><CircleHelp size={18}/> Acknowledgment and simulated position verification are separate. Physical flow remains unknown.</div>
    </div></div>
    <div className="content-grid lower-grid"><div className="panel"><div className="panel-header"><div><h3>Recent alerts</h3><p>Warnings and sensor faults</p></div><button className="text-button" onClick={() => setPage('alerts')}>All events <ArrowUpRight size={15}/></button></div><EventsList alerts={alerts} limit={3}/></div>
      <div className="panel"><div className="panel-header"><div><h3>Data quality</h3><p>Recent ingested records</p></div><Database size={20} className="header-icon"/></div>
        <div className="quality-stat"><span>Recent received</span><strong>{summary?.recent_count ?? 0}</strong></div>
        <div className="quality-stat"><span>Invalid / flagged</span><strong>{summary?.recent_invalid_count ?? 0}</strong></div>
        <div className="quality-stat"><span>Risky / Critical</span><strong>{(summary?.recent_risky_count ?? 0) + (summary?.recent_critical_count ?? 0)}</strong></div>
        <div className="data-quality-foot">{last && !last.validity?.is_valid ? <><AlertCircle size={15}/> Latest record is flagged; not used for live rating.</> : <><CheckCircle2 size={15}/> Flagged records are excluded from ratings.</>}</div>
      </div></div>
  </>;
}
function HistoryPage({ readings, params, selectedMetric, onMetric, period, setPeriod }) {
  const [onlyFaults, setOnlyFaults] = useState(false);
  const field = FIELDS.find(f => f.key === selectedMetric) || FIELDS[0];
  const rows = onlyFaults ? readings.filter(r => !r.validity?.is_valid || r.rule_rating === 'Critical' || r.rule_rating === 'Risky') : readings;
  return <><SectionHeading eyebrow="MEASUREMENT ARCHIVE" title="Reading history" detail="Review valid, invalid, delayed and historical sensor measurements. Data are drawn from MongoDB." action={<select className="compact-select" aria-label="History time range" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">All available (latest 500)</option><option value="24h">Past 24 hours</option><option value="7d">Past 7 days</option></select>}/>
    <div className="panel chart-panel wide-chart"><div className="panel-header"><div><h3>{field.title} over time</h3><p>Valid readings · provisional reference overlay</p></div><select className="compact-select" value={selectedMetric} onChange={e => onMetric(e.target.value)} aria-label="Select history metric">{FIELDS.map(f => <option value={f.key} key={f.key}>{f.title}</option>)}</select></div><TrendGraph readings={readings} field={field} limits={params?.rule_rating}/></div>
    <div className="panel history-panel"><div className="panel-header"><div><h3>Stored sensor records</h3><p>Latest {rows.length} shown · includes flagged entries</p></div><label className="check-filter"><input type="checkbox" checked={onlyFaults} onChange={e => setOnlyFaults(e.target.checked)}/> Warnings / faults only</label></div>
      {rows.length ? <div className="table-scroll"><table className="reading-table"><thead><tr><th>Measured</th><th>pH</th><th>Turbidity</th><th>TDS</th><th>Temp</th><th>Rating</th><th>Record status</th></tr></thead><tbody>{rows.map(r => <tr key={r._id}><td className="mono-sm">{dt(r.measured_at)}</td><td>{num(r.payload?.pH, 2)}</td><td>{num(r.payload?.turbidity, 2)} <small>NTU</small></td><td>{num(r.payload?.TDS, 0)} <small>mg/L</small></td><td>{num(r.payload?.temperature_c, 1)} <small>°C</small></td><td>{r.validity?.is_valid ? <RatingPill rating={r.rule_rating}/> : <span className="flagged">Not rated</span>}</td><td><span className={`status-tag ${!r.validity?.is_valid ? 'bad' : r.is_delayed ? 'delayed' : 'good'}`}>{!r.validity?.is_valid ? `Invalid: ${(r.validity.codes || []).join(', ')}` : r.is_delayed ? 'Delayed / historical' : 'Valid'}</span></td></tr>)}</tbody></table></div> : <Empty title="No matching readings" message="Run the simulator or change the history filter."/>}
    </div>
  </>;
}
function AlertsPage({ alerts, readings }) {
  const [type, setType] = useState('all');
  const list = type === 'all' ? alerts : alerts.filter(a => a.kind === type);
  return <><SectionHeading eyebrow="ALERT JOURNAL" title="Alerts & events" detail="Alerts are stored in MongoDB. Historical backfills do not create new live alerts." action={<select className="compact-select" value={type} onChange={e => setType(e.target.value)} aria-label="Filter alert type"><option value="all">All alert types</option><option value="critical">Critical</option><option value="early_warning">Early warning</option><option value="sensor_fault">Sensor fault</option></select>}/>
    <div className="alert-summary"><div className="alert-summary-item"><span className="alert-icon-critical"><ShieldAlert size={20}/></span><div><strong>{alerts.filter(a => a.kind === 'critical').length}</strong><span>Critical alerts</span></div></div><div className="alert-summary-item"><span className="alert-icon-warning"><AlertTriangle size={20}/></span><div><strong>{alerts.filter(a => a.kind === 'early_warning').length}</strong><span>Early warnings</span></div></div><div className="alert-summary-item"><span className="alert-icon-fault"><AlertCircle size={20}/></span><div><strong>{alerts.filter(a => a.kind === 'sensor_fault').length}</strong><span>Sensor faults</span></div></div></div>
    <div className="panel event-page-panel"><EventsList alerts={list} limit={500}/></div>
    <div className="info-banner"><CircleHelp size={18}/> See Detection & virtual isolation on Overview for persistence, repeat confirmation and the control journal.</div>
  </>;
}
function SettingsPage({ params }) {
  const r = params?.rule_rating;
  return <><SectionHeading eyebrow="RESEARCH CONFIGURATION" title="Reference parameters" detail="View-only provisional threshold register. Backend configuration changes require a restart and documented research review."/>
    <div className="panel parameter-head"><div><div className="eyebrow">ACTIVE PARAMETER SET</div><h3>{params?.parameter_set_version || 'Not loaded'}</h3><p>Provisional values only · adviser review pending · virtual simulation only</p></div><span className="parameter-chip"><LockKeyhole size={15}/> Read-only</span></div>
    <div className="parameter-grid"><div className="panel"><h3>pH reference limits</h3><p>Normal is inclusive. Risky is outside Normal but within outer limits.</p><div className="setting-row"><span>Normal</span><strong>{r ? `${r.pH.normal_min} – ${r.pH.normal_max}` : '—'}</strong></div><div className="setting-row"><span>Risky outer bounds</span><strong>{r ? `${r.pH.risky_outer_min} – ${r.pH.risky_outer_max}` : '—'}</strong></div><div className="setting-row"><span>Critical</span><strong>Outside Risky bounds</strong></div></div>
    <div className="panel"><h3>Turbidity limits</h3><p>NTU · user-defined early warning categories.</p><div className="setting-row"><span>Normal</span><strong>≤ {r?.turbidity.normal_max ?? '—'} NTU</strong></div><div className="setting-row"><span>Risky</span><strong>≤ {r?.turbidity.risky_max ?? '—'} NTU, above Normal</strong></div><div className="setting-row"><span>Critical</span><strong>Above Risky maximum</strong></div></div>
    <div className="panel"><h3>TDS limits</h3><p>mg/L · illustrative only.</p><div className="setting-row"><span>Normal</span><strong>≤ {r?.TDS.normal_max ?? '—'} mg/L</strong></div><div className="setting-row"><span>Risky</span><strong>≤ {r?.TDS.risky_max ?? '—'} mg/L, above Normal</strong></div><div className="setting-row"><span>Critical</span><strong>Above Risky maximum</strong></div></div>
    <div className="panel"><h3>Operational parameters</h3><p>Not an independent drinking-water rating.</p><div className="setting-row"><span>Temperature context</span><strong>{r ? `${r.temperature_operational_reference.min}–${r.temperature_operational_reference.max} °C` : '—'}</strong></div><div className="setting-row"><span>Online indicator timeout</span><strong>{params?.dashboard_offline_after_seconds ?? '—'} sec</strong></div><div className="setting-row"><span>Sampling interval</span><strong>{params?.sampling_interval_seconds ?? '—'} sec</strong></div></div></div>
    <SafetyBox/><div className="info-banner"><SlidersHorizontal size={19}/> To revise provisional thresholds, edit <code>backend/config/parameters.json</code>, increment <code>parameter_set_version</code>, restart the backend, and run the rating tests. Existing rated records retain their original version and are not silently reclassified.</div>
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
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const refresh = useCallback(async (creds, chosenDevice = '', range = 'all') => {
    if (!creds) return;
    const device = chosenDevice ? `device_id=${encodeURIComponent(chosenDevice)}` : '';
    let from = '';
    if (range !== 'all') from = `from=${encodeURIComponent(new Date(Date.now() - (range === '24h' ? 1 : 7) * 86400000).toISOString())}`;
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
      setCredentials(creds); setSummary(result.dash); setReadings(result.history.readings); setAlerts(result.alarms.alerts); setParams(result.config);
      setDeviceId(result.dash.selected_device_id || ''); setLastRefresh(new Date());
    } catch (error) { setLoginError(error.message === 'Failed to fetch' ? 'Cannot reach local backend. Start npm start in backend and keep Docker running.' : error.message); }
    finally { setLoginBusy(false); }
  };
  const logout = () => { setCredentials(null); setSummary(null); setReadings([]); setAlerts([]); setParams(null); setFetchError(''); setPage('overview'); };
  useEffect(() => {
    if (!credentials) return;
    let active = true; let busy = false;
    const update = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const result = await refresh(credentials, deviceId, period);
        if (active) {
          setSummary(result.dash); setReadings(result.history.readings); setAlerts(result.alarms.alerts); setParams(result.config);
          setLastRefresh(new Date()); setFetchError('');
        }
      } catch (error) {
        if (active) {
          setFetchError(error.message === 'Failed to fetch' ? 'Backend unavailable. Check Node.js and Docker.' : error.message);
          if (error.status === 401) logout();
        }
      } finally { busy = false; if (active) setLoading(false); }
    };
    update();
    const timer = setInterval(update, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [credentials, deviceId, period, tick, refresh]);
  const selectedDevice = summary?.selected_device_id || deviceId;
  const setView = view => { setPage(view); setMenuOpen(false); };
  if (!credentials) return <Connect onConnect={connect} busy={loginBusy} error={loginError}/>;
  return <div className="app-shell">
    {menuOpen && <div className="mobile-scrim" onClick={() => setMenuOpen(false)}/>}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}><div className="brand"><span className="brand-mark"><Droplets size={24}/></span><div className="brand-name">Aqua<span>Sentra</span><small>RESEARCH MONITORING</small></div><button className="mobile-close icon-button" onClick={() => setMenuOpen(false)}><X size={19}/></button></div>
      <div className="nav-label">WORKSPACE</div><nav aria-label="Primary navigation">{SIDEBAR.map(({ id, name, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setView(id)}><Icon size={18}/><span>{name}</span>{page === id && <span className="nav-active-dot"/>}</button>)}</nav>
      <div className="sidebar-spacer"/><div className="sidebar-device"><div className="sidebar-device-label"><Radio size={15}/> CONNECTED DEVICE</div><strong>{selectedDevice || 'No device'}</strong><span className={`sidebar-status ${summary?.device_status || 'never_seen'}`}><span/> {summary?.device_status === 'online' ? 'Recent contact' : 'Not in contact'}</span></div>
      <div className="sidebar-footer"><div className="stage-tag">STAGES 1-7 <span>·</span> PROTOTYPE</div><div>Sensors, detection & virtual isolation</div></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="top-left"><button className="menu-button icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{SIDEBAR.find(s => s.id === page)?.name}</strong></div></div>
        <div className="top-right"><div className="header-device"><Radio size={16}/><select aria-label="Select device" value={selectedDevice || ''} onChange={e => setDeviceId(e.target.value)}>{(summary?.devices || []).map(d => <option key={d.device_id} value={d.device_id}>{d.device_id}</option>)}</select><ChevronDown size={14}/></div><button className="icon-button refresh-button" title="Refresh" aria-label="Refresh" onClick={() => { setLoading(true); setTick(v => v + 1); }}><RefreshCcw size={18} className={loading ? 'spin' : ''}/></button><button className="signout-button" onClick={logout}><LogOut size={17}/><span>Disconnect</span></button></div>
      </header>
      <main className="page-content"><div className="page-intro"><div className="intro-left"><span className="breadcrumb-tag"><span/> AQUASENTRA / LIVE SYSTEM</span><h1>{page === 'overview' ? 'Overview' : SIDEBAR.find(s => s.id === page)?.name}</h1><p>{page === 'overview' ? 'A clearer view of your water-quality data.' : 'Research-focused monitoring and transparent provisional indicators.'}</p></div><div className="intro-right"><div className="refresh-state"><span className="live-orb"/> {fetchError ? 'Sync issue' : 'Monitoring'} <span className="refresh-time">· Updated {lastRefresh ? timeOnly(lastRefresh) : '—'}</span></div></div></div>
        {(!online || fetchError) && <div className="error-banner"><WifiOff size={18}/>{!online ? 'Browser offline. Previously loaded data may be stale.' : fetchError}</div>}
        {page === 'overview' && <Overview summary={summary} readings={readings} alerts={alerts} params={params} selectedMetric={selectedMetric} onMetric={setSelectedMetric} setPage={setView}/>}
        {page === 'overview' && <ResearchPanel summary={summary} credentials={credentials}/>}
        {page === 'history' && <HistoryPage readings={readings} params={params} selectedMetric={selectedMetric} onMetric={setSelectedMetric} period={period} setPeriod={setPeriod}/>}
        {page === 'alerts' && <AlertsPage alerts={alerts} readings={readings}/>}
        {page === 'settings' && <SettingsPage params={params}/>}
        <footer className="app-footer"><span>© 2026 AquaSentra · Stages 1-7 virtual prototype</span><span><ShieldAlert size={15}/> Not a certified drinking-water safety device. Virtual valve control only.</span></footer>
      </main>
    </div>
  </div>;
}
