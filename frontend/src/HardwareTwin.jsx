import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { CanvasTexture, FrontSide, SRGBColorSpace } from 'three';
import {
  Box, ChevronLeft, ChevronRight, Cpu, Droplets, Info,
  Rotate3D, ScanEye, ShieldAlert, Wifi, WifiOff, Activity, Gauge, Layers3,
  RotateCcw, CircleHelp
} from 'lucide-react';
import {
  COMPONENTS, COMPONENT_BY_ID, componentFromMeshName, projectHardwareState, sensorLabel
} from './hardwareTwinState';
import './hardwareTwin.css';
import wiringManifest from './modelConnections.json';

const stageLabels = {
  unknown: 'Position unknown', fault: 'Fault — unverified',
  commanded_unverified: 'Commanded — unverified', acknowledged_unverified: 'Acknowledged — unverified',
  verified_closed: 'Verified isolated (simulated)', verified_open: 'Verified open (simulated)'
};
function Capsule({children,className=''}) { return <span className={`twin-capsule ${className}`}>{children}</span>; }

class ModelErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={failed:false};}
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? <div className="twin-no-webgl" role="alert"><ShieldAlert size={26}/><h3>3D preview unavailable</h3><p>This browser may not support WebGL, or the GLB could not be loaded. Use the component inspector or download the STEP model.</p></div> : this.props.children;}
}

function DeviceModel({ onPick, selection, exploded, valveVerified, wiringMode }) {
  const { scene } = useGLTF('/models/aquasentra-device.glb');
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material?.clone();
      o.userData.originalPosition = o.position.clone();
      const id = componentFromMeshName(o.name);
      // Thin transparent acrylic and decorative conduits should not block probe picking.
      if (['frame','water','base','wire'].includes(o.name.split(':')[0])) o.raycast = () => null;
      o.userData.component = id;
    });
    return copy;
  },[scene]);
  useEffect(() => {
    model.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.emissive) return;
      const match = o.userData.component === selection;
      o.material.emissive.set(match ? '#23a6a3' : '#000000');
      o.material.emissiveIntensity = match ? .26 : 0;
    });
  },[model,selection]);
  // The geometries are sourced from the proposed component-to-terminal manifest.
  // A filtered wiring view prevents the tangle of overlapping wires seen in v2.
  useEffect(() => {
    const domains = Object.fromEntries(wiringManifest.connections.map(n => [n.id, n.domain]));
    model.traverse(o => {
      if (!o.isMesh || !o.name.startsWith('wire:')) return;
      const id = o.name.slice(5);
      if (id === 'clip' || id === 'jst-pins') {o.visible = true;return;}
      const type = domains[id];
      o.visible = wiringMode === 'all' ||
        (wiringMode === 'signals' && ['signal','feedback','3V3'].includes(type)) ||
        (wiringMode === 'power' && ['5V','GND','12V'].includes(type)) ||
        (wiringMode === 'probes' && type === 'probe');
    });
  },[model,wiringMode]);
  useFrame((_state,delta) => {
    model.traverse(o => {
      if (!o.isMesh) return;
      const original = o.userData.originalPosition;
      if (!original) return;
      const id = o.userData.component;
      const plungerShift = o.name === 'valve:plunger-visual' ? (valveVerified === 'open' ? .18 : valveVerified === 'closed' ? -.18 : 0) : 0;
      const offset = exploded ? (id === 'valve' ? [1.12,0,.05] : id === 'chamber' ? [0,-.38,.6] :
        ['ph','turbidity','tds','temperature'].includes(id) ? [0,.56,.32] :
        id === 'esp32' ? [-.65,.16,-.18] : id === 'relay' ? [.44,.33,-.1] :
        id === 'power' ? [-.58,.3,-.17] : id === 'display' ? [.45,.25,-.12] : [0,0,0]) : [0,0,0];
      o.position.set(
        o.position.x + (original.x + offset[0] - o.position.x)*Math.min(1,delta*6),
        o.position.y + (original.y + offset[1] + plungerShift - o.position.y)*Math.min(1,delta*6),
        o.position.z + (original.z + offset[2] - o.position.z)*Math.min(1,delta*6),
      );
    });
  });
  return <primitive object={model} onPointerDown={e=>{
    const id=componentFromMeshName(e.object.name);
    if(id){e.stopPropagation();onPick(id);}
  }} onPointerOver={e=>{if(componentFromMeshName(e.object.name))document.body.style.cursor='pointer';}}
  onPointerOut={()=>{document.body.style.cursor='';}} />;
}

