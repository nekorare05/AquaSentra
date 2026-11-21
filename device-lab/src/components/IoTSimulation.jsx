import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  Play, Pause, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2,
  AlertTriangle, ShieldAlert, Zap, Radio, Database, Activity, Eye,
  CircleHelp, Sparkles, Droplets
} from 'lucide-react';
import { SIMULATION_STEPS, SCENARIOS } from '../data/simulationScenarios';
import { getComponentByMeshName } from '../data/componentData';

function Simulation3DScene({ targetMesh, canShowFlow, haze, valveVerified }) {
  const { scene } = useGLTF('/models/aquasentra-device.glb');
  const bubblesGroup = useRef();

  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material?.clone();
      const comp = getComponentByMeshName(o.name);
      o.userData.componentId = comp ? comp.id : null;
      if (['frame', 'water', 'base', 'wire'].includes(o.name.split(':')[0])) {
        o.raycast = () => null;
      }
    });
    return copy;
  }, [scene]);

  // Highlight component relevant to current simulation step
  useEffect(() => {
    model.traverse(o => {
      if (!o.isMesh || !o.material || !o.material.emissive) return;
      const isTarget = targetMesh && (
        o.userData.componentId === targetMesh ||
        o.name.startsWith(targetMesh + ':') ||
        (targetMesh === 'ph' && ['ph', 'turbidity', 'tds', 'temperature'].includes(o.userData.componentId))
      );
      o.material.emissive.set(isTarget ? '#0284c7' : '#000000');
      o.material.emissiveIntensity = isTarget ? 0.45 : 0;
    });
  }, [model, targetMesh]);

  // Water flow particles animation
  useFrame(({ clock }) => {
    if (bubblesGroup.current && canShowFlow) {
      const time = clock.getElapsedTime();
      bubblesGroup.current.children.forEach((bubble, i) => {
        bubble.position.x = ((time * 1.3 + i * 0.85) % 7.2) - 3.7;
        bubble.position.y = 1.13 + Math.sin(time * 2.2 + i) * 0.05;
      });
    }
  });

  return (
    <group>
      <primitive object={model} />

      {/* Simulated water cell haze */}
      <mesh position={[-0.07, 1.12, 0.88]}>
        <boxGeometry args={[4.5, 0.52, 0.87]} />
        <meshBasicMaterial transparent opacity={haze * 0.28} color="#f5dbb6" depthWrite={false} />
      </mesh>

      {/* Flow animation ONLY when verified open */}
      {canShowFlow && (
        <group ref={bubblesGroup}>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[-3.8 + i * 0.88, 1.12, 0.88]}>
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      )}

      {/* Physical isolation barrier indicator when verified closed */}
      {valveVerified === 'closed' && (
        <mesh position={[3.22, 1.2, 0.88]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.38, 0.035, 8, 32]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      )}
    </group>
  );
}

