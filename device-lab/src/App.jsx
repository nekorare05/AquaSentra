import React, { useState, useEffect } from 'react';
import {
  Box, PlayCircle, Layers, ArrowLeft, RefreshCw, Wifi, WifiOff,
  Activity, ShieldCheck, CheckCircle2
} from 'lucide-react';
import CompleteDevice from './components/CompleteDevice';
import IoTSimulation from './components/IoTSimulation';
import ComponentLibrary from './components/ComponentLibrary';
import { apiGet } from './api';

const MAIN_DASHBOARD_URL = window.location.port === '4174' ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173';

export default function App() {
  const [activeTab, setActiveTab] = useState('complete'); // 'complete', 'simulation', 'components'
  const [backendState, setBackendState] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  // Attempt background sync with existing Node.js backend if available
  useEffect(() => {
    let active = true;
    const checkBackend = async () => {
      try {
        const data = await apiGet('dashboard');
        if (active) {
          setBackendState(data);
          setBackendConnected(true);
          if (data.selected_device_id) setDeviceId(data.selected_device_id);
        }
      } catch {
        if (active) {
          setBackendConnected(false);
        }
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 6000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return (
    <div className="lab-app-container">
      {/* Top Header */}
      <header className="lab-header">
        <div className="lab-brand">
          <div className="lab-logo-icon">
            <Box size={22} strokeWidth={2}/>
          </div>
          <div className="lab-title-group">
            <h1>AquaSentra <span>3D Lab</span></h1>
            <p>Interactive Hardware & Simulation Workstation</p>
          </div>
        </div>

        {/* 3 Main View Tabs */}
        <nav className="lab-nav" aria-label="3D Lab Navigation">
          <button
            className={`lab-nav-item ${activeTab === 'complete' ? 'active' : ''}`}
            onClick={() => setActiveTab('complete')}
          >
            <Box size={16}/>
            <span>1. Complete Device</span>
          </button>
          <button
            className={`lab-nav-item ${activeTab === 'simulation' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulation')}
          >
            <PlayCircle size={16}/>
            <span>2. IoT Operation Simulation</span>
          </button>
          <button
            className={`lab-nav-item ${activeTab === 'components' ? 'active' : ''}`}
            onClick={() => setActiveTab('components')}
          >
            <Layers size={16}/>
            <span>3. Component Library</span>
          </button>
        </nav>

        {/* External Return Link & Backend Sync Pill */}
        <div className="lab-header-actions">
          <div className={`status-pill ${backendConnected ? 'online' : 'offline'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: backendConnected ? 'var(--green)' : 'var(--text-light)' }}>
            {backendConnected ? <Wifi size={13}/> : <WifiOff size={13}/>}
            <span>{backendConnected ? 'Backend Synced' : 'Standalone Mode'}</span>
          </div>

          <a
            href={MAIN_DASHBOARD_URL}
            className="back-dashboard-btn"
            title="Return to the Main AquaSentra Monitoring Dashboard"
          >
            <ArrowLeft size={14}/>
            <span>Main Dashboard</span>
          </a>
        </div>
      </header>

      {/* Main Active Page Component */}
      <main className="lab-main-viewport">
        {activeTab === 'complete' && <CompleteDevice backendState={backendState} />}
        {activeTab === 'simulation' && <IoTSimulation backendState={backendState} />}
        {activeTab === 'components' && <ComponentLibrary />}
      </main>
    </div>
  );
}