function WaterSignal({ flowing, haze, isolated }) {
  const group = useRef();
  useFrame(({clock}) => {
    if (!group.current || !flowing) return;
    const time=clock.getElapsedTime();
    group.current.children.forEach((bubble,i)=> {
      const x = ((time*1.25+i*.84)%7.1)-3.7;
      bubble.position.x = x;
      bubble.position.y=1.13+Math.sin(time*2.2+i)*.06;
    });
  });
  return <group>
    <mesh position={[-.07,1.12,.88]}>
      <boxGeometry args={[4.50,.52,.87]}/>
      <meshBasicMaterial transparent opacity={haze*.27} color="#f5dbb6" depthWrite={false}/>
    </mesh>
    {flowing && <group ref={group}>{Array.from({length:7},(_,i)=><mesh key={i} position={[-3.8+i*.88,1.12,.88]}>
      <sphereGeometry args={[.045,9,7]}/><meshBasicMaterial color="#7ef8f5" transparent opacity={.83}/>
    </mesh>)}</group>}
    {isolated && <mesh position={[3.22,1.2,.88]} rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[.38,.035,8,32]}/><meshBasicMaterial color="#ffb47c"/>
    </mesh>}
  </group>;
}

/** Dynamic screen texture is derived only from existing authenticated dashboard state.
 * The static exported GLB retains a sample bezel; no readings are fabricated here.
 */
function LiveScreen({ state, exploded, onPick }) {
  const { texture, context } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 500;
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return { texture: t, context: canvas.getContext('2d') };
  }, []);
  useEffect(() => {
    if (!context) return;
    const c = context;
    c.fillStyle = '#071b27'; c.fillRect(0,0,768,500);
    c.fillStyle = '#18dfc4'; c.fillRect(24,20,7,58);
    c.font = 'bold 42px sans-serif'; c.fillStyle = '#dcffff'; c.fillText('AquaSentra',46,68);
    c.font = '22px sans-serif'; c.fillStyle = '#49b2c0'; c.fillText('LIVE SIMULATION',46,103);
    c.strokeStyle = '#225766'; c.beginPath();c.moveTo(30,121);c.lineTo(733,121);c.stroke();
    const readings = state?.readings || {};
    const fmt = (key,digits,unit) => Number.isFinite(readings[key])
      ? `${readings[key].toFixed(digits)} ${unit}` : '—';
    const lines = [
      ['pH',fmt('pH',2,'')],
      ['Turbidity',fmt('turbidity',1,'NTU')],
      ['TDS',fmt('TDS',0,'mg/L')],
      ['Water temp',fmt('temperature_c',1,'°C')]
    ];
    lines.forEach(([key,value],i) => {
      const y=177+i*72;
      c.font='26px sans-serif';c.fillStyle='#8fd5d9';c.fillText(key,42,y);
      c.font='bold 32px sans-serif';c.fillStyle='#e4ffff';c.fillText(value,331,y);
      c.strokeStyle='#184255';c.beginPath();c.moveTo(40,y+16);c.lineTo(722,y+16);c.stroke();
    });
    c.font='bold 22px sans-serif';
    c.fillStyle = state?.deviceStatus === 'online' ? '#38deaf' : '#ffbe68';
    c.fillText(state?.deviceStatus === 'online' ? 'SIMULATOR CONNECTED' : 'DEVICE NOT LIVE',42,468);
    texture.needsUpdate = true;
  },[context,texture,state]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  const delta = exploded ? [.45,.25,-.12] : [0,0,0];
  return <mesh position={[2.337+delta[0],3.572+delta[1],-1.247+delta[2]]}
      onPointerDown={e=>{e.stopPropagation();onPick('display');}}>
    <planeGeometry args={[1.89,1.225]}/>
    <meshBasicMaterial map={texture} side={FrontSide} toneMapped={false}/>
  </mesh>;
}

function StatusBeacon({ position, active=false, tint='#30e3c4' }) {
  return <mesh position={position}>
    <sphereGeometry args={[.074,10,10]}/>
    <meshBasicMaterial color={active ? tint : '#284659'}/>
    {active && <pointLight color={tint} intensity={.65} distance={1.1}/>}
  </mesh>;
}

