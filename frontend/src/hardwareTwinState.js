/** Read-only projection of the existing authenticated AquaSentra dashboard response.
 * Never commands hardware or alters detection/control decisions.
 */
export const COMPONENTS = [
  { id: 'esp32', name: 'ESP32 main controller', short: 'ESP32', kind: 'logic', about: 'Virtual device logic and communication; the board depicted here is a CAD concept only.', location: [-1.31, 3.17, -1.58] },
  { id: 'power', name: 'Power and 5 V regulation', short: 'Power', kind: 'supply', about: 'Concept 12 V supply, buck converter and protective enclosure. Wiring is illustrative, not electrical design approval.', location: [-2.77, 3.15, -1.58] },
  { id: 'ph', name: 'pH measurement probe', short: 'pH', kind: 'sensor', key: 'pH', unit: 'pH', digits: 2, about: 'Displays simulated acidity/alkalinity readings ingested by the existing backend.', location: [-1.88, 1.92, .87] },
  { id: 'turbidity', name: 'Turbidity probe', short: 'Turbidity', kind: 'sensor', key: 'turbidity', unit: 'NTU', digits: 1, about: 'Displays the turbidity reading; the visual water haze is an illustration only.', location: [-.76, 1.92, .87] },
  { id: 'tds', name: 'TDS conductivity probe', short: 'TDS', kind: 'sensor', key: 'TDS', unit: 'mg/L', digits: 0, about: 'Displays simulated total dissolved solids using the configured calibration assumptions.', location: [.36, 1.92, .87] },
  { id: 'temperature', name: 'DS18B20 temperature probe', short: 'Temperature', kind: 'sensor', key: 'temperature_c', unit: '°C', digits: 1, about: 'Temperature is operational context; it is not a stand-alone water-safety rating.', location: [1.52, 1.92, .87] },
  { id: 'chamber', name: 'Inline flow chamber', short: 'Flow chamber', kind: 'mechanical', about: 'Conceptual probe chamber and transparent tubing, drawn with non-manufacturing dimensions.', location: [0, 1.4, .87] },
  { id: 'relay', name: 'Relay output module', short: 'Relay', kind: 'control', about: 'Represents the virtual command output. Relay acknowledgment alone does not establish valve closure.', location: [2.44, 2.02, -1.58] },
  { id: 'valve', name: 'Normally closed solenoid valve', short: 'NC valve', kind: 'control', about: 'Virtual fail-closed valve. Only an independently simulated verification can label its position verified.', location: [3.21, 1.76, .87] },
  { id: 'display', name: 'Status display', short: 'Display', kind: 'interface', about: 'Local screen concept, with real values displayed in the browser inspection panel.', location: [2.38, 3.63, -1.58] },
];
export const COMPONENT_BY_ID = Object.fromEntries(COMPONENTS.map(c => [c.id, c]));

export function componentFromMeshName(name='') {
  const [prefix, detail=''] = String(name).split(':');
  if (COMPONENT_BY_ID[prefix]) return prefix;
  if (prefix === 'conditioning') return detail.startsWith('ph') ? 'ph' : detail.startsWith('turb') ? 'turbidity' : detail.startsWith('ds18b20') ? 'temperature' : null;
  if (prefix === 'water') return 'chamber';
  if (prefix === 'tube') return 'chamber';
  if (prefix === 'led') {
    const match = ['ph','turbidity','tds'].find(sensor => detail.startsWith(sensor + '-'));
    return match || (detail.includes('wifi') ? 'esp32' : 'display');
  }
  return null;
}

export function projectHardwareState(summary) {
  const reading = summary?.latest_live_valid_reading || null;
  const readings = reading?.payload || {};
  const valve = summary?.valve || {};
  const control = summary?.control || {};
  const model = summary?.model || {};
  const deviceStatus = summary?.device_status || 'never_seen';
  let valveStage = 'unknown';
  if (valve.fault || control.fault_mode === 'power_loss') valveStage = 'fault';
  else if (valve.verified === 'closed') valveStage = 'verified_closed';
  else if (valve.verified === 'open') valveStage = 'verified_open';
  else if (valve.acknowledged) valveStage = 'acknowledged_unverified';
  else if (valve.commanded) valveStage = 'commanded_unverified';
  // IMPORTANT: never animate simulated flow based on command or relay acknowledgement.
  const canShowFlow = valve.verified === 'open' && valve.supply_status === 'simulated_open'
    && !valve.fault && control.fault_mode !== 'power_loss' && deviceStatus === 'online';
  const haze = typeof readings.turbidity === 'number' && Number.isFinite(readings.turbidity)
    ? Math.min(.8, Math.max(.02, readings.turbidity / 110)) : .04;
  return { reading, readings, deviceStatus, valve, control, model, valveStage, canShowFlow, haze,
    rating: reading?.rule_rating || null, measuredAt: reading?.measured_at || null,
    pending: Boolean(control.pending), fault: valve.fault || (control.fault_mode !== 'none' ? control.fault_mode : null) || null,
  };
}

export function sensorLabel(component, projected) {
  if (component.kind !== 'sensor') return null;
  const v=projected.readings?.[component.key];
  return Number.isFinite(v) ? `${v.toFixed(component.digits)} ${component.unit}` : 'Awaiting simulated reading';
}
