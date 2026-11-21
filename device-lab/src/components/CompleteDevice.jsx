import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  Box, RotateCcw, Layers, Eye, EyeOff, ShieldAlert,
  Info, Cpu, Droplets, Zap, ChevronRight, X, FileText, CheckCircle2
} from 'lucide-react';
import { COMPONENTS_DATA, getComponentByMeshName } from '../data/componentData';
import wiringManifest from '../data/modelConnections.json';

function DeviceAssembly({
  selection,
  onPick,
  exploded,
  wiringMode,
  showEnclosure,
  valveVerified
}) {
  const { scene } = useGLTF('/models/aquasentra-device.glb');

  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material?.clone();
      o.userData.originalPosition = o.position.clone();
      const comp = getComponentByMeshName(o.name);
      o.userData.componentId = comp ? comp.id : null;
      // Decorative conduits, water, or baseplate shouldn't prevent picking internal probes
      if (['frame', 'water', 'base', 'wire'].includes(o.name.split(':')[0])) {
        o.raycast = () => null;
      }
    });
    return copy;
  }, [scene]);

  // Emissive highlight on selected component
  useEffect(() => {
    model.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.emissive) return;
      const match = o.userData.componentId === selection;
      o.material.emissive.set(match ? '#0ea5e9' : '#000000');
      o.material.emissiveIntensity = match ? 0.35 : 0;
    });
  }, [model, selection]);

  // Wiring domain filtering
  useEffect(() => {
    const domains = Object.fromEntries(wiringManifest.connections.map(n => [n.id, n.domain]));
    model.traverse(o => {
      if (!o.isMesh || !o.name.startsWith('wire:')) return;
      const id = o.name.slice(5);
      if (id === 'clip' || id === 'jst-pins') {
        o.visible = wiringMode !== 'none';
        return;
      }
      const type = domains[id];
      o.visible = wiringMode === 'all' ||
        (wiringMode === 'signals' && ['signal', 'feedback', '3V3'].includes(type)) ||
        (wiringMode === 'power' && ['5V', 'GND', '12V'].includes(type)) ||
        (wiringMode === 'probes' && type === 'probe');
    });
  }, [model, wiringMode]);

  // Enclosure visibility
  useEffect(() => {
    model.traverse(o => {
      if (!o.isMesh) return;
      if (o.name.startsWith('frame:')) {
        o.visible = showEnclosure;
      }
    });
  }, [model, showEnclosure]);

  // Animated exploded view & simulated valve plunger shift
  useFrame((_, delta) => {
    const lerpRate = Math.min(1, delta * 6);
    model.traverse(o => {
      if (!o.isMesh) return;
      const original = o.userData.originalPosition;
      if (!original) return;
      const id = o.userData.componentId;

      const plungerShift = o.name === 'valve:plunger-visual' ? (valveVerified === 'open' ? 0.18 : valveVerified === 'closed' ? -0.18 : 0) : 0;
      const offset = exploded ? (
        id === 'valve' ? [1.12, 0, 0.05] :
        id === 'chamber' ? [0, -0.38, 0.6] :
        ['ph', 'turbidity', 'tds', 'temperature'].includes(id) ? [0, 0.56, 0.32] :
        id === 'esp32' ? [-0.65, 0.16, -0.18] :
        id === 'relay' ? [0.44, 0.33, -0.1] :
        id === 'power' ? [-0.58, 0.3, -0.17] :
        id === 'display' ? [0.45, 0.25, -0.12] : [0, 0, 0]
      ) : [0, 0, 0];

      o.position.set(
        o.position.x + (original.x + offset[0] - o.position.x) * lerpRate,
        o.position.y + (original.y + offset[1] + plungerShift - o.position.y) * lerpRate,
        o.position.z + (original.z + offset[2] - o.position.z) * lerpRate
      );
    });
  });

  return (
    <primitive
      object={model}
      onPointerDown={e => {
        const comp = getComponentByMeshName(e.object.name);
        if (comp) {
          e.stopPropagation();
          onPick(comp.id);
        }
      }}
      onPointerOver={e => {
        if (getComponentByMeshName(e.object.name)) {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    />
  );
}

export default function CompleteDevice({ backendState }) {
  const [selection, setSelection] = useState('esp32');
  const [exploded, setExploded] = useState(false);
  const [wiringMode, setWiringMode] = useState('signals'); // 'signals', 'power', 'probes', 'all', 'none'
  const [showEnclosure, setShowEnclosure] = useState(true);
  const [showWiringDoc, setShowWiringDoc] = useState(false);
  const controlsRef = useRef();

  const comp = COMPONENTS_DATA.find(c => c.id === selection) || COMPONENTS_DATA[0];
  const valveVerified = backendState?.valve?.verified || 'unknown';

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="complete-device-layout">
      {/* 3D Canvas Area */}
      <div className="assembly-viewport">
        {/* Top Control Toolbar */}
        <div className="assembly-toolbar">
          <div className="toolbar-group">
            <span className="toolbar-label">VIEW OPTIONS:</span>
            <button
              className={`toolbar-btn ${exploded ? 'active' : ''}`}
              onClick={() => setExploded(!exploded)}
              title="Toggle exploded assembly view"
            >
              <Layers size={14}/>
              <span>{exploded ? 'Assembled View' : 'Exploded View'}</span>
            </button>
            <button
              className={`toolbar-btn ${showEnclosure ? 'active' : ''}`}
              onClick={() => setShowEnclosure(!showEnclosure)}
              title="Toggle transparent acrylic housing"
            >
              {showEnclosure ? <Eye size={14}/> : <EyeOff size={14}/>}
              <span>{showEnclosure ? 'Hide Enclosure' : 'Show Enclosure'}</span>
            </button>
            <button
              className="toolbar-btn"
              onClick={resetCamera}
              title="Reset 3D camera to default position"
            >
              <RotateCcw size={14}/>
              <span>Reset Camera</span>
            </button>
          </div>

          <div className="toolbar-group">
            <span className="toolbar-label">WIRING FILTER:</span>
            <select
              className="toolbar-select"
              value={wiringMode}
              onChange={e => setWiringMode(e.target.value)}
              aria-label="Filter displayed wire connections"
            >
              <option value="signals">GPIO Signals & Bus (Default)</option>
              <option value="power">Power & DC Ground Rails</option>
              <option value="probes">Sensor Probe Leads</option>
              <option value="all">All 33 Net Connections</option>
              <option value="none">Hide All Wiring</option>
            </select>
            <button
              className={`toolbar-btn doc-btn ${showWiringDoc ? 'active' : ''}`}
              onClick={() => setShowWiringDoc(!showWiringDoc)}
            >
              <FileText size={14}/>
              <span>Wiring Netlist Docs</span>
            </button>
          </div>
        </div>

        {/* 3D Canvas */}
        <div className="assembly-canvas-box">
          <Canvas
            camera={{ position: [0, 3.8, 6.2], fov: 42 }}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          >
            <color attach="background" args={['#090e17']} />
            <ambientLight intensity={0.65} />
            <directionalLight position={[6, 9, 7]} intensity={1.25} />
            <directionalLight position={[-6, -3, -5]} intensity={0.4} color="#38bdf8" />
            <pointLight position={[0, 4, 1]} intensity={0.7} />

            <Suspense fallback={null}>
              <DeviceAssembly
                selection={selection}
                onPick={setSelection}
                exploded={exploded}
                wiringMode={wiringMode}
                showEnclosure={showEnclosure}
                valveVerified={valveVerified}
              />
            </Suspense>

            <gridHelper args={[12, 24, '#1e293b', '#0f172a']} position={[0, -1.8, 0]} />

            <OrbitControls
              ref={controlsRef}
              enableDamping
              dampingFactor={0.06}
              minDistance={2.5}
              maxDistance={18}
            />
          </Canvas>

          <div className="assembly-legend">
            <span className="legend-chip"><span className="dot teal"/> Click any part in 3D to inspect</span>
            <span className="legend-chip"><span className="dot amber"/> Blue wire: Signals</span>
            <span className="legend-chip"><span className="dot red"/> Red/Gold: 12V Actuator</span>
          </div>
        </div>
      </div>

      {/* Component Inspector Side Panel */}
      <div className="assembly-inspector-panel">
        <div className="inspector-header">
          <div>
            <div className="eyebrow-chip">{comp.category}</div>
            <h3>{comp.name}</h3>
          </div>
          <button className="inspector-close" onClick={() => setSelection(null)} aria-label="Close inspector">
            <X size={16}/>
          </button>
        </div>

        <div className="inspector-content">
          <div className="inspector-section">
            <h4>Operating Voltage</h4>
            <div className="voltage-badge">{comp.voltage}</div>
          </div>

          <div className="inspector-section">
            <h4>Role in AquaSentra</h4>
            <p>{comp.roleInAquaSentra}</p>
          </div>

          <div className="inspector-section">
            <h4>Component Function</h4>
            <p>{comp.purpose}</p>
          </div>

          <div className="inspector-section">
            <h4>Proposed Pin Allocations</h4>
            <div className="pin-list">
              {comp.proposedConnections.map((conn, idx) => (
                <div key={idx} className="pin-item">
                  <div className="pin-label"><code>{conn.pin}</code></div>
                  <div className="pin-target">{conn.target}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="inspector-section warning-box">
            <h4><ShieldAlert size={14}/> Important Notice</h4>
            <p>{comp.assumptionsAndWarnings[0]}</p>
          </div>
        </div>
      </div>

      {/* Slide-over or Modal: Proposed Wiring Documentation */}
      {showWiringDoc && (
        <div className="wiring-modal-backdrop" onClick={() => setShowWiringDoc(false)}>
          <div className="wiring-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Proposed Wiring & Netlist Reference</h2>
                <p>33 explicitly mapped connections from proposed-netlist.json and Stage 7 architecture.</p>
              </div>
              <button className="icon-button" onClick={() => setShowWiringDoc(false)}><X size={18}/></button>
            </div>

            <div className="modal-body">
              <div className="warning-banner">
                <ShieldAlert size={16}/>
                <div>
                  <strong>Research & Simulation Netlist Only:</strong> These proposed connections model realistic terminal positions. Verify voltage scaling, pin header sequences, and electrical safety on purchased hardware prior to physical assembly.
                </div>
              </div>

              <h3>ESP32 Pin Signal Allocation Table</h3>
              <div className="table-scroll">
                <table className="reading-table">
                  <thead>
                    <tr><th>Signal / Load</th><th>Proposed Hardware Route</th><th>Model Safety Condition</th></tr>
                  </thead>
                  <tbody>
                    <tr><td><strong>pH Sensor</strong></td><td>PH-4502C PO → Voltage Scaler → ESP32 <code>GPIO34 / ADC1</code></td><td>Voltage scaler required (0–5V output to &le;3.3V ADC)</td></tr>
                    <tr><td><strong>Turbidity</strong></td><td>SEN0189 Analog → Voltage Scaler → ESP32 <code>GPIO35 / ADC1</code></td><td>Scaler required (0–4.5V output exceeds ESP32 limit)</td></tr>
                    <tr><td><strong>TDS Meter</strong></td><td>TDS Analog OUT → ESP32 <code>GPIO32 / ADC1</code></td><td>Native 0–2.3V output fits 3.3V ADC tolerance</td></tr>
                    <tr><td><strong>DS18B20 Temp</strong></td><td>DQ Data → ESP32 <code>GPIO4</code> (4.7 kΩ pull-up to 3.3V)</td><td>Mandatory external 4.7 kΩ pull-up to 3.3V rail</td></tr>
                    <tr><td><strong>Relay Trigger</strong></td><td>ESP32 <code>GPIO26</code> → Relay Module IN</td><td>Optocoupler isolated coil; active polarity verified</td></tr>
                    <tr><td><strong>Valve Feedback</strong></td><td>Limit Switch → ESP32 <code>GPIO27</code></td><td>Independent position feedback switch (research concept)</td></tr>
                    <tr><td><strong>12V Solenoid</strong></td><td>Fused +12V → Relay COM → NO → Valve (+)</td><td>Completely isolated from ESP32 logic bus; inductive suppression</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 style={{ marginTop: '24px' }}>All 33 Netlist Connections</h3>
              <div className="table-scroll" style={{ maxHeight: '350px' }}>
                <table className="reading-table">
                  <thead>
                    <tr><th>Net ID</th><th>Source Terminal</th><th>Destination Terminal</th><th>Domain</th></tr>
                  </thead>
                  <tbody>
                    {wiringManifest.connections.map(conn => (
                      <tr key={conn.id}>
                        <td><code>{conn.id}</code></td>
                        <td>{conn.source}</td>
                        <td>{conn.destination}</td>
                        <td><span className={`status-tag ${conn.domain === '12V' ? 'bad' : conn.domain === '5V' ? 'delayed' : 'good'}`}>{conn.domain}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