function GuidedCamera({reset, rotate, selected}) {
  const ref=useRef();
  useEffect(()=>{
    const controls=ref.current;if(!controls)return;
    const anchor=COMPONENT_BY_ID[selected]?.location;
    if(anchor){ controls.target.set(anchor[0]*.22,anchor[1]*.3,anchor[2]*.25);controls.update(); }
  },[selected]);
  useEffect(()=>{if(ref.current && reset)ref.current.reset();},[reset]);
  return <OrbitControls ref={ref} makeDefault enableDamping dampingFactor={.08} autoRotate={rotate} autoRotateSpeed={.36}
      minDistance={5} maxDistance={17} minPolarAngle={.15} maxPolarAngle={Math.PI*.84}/>;
}

function DeviceScene({ selected, onSelect, explode, rotate, reset, state, wiringMode }) {
  return <Canvas camera={{position:[8.5,6.1,10.4],fov:39,near:.1,far:100}} dpr={[1,1.55]} gl={{antialias:true,powerPreference:'low-power'}}>
    <color attach="background" args={['#091b29']}/>
    <fog attach="fog" args={['#091b29',15,25]}/>
    <hemisphereLight color="#c1f7f5" groundColor="#143143" intensity={1.8}/>
    <ambientLight intensity={.75}/>
    <directionalLight position={[2,9,7]} intensity={2.5} color="#fff4db"/>
    <directionalLight position={[-5,3,-4]} intensity={1.8} color="#4abbd6"/>
    <pointLight position={[2.4,3,-.4]} color="#35dcc9" intensity={1.3} distance={8}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.12,0]}>
      <planeGeometry args={[200,200]}/><meshStandardMaterial color="#071521" roughness={.92}/>
    </mesh>
    <gridHelper args={[19,23,'#21516a','#133044']} position={[0,-.10,0]}/>
    <Suspense fallback={<Html center><div className="twin-loading">Loading 3D assembly…</div></Html>}>
      <DeviceModel onPick={onSelect} selection={selected} exploded={explode} valveVerified={state.valve.verified} wiringMode={wiringMode}/>
      <LiveScreen state={state} exploded={explode} onPick={onSelect}/>
      {COMPONENT_BY_ID[selected] && !explode && <Html position={[
        COMPONENT_BY_ID[selected].location[0],COMPONENT_BY_ID[selected].location[1]+.33,COMPONENT_BY_ID[selected].location[2]
      ]} distanceFactor={7} center style={{pointerEvents:'none'}}>
        <span className="twin-3d-anchor">{COMPONENT_BY_ID[selected].short}</span>
      </Html>}
      {!explode && <WaterSignal flowing={state.canShowFlow} haze={state.haze} isolated={state.valveStage==='verified_closed'}/>}
      <StatusBeacon position={[-1.31,3.54,-1.66]} active={state.deviceStatus==='online'} tint="#33edc5"/>
      <StatusBeacon position={[2.4,2.35,-1.55]} active={Boolean(state.valve.acknowledged)} tint="#53c7ff"/>
      <StatusBeacon position={[3.20,2.58,.86]} active={state.valveStage==='verified_closed'} tint="#ffb476"/>
    </Suspense>
    <GuidedCamera rotate={rotate} reset={reset} selected={selected}/>
  </Canvas>;
}

