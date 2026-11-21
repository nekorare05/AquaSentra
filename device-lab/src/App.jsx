import React, { useState, useEffect } from 'react';
import {
  Box, PlayCircle, Layers, ArrowLeft, Wifi, WifiOff
} from 'lucide-react';
import CompleteDevice from './components/CompleteDevice';
import IoTSimulation from './components/IoTSimulation';
import ComponentLibrary from './components/ComponentLibrary';
import { apiGet } from './api';

const MAIN_DASHBOARD_URL = window.location.port === '4174' ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173';

const views = [
  { id: 'complete', label: 'Device assembly', icon: Box },
  { id: 'simulation', label: 'IoT simulation', icon: PlayCircle },
  { id: 'components', label: 'Component library', icon: Layers }
];

function currentView() {
  return views.find(view => view.id === window.location.hash.slice(1))?.id || 'complete';
}

export default function App() {
  const [activeTab, setActiveTab] = useState(currentView);
  const [backendState, setBackendState] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);
  useEffect(() => {
    const navigate = () => setActiveTab(currentView());
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  // Attempt background sync with existing Node.js backend if available
  useEffect(() => {
    let active = true;
    const checkBackend = async () => {
      try {
        const data = await apiGet('dashboard');
        if (active) {
          setBackendState(data);
          setBackendConnected(true);
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
          </div>
        </div>

        {/* 3 Main View Tabs */}
        <nav className="lab-nav" aria-label="3D Lab Navigation">
          {views.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`} className={`lab-nav-item ${activeTab === id ? 'active' : ''}`}
              aria-current={activeTab === id ? 'page' : undefined}>
              <Icon size={16}/>{label}
            </a>
          ))}
        </nav>

        {/* External Return Link & Backend Sync Pill */}
        <div className="lab-header-actions">
          <div className={`status-pill ${backendConnected ? 'online' : 'offline'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: backendConnected ? 'var(--green)' : 'var(--text-light)' }}>
            {backendConnected ? <Wifi size={13}/> : <WifiOff size={13}/>}
            <span>{backendConnected ? 'Connected' : 'Standalone'}</span>
          </div>

          <a
            href={MAIN_DASHBOARD_URL}
            className="back-dashboard-btn"
            title="Return to the Main AquaSentra Monitoring Dashboard"
          >
            <ArrowLeft size={14}/>
            <span>Dashboard</span>
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
