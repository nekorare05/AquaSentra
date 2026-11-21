import React, { useState } from 'react';
import {
  Cpu, FlaskConical, Droplets, Gauge, Thermometer,
  Zap, Power, Layers, Box, AlertTriangle, ShieldCheck,
  RotateCcw, Eye, Play, Pause, ChevronRight, HelpCircle
} from 'lucide-react';
import SingleComponent3D from './SingleComponent3D';
import { COMPONENTS_DATA } from '../data/componentData';

const ICON_MAP = {
  esp32: Cpu,
  ph: FlaskConical,
  turbidity: Droplets,
  tds: Gauge,
  temperature: Thermometer,
  relay: Zap,
  valve: Power,
  power: Layers,
  chamber: Box
};

export default function ComponentLibrary() {
  const [selectedId, setSelectedId] = useState('esp32');
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);

  const comp = COMPONENTS_DATA.find(c => c.id === selectedId) || COMPONENTS_DATA[0];
  const Icon = ICON_MAP[comp.id] || Box;

  return (
    <div className="component-library-container">
      {/* Sidebar List of 9 Individual Components */}
      <div className="component-sidebar">
        <div className="component-sidebar-header">
          <h3>Individual Components</h3>
          <p>9 standalone modules shown individually, not as combined assembly.</p>
        </div>
        <div className="component-list">
          {COMPONENTS_DATA.map(item => {
            const ItemIcon = ICON_MAP[item.id] || Box;
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                className={`component-nav-button ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="comp-nav-icon"><ItemIcon size={16}/></div>
                <div className="comp-nav-info">
                  <div className="comp-nav-name">{item.shortName}</div>
                  <div className="comp-nav-sub">{item.voltage.split('/')[0]}</div>
                </div>
                {isSelected && <ChevronRight size={14} className="comp-chevron"/>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 3D Viewer & Specification Display */}
      <div className="component-detail-view">
        {/* Top Header of Component Detail */}
        <div className="comp-detail-header">
          <div>
            <div className="comp-badge-row">
              <span className="comp-cat-badge">{comp.category}</span>
              <span className="comp-volt-badge">{comp.voltage}</span>
            </div>
            <h2>{comp.name}</h2>
          </div>
          <div className="comp-3d-toolbar">
            <button
              className={`tool-btn ${autoRotate ? 'active' : ''}`}
              onClick={() => setAutoRotate(!autoRotate)}
              title="Toggle Auto Rotation"
            >
              {autoRotate ? <Pause size={14}/> : <Play size={14}/>}
              <span>{autoRotate ? 'Pause Rotate' : 'Auto Rotate'}</span>
            </button>
            <button
              className={`tool-btn ${wireframe ? 'active' : ''}`}
              onClick={() => setWireframe(!wireframe)}
              title="Toggle Wireframe View"
            >
              <Eye size={14}/>
              <span>{wireframe ? 'Shaded View' : 'Wireframe'}</span>
            </button>
          </div>
        </div>

        {/* 3D Canvas Box */}
        <div className="comp-canvas-wrapper">
          <SingleComponent3D
            componentId={comp.id}
            autoRotate={autoRotate}
            wireframe={wireframe}
          />
          <div className="canvas-hint">
            <span>Left-click + drag to rotate • Right-click to pan • Scroll to zoom</span>
          </div>
        </div>

        {/* Detailed Component Documentation Cards */}
        <div className="comp-info-grid">
          {/* Card 1: Purpose & Role in AquaSentra */}
          <div className="comp-info-card">
            <div className="card-header">
              <ShieldCheck size={16} className="text-teal"/>
              <h4>Purpose & Role in AquaSentra</h4>
            </div>
            <div className="card-section">
              <strong>Component Purpose:</strong>
              <p>{comp.purpose}</p>
            </div>
            <div className="card-section">
              <strong>Role in AquaSentra Prototype:</strong>
              <p>{comp.roleInAquaSentra}</p>
            </div>
          </div>

          {/* Card 2: Electrical Voltage & Specifications */}
          <div className="comp-info-card">
            <div className="card-header">
              <Zap size={16} className="text-amber"/>
              <h4>Operating Voltage & Specifications</h4>
            </div>
            <div className="voltage-highlight">
              <span className="label">Operating Voltage:</span>
              <span className="value">{comp.voltage}</span>
            </div>
            <div className="spec-table-wrap">
              <table className="spec-table">
                <tbody>
                  {comp.specifications.map((spec, i) => (
                    <tr key={i}>
                      <td>{spec.label}</td>
                      <td><strong>{spec.value}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Proposed Wiring & Terminal Connections */}
          <div className="comp-info-card full-width">
            <div className="card-header">
              <Layers size={16} className="text-blue"/>
              <h4>Proposed Wiring & Terminal Connections</h4>
            </div>
            <div className="connections-table-wrap">
              <table className="connections-table">
                <thead>
                  <tr>
                    <th>Component Terminal / Pin</th>
                    <th>Target Destination</th>
                    <th>Domain</th>
                  </tr>
                </thead>
                <tbody>
                  {comp.proposedConnections.map((conn, idx) => (
                    <tr key={idx}>
                      <td><code>{conn.pin}</code></td>
                      <td>{conn.target}</td>
                      <td><span className={`domain-tag ${conn.domain.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^([0-9])/, 'v-$1')}`}>{conn.domain}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 4: Model Limits & Unverified Assumptions */}
          <div className="comp-info-card full-width warning-card">
            <div className="card-header">
              <AlertTriangle size={16} className="text-red"/>
              <h4>Approximate Models & Unverified Electrical Assumptions</h4>
            </div>
            <ul className="warning-list">
              {comp.assumptionsAndWarnings.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