function InspectCard({ component, projected }) {
  if (!component) return null;
  const sensorValue = sensorLabel(component, projected);
  const hasFresh = projected.deviceStatus === 'online';
  return <div className="twin-inspection" aria-live="polite">
    <div className="twin-inspect-top"><span className="twin-type">{component.kind}</span><span className="twin-selected-flag">Selected component</span></div>
    <h3>{component.name}</h3>
    <p>{component.about}</p>
    {sensorValue && <div className="twin-reading"><span>Latest valid reading</span><strong>{sensorValue}</strong><small>{hasFresh ? 'Device recently contacted' : 'Historical/stale — not live'}</small></div>}
    {component.id === 'valve' && <div className="twin-reading"><span>Virtual closure evidence</span><strong>{stageLabels[projected.valveStage]}</strong><small>Command: {projected.valve.commanded || 'none'} / acknowledgment: {projected.valve.acknowledged || 'none'} / independent virtual verification: {projected.valve.verified || 'none'}</small></div>}
    {component.id === 'relay' && <div className="twin-reading"><span>Virtual relay</span><strong>{projected.valve.acknowledged ? 'Acknowledged' : 'Not acknowledged'}</strong><small>{projected.valve.relay_energized ? 'Energized (virtual)' : 'De-energized / unknown'} · Relay acknowledgment is not proof of water-line closure.</small></div>}
    {component.id === 'esp32' && <div className="twin-reading"><span>Backend device status</span><strong>{projected.deviceStatus}</strong><small>{projected.pending ? 'Repeat confirmation pending' : 'No repeat confirmation pending'}</small></div>}
    {component.id === 'display' && <div className="twin-reading"><span>Rule and model (separate)</span><strong>{projected.rating || 'Not rated'} / {projected.model?.class || 'No ML class'}</strong><small>ML score: {Number.isFinite(projected.model?.score) ? projected.model.score.toFixed(3) : 'unavailable'}</small></div>}
  </div>;
}