export default function IoTSimulation({ backendState }) {
  const [scenarioId, setScenarioId] = useState('critical');
  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const controlsRef = useRef();

  const scenario = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0];
  const stepInfo = SIMULATION_STEPS.find(s => s.step === currentStep) || SIMULATION_STEPS[0];

  // Auto-play timer
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep(prev => (prev >= 10 ? 1 : prev + 1));
      }, 4000);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.min(10, prev + 1));
  };

  // Enforce rule: Flow can only exist when valve is verified open and device online
  // Never display acknowledged command as verified closure
  const isStepAfterActuation = currentStep >= 9;
  const effectiveValveVerified = isStepAfterActuation ? scenario.valveVerified : 'open';
  const effectiveSupplyStatus = isStepAfterActuation ? scenario.supplyStatus : 'simulated_open';
  const canShowFlow = isStepAfterActuation ? scenario.flowActive : true;

  return (
    <div className="simulation-page-layout">
      {/* Scenario Selection Header */}
      <div className="scenario-bar">
        <div className="scenario-label">SELECT OPERATIONAL SCENARIO:</div>
        <div className="scenario-chips">
          {SCENARIOS.map(sc => (
            <button
              key={sc.id}
              className={`scenario-chip ${sc.id === scenarioId ? 'active' : ''}`}
              onClick={() => {
                setScenarioId(sc.id);
                setCurrentStep(1);
                setIsPlaying(false);
              }}
            >
              <span className="sc-badge">{sc.badge}</span>
              <span className="sc-name">{sc.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid: 3D Visualization + Stepper Controls */}
      <div className="simulation-content-grid">
        {/* Left Column: 3D Scene View */}
        <div className="sim-3d-box">
          <div className="sim-viewport-header">
            <div>
              <span className="live-tag">STEP {currentStep} OF 10</span>
              <strong style={{ marginLeft: '8px' }}>{stepInfo.subsystem}</strong>
            </div>
            <div className="valve-state-pill">
              <span>Valve: </span>
              <strong className={effectiveValveVerified === 'closed' ? 'text-red' : effectiveValveVerified === 'open' ? 'text-green' : 'text-amber'}>
                {effectiveValveVerified === 'closed' ? 'VERIFIED ISOLATED' : effectiveValveVerified === 'open' ? 'VERIFIED OPEN' : 'UNVERIFIED / FAULT'}
              </strong>
            </div>
          </div>

          <div className="sim-canvas-wrap">
            <Canvas camera={{ position: [0, 3.2, 5.8], fov: 42 }}>
              <color attach="background" args={['#0a101d']} />
              <ambientLight intensity={0.7} />
              <directionalLight position={[6, 8, 6]} intensity={1.2} />
              <directionalLight position={[-6, -3, -5]} intensity={0.4} color="#38bdf8" />
              <pointLight position={[0, 4, 1]} intensity={0.7} />

              <React.Suspense fallback={null}>
                <Simulation3DScene
                  targetMesh={stepInfo.targetMesh}
                  canShowFlow={canShowFlow}
                  haze={scenario.hazeOpacity}
                  valveVerified={effectiveValveVerified}
                />
              </React.Suspense>

              <gridHelper args={[10, 20, '#1e293b', '#0f172a']} position={[0, -1.8, 0]} />
              <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.06} />
            </Canvas>

            <div className="sim-water-overlay">
              <span>Fluid state: <strong>{canShowFlow ? 'Active Flow' : 'Halted / Isolated'}</strong></span>
              <span>Turbidity visual haze: <strong>{scenario.telemetry.turbidity} NTU</strong></span>
            </div>
          </div>
        </div>

        {/* Right Column: Step Telemetry & Explanation Card */}
        <div className="sim-info-box">
          {/* Step Header */}
          <div className="sim-step-header">
            <div className="eyebrow" style={{ color: scenario.colorTheme }}>{scenario.name}</div>
            <h2>{stepInfo.title}</h2>
            <p className="step-summary">{stepInfo.summary}</p>
          </div>

          {/* Detailed Step Activity */}
          <div className="sim-details-card">
            <h4>Technical Step Activities</h4>
            <p>{stepInfo.description}</p>
            {scenario.stepNotes[currentStep] && (
              <div className="scenario-specific-note" style={{ borderLeftColor: scenario.colorTheme }}>
                <strong>Scenario Event: </strong>
                {scenario.stepNotes[currentStep]}
              </div>
            )}
          </div>

          {/* Subsystem State Matrix for Current Step */}
          <div className="sim-state-matrix">
            <div className="state-row">
              <span>ESP32 Firmware Activity:</span>
              <strong>{stepInfo.esp32Activity}</strong>
            </div>
            <div className="state-row">
              <span>Network / Bus State:</span>
              <strong>{stepInfo.networkState}</strong>
            </div>
            <div className="state-row">
              <span>Backend Ingestion & DB:</span>
              <strong>{stepInfo.backendState}</strong>
            </div>
            <div className="state-row">
              <span>Virtual Actuator & Flow:</span>
              <strong className={effectiveValveVerified === 'closed' ? 'text-red' : 'text-green'}>
                {stepInfo.valveState}
              </strong>
            </div>
          </div>

          {/* Live Telemetry Values in this scenario */}
          <div className="sim-telemetry-strip">
            <div className="telemetry-pill">
              <span className="lbl">pH:</span>
              <span className="val">{scenario.telemetry.pH}</span>
            </div>
            <div className="telemetry-pill">
              <span className="lbl">Turbidity:</span>
              <span className="val">{scenario.telemetry.turbidity} NTU</span>
            </div>
            <div className="telemetry-pill">
              <span className="lbl">TDS:</span>
              <span className="val">{scenario.telemetry.TDS} mg/L</span>
            </div>
            <div className="telemetry-pill">
              <span className="lbl">Rating:</span>
              <span className={`val rating-${scenario.ruleRating.toLowerCase()}`}>{scenario.ruleRating}</span>
            </div>
            <div className="telemetry-pill">
              <span className="lbl">ML Score:</span>
              <span className="val">{scenario.mlScore.toFixed(3)}</span>
            </div>
          </div>

          {/* Safety Distinction Box */}
          <div className="sim-safety-alert">
            <CircleHelp size={16}/>
            <div>
              <strong>Audit Safety Principle:</strong> Relay command acknowledgment is never displayed as verified closure. Mechanical verification requires independent feedback.
            </div>
          </div>
        </div>
      </div>

      {/* Stepper Progress Bar & Controls Footer */}
      <div className="simulation-stepper-footer">
        <div className="stepper-controls">
          <button className="step-btn" onClick={handlePrev} disabled={currentStep === 1}>
            <ChevronLeft size={16}/>
            <span>Previous</span>
          </button>
          <button
            className={`play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={16}/> : <Play size={16}/>}
            <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
          </button>
          <button className="step-btn" onClick={handleNext} disabled={currentStep === 10}>
            <span>Next</span>
            <ChevronRight size={16}/>
          </button>
          <button className="reset-btn" onClick={() => { setCurrentStep(1); setIsPlaying(false); }}>
            <RotateCcw size={14}/>
            <span>Reset</span>
          </button>
        </div>

        {/* Step Circles 1 to 10 */}
        <div className="stepper-track">
          {SIMULATION_STEPS.map(s => {
            const isCompleted = s.step < currentStep;
            const isCurrent = s.step === currentStep;
            return (
              <button
                key={s.step}
                className={`step-dot ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => {
                  setCurrentStep(s.step);
                  setIsPlaying(false);
                }}
                title={s.title}
              >
                <span className="dot-num">{s.step}</span>
                <span className="dot-title">{s.short}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