export default function HardwareTwin({summary}) {
  const projected = useMemo(()=>projectHardwareState(summary),[summary]);
  const [selected,setSelected] = useState('esp32');
  const [explode,setExplode] = useState(false);
  const [rotate,setRotate] = useState(false);
  const [reset,setReset] = useState(0);
  const [tour,setTour] = useState(false);
  const [wiringMode,setWiringMode] = useState('signals');
  const current = COMPONENT_BY_ID[selected];
  function nextSelection(delta){ const i=COMPONENTS.findIndex(c=>c.id===selected);setSelected(COMPONENTS[(i+delta+COMPONENTS.length)%COMPONENTS.length].id);}
  return <div className="twin-page">
    <div className="twin-intro">
      <div><div className="eyebrow">INTERACTIVE 3D HARDWARE · DIGITAL TWIN</div><h2>AquaSentra device explorer</h2>
      <p>Explore the proposed IoT assembly and watch simulated sensor and valve states update from the existing AquaSentra backend. No physical device is connected.</p></div>
      <div className="twin-intro-stats"><Capsule className={projected.deviceStatus==='online'?'ok':'warn'}>{projected.deviceStatus==='online'?<Wifi size={14}/>:<WifiOff size={14}/>} {projected.deviceStatus}</Capsule><Capsule><Cpu size={14}/> {summary?.selected_device_id || 'No device'}</Capsule></div>
    </div>
    <div className="twin-summary-row">
      <div><span>Rule rating</span><strong className={projected.rating==='Critical'?'red':projected.rating==='Risky'?'amber':'mint'}>{projected.rating || 'Not rated'}</strong></div>
      <div><span>ML decision</span><strong>{projected.model?.class || 'Awaiting model'}</strong></div>
      <div><span>Repeat confirmation</span><strong>{projected.pending?'Pending':'Not pending'}</strong></div>
      <div><span>Virtual valve</span><strong className={projected.valveStage==='fault'?'red':''}>{stageLabels[projected.valveStage]}</strong></div>
    </div>
    <div className="twin-layout">
      <section className="twin-viewer" aria-label="Interactive 3D AquaSentra assembly">
        <div className="twin-viewer-header"><span className="twin-viewer-title"><ScanEye size={16}/> 3D DEVICE / CONCEPT ASSEMBLY</span><span>Orbit · zoom · select</span></div>
        <div className="twin-canvas-wrap"><ModelErrorBoundary><DeviceScene selected={selected} onSelect={setSelected} explode={explode} rotate={rotate} reset={reset} state={projected} wiringMode={wiringMode}/></ModelErrorBoundary>
          <div className="twin-floating-note"><span className="twin-dot"/> {projected.canShowFlow?'Animated supply flow: verified open (virtual)':'No flow depicted until virtual open is verified'}</div>
        </div>
        <div className="twin-viewer-toolbar">
          <button type="button" className={explode?'active':''} onClick={()=>setExplode(v=>!v)} aria-pressed={explode}><Layers3 size={16}/> {explode?'Assembled':'Explode view'}</button>
          <button type="button" className={rotate?'active':''} onClick={()=>setRotate(v=>!v)} aria-pressed={rotate}><Rotate3D size={16}/> Auto rotate</button>
          <button type="button" onClick={()=>setReset(v=>v+1)}><RotateCcw size={16}/> Reset view</button>
          <button type="button" onClick={()=>setTour(v=>!v)} aria-pressed={tour} className={tour?'active':''}><CircleHelp size={16}/> Guided tour</button>
          <label className="twin-wiring-filter">Wiring
            <select aria-label="3D wiring overlay" value={wiringMode} onChange={e=>setWiringMode(e.target.value)}>
              <option value="signals">GPIO signals</option>
              <option value="power">Power and grounds</option>
              <option value="probes">Sensor probe cables</option>
              <option value="all">All connections</option>
              <option value="hidden">Hide wiring</option>
            </select>
          </label>
        </div>
      </section>
      <section className="twin-components" aria-label="Choose a component to inspect">
        <div className="twin-components-header"><div className="twin-type">HARDWARE MAP</div><h3>Explore components</h3><p>Select a part in the model or use these controls.</p></div>
        <div className="twin-component-list">
          {COMPONENTS.map(c=><button type="button" key={c.id} className={`twin-component-item ${selected===c.id?'selected':''}`} aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)}>
            <span className="twin-part-icon">{c.kind==='sensor'?<Droplets size={16}/>:c.kind==='control'?<Gauge size={16}/>:c.kind==='logic'?<Cpu size={16}/>:c.kind==='interface'?<Activity size={16}/>:<Box size={16}/>}</span>
            <span><strong>{c.short}</strong><small>{c.kind==='sensor'?sensorLabel(c,projected):c.id==='valve'?stageLabels[projected.valveStage]:c.kind.toUpperCase()}</small></span>
            {selected===c.id&&<span className="twin-active-line"/>}
          </button>)}
        </div>
      </section>
    </div>
    <div className="twin-detail-grid">
      <InspectCard component={current} projected={projected}/>
      <div className="twin-notes twin-connections">
        <div className="twin-notes-title"><Info size={17}/><h3>Proposed wiring</h3></div>
        <p>This is a <strong>visual pin-level design proposal</strong>, not an electrically tested schematic. Select a wiring overlay above to distinguish different connections.</p>
        <div className="twin-net-list">{wiringManifest.connections
          .filter(n => wiringMode === 'all' || (wiringMode === 'signals' && ['signal','feedback','3V3'].includes(n.domain)) || (wiringMode === 'power' && ['5V','GND','12V'].includes(n.domain)) || (wiringMode === 'probes' && n.domain === 'probe'))
          .slice(0,12).map(n=><div key={n.id} className="twin-net-row"><span>{n.domain}</span><small>{n.source} → {n.destination}</small></div>)}</div>
        <small>GPIO34 pH · GPIO35 turbidity · GPIO32 TDS · GPIO4 DS18B20 · GPIO26 relay IN · GPIO27 independent switch. Verify exact module voltage outputs, relay polarity, suppression, and connector pin order before building real hardware.</small>
      </div>
      <div className="twin-notes">
        <div className="twin-notes-title"><Info size={17}/><h3>Digital twin safeguards</h3></div>
        <p>The 3D view is <strong>read-only</strong>. It consumes the same authorized dashboard summary as the existing application and never requests a valve command.</p>
        <p>Animations depict <strong>simulated evidence only</strong>: command → acknowledgment → independent virtual verification. No actual water flow, electronics, or mechanical reliability is verified.</p>
        <p>The STEP assembly is a concept model with non-manufacturing dimensions. Component bodies are importable into SolidCraft for CAD refinement.</p>
      </div>
    </div>
    {tour && <div className="twin-tour" role="region" aria-label="Guided assembly tour"><div><span className="twin-type">GUIDED TOUR / {COMPONENTS.findIndex(c=>c.id===selected)+1} OF {COMPONENTS.length}</span><strong>{current?.name}</strong><p>{current?.about}</p></div><div className="twin-tour-nav"><button onClick={()=>nextSelection(-1)} aria-label="Previous component"><ChevronLeft size={18}/></button><button onClick={()=>nextSelection(1)} aria-label="Next component"><ChevronRight size={18}/></button></div></div>}
    <p className="twin-disclaimer"><ShieldAlert size={16}/> Educational software simulation and engineering concept only. Not a certified drinking-water safety device; physical sensor accuracy, waterproofing, voltage protection, and fail-closed behavior have not been tested.</p>
  </div>;
}
useGLTF.preload('/models/aquasentra-device.glb');
