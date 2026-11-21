/**
 * AquaSentra 3D Lab — Component Library Specification Data
 * Details name, purpose, proposed connections, required voltage, role in AquaSentra,
 * and explicit disclaimers regarding approximate geometry and unverified electrical assumptions.
 */

export const COMPONENTS_DATA = [
  {
    id: 'esp32',
    name: 'ESP32 DevKit V1 / ESP32-WROOM-32',
    shortName: 'ESP32 DevKit',
    category: 'Compute & Logic',
    meshPrefixes: ['esp32', 'led:status-wifi'],
    voltage: '5.0 V DC (VIN) / 3.3 V Logic Level',
    purpose: 'Central embedded IoT microcontroller providing multi-channel ADC reading, 1-Wire communication, GPIO relay actuation, simulated valve feedback acquisition, TLS encryption, and Wi-Fi telemetry transport.',
    roleInAquaSentra: 'Coordinates data acquisition from all four water sensors, formats structured JSON payloads, executes local hardware health checks, and securely transmits readings over HTTPS to the backend ingestion endpoint. Receives and processes virtual valve isolation and restoration commands.',
    proposedConnections: [
      { pin: 'GPIO34 (ADC1_CH6)', target: 'pH Scaler Output (Analog)', domain: 'Signal' },
      { pin: 'GPIO35 (ADC1_CH7)', target: 'Turbidity Scaler Output (Analog)', domain: 'Signal' },
      { pin: 'GPIO32 (ADC1_CH4)', target: 'TDS Meter V1.0 Analog OUT', domain: 'Signal' },
      { pin: 'GPIO4', target: 'DS18B20 1-Wire DQ (4.7 kΩ pull-up to 3.3V)', domain: 'Signal' },
      { pin: 'GPIO26', target: '5V Relay Module IN Trigger', domain: 'Signal' },
      { pin: 'GPIO27', target: 'Independent Valve Position Feedback Switch', domain: 'Feedback' },
      { pin: 'VIN (5V)', target: 'Buck Converter Regulated +5.0 V', domain: 'Power' },
      { pin: 'GND', target: 'Common DC Ground Bus', domain: 'Ground' }
    ],
    specifications: [
      { label: 'Processor', value: 'Tensilica Xtensa Dual-Core 32-bit LX6 @ 240 MHz' },
      { label: 'Memory', value: '520 KB SRAM, 4 MB SPI Flash' },
      { label: 'Wireless', value: 'Wi-Fi 802.11 b/g/n (up to 150 Mbps) + BLE 4.2' },
      { label: 'ADC Resolution', value: '12-bit SAR ADC (configured with 11 dB attenuation)' },
      { label: 'Operating Temp', value: '-40 °C to +85 °C' }
    ],
    assumptionsAndWarnings: [
      'APPROXIMATE 3D MODEL: Rendered from standard 38-pin DevKit geometry. Physical pin header ordering varies widely between board vendors (e.g., NodeMCU-32S vs DOIT DevKit v1). Always check silkscreen pin labels before wiring physical hardware.',
      'UNVERIFIED ELECTRICAL ASSUMPTION: ESP32 ADC inputs tolerate max 3.3 V. Direct 5 V inputs from analog sensor boards will destroy ADC channels. Dedicated resistive scaling or operational amplifier buffering is mandatory.',
      'ADC2 RESTRICTION: Only ADC1 GPIOs (32, 34, 35) are used because ADC2 is shared with the internal Wi-Fi radio and cannot sample during transmission.',
      'BOOT STATE CAUTION: GPIO26 boot glitching must be verified to prevent momentary uncommanded relay cycling during reboot.'
    ]
  },
  {
    id: 'ph',
    name: 'PH-4502C pH Sensor Module & E201 Electrode',
    shortName: 'PH-4502C Module & Probe',
    category: 'Water Quality Sensor',
    meshPrefixes: ['ph', 'conditioning:ph', 'led:ph-light'],
    voltage: '5.0 V DC (VCC)',
    purpose: 'Measures hydrogen-ion electrochemical potential in water to determine acidity or alkalinity on a 0–14 pH logarithmic scale.',
    roleInAquaSentra: 'Supplies continuous pH telemetry to evaluate municipal drinking water against the study provisional Normal reference range (6.5–8.5 pH). Acidic (<6.0) or caustic (>9.0) conditions trigger early warnings or critical anomaly alarms.',
    proposedConnections: [
      { pin: 'VCC', target: 'Regulated +5.0 V Bus', domain: 'Power' },
      { pin: 'GND', target: 'Common DC Ground Bus', domain: 'Ground' },
      { pin: 'PO (Analog Out)', target: 'Dedicated Voltage Scaler Input (Divider)', domain: 'Signal' },
      { pin: 'Scaler OUT', target: 'ESP32 GPIO34 (ADC1_CH6)', domain: 'Signal' },
      { pin: 'BNC Socket', target: 'E201 Glass Combination Electrode BNC Plug', domain: 'Probe Cable' },
      { pin: 'TO (Temp Out)', target: 'Unconnected (DS18B20 used instead)', domain: 'Unused' }
    ],
    specifications: [
      { label: 'Measurement Range', value: '0.00 – 14.00 pH' },
      { label: 'Module Output', value: '0 – 5 V Analog voltage (nominally 2.5 V at pH 7.0)' },
      { label: 'Electrode Type', value: 'E201 glass bulb combination electrode with Ag/AgCl reference' },
      { label: 'Response Time', value: '≤ 1 minute at steady flow' },
      { label: 'Calibration', value: 'Multi-turn trimmer potentiometer for zero-point offset' }
    ],
    assumptionsAndWarnings: [
      'APPROXIMATE 3D MODEL: Geometric reconstruction of standard blue/green PH-4502C PCB and blue glass bulb electrode. Trimmer pot position and BNC metal housing are modeled for visual layout.',
      'VOLTAGE SCALING MANDATORY: Module output reaches ~5 V at extreme alkaline levels. Must pass through a precision 2:3 voltage divider (e.g. 10 kΩ / 20 kΩ) before ESP32 GPIO34.',
      'CALIBRATION ASSUMPTION: Sensor requires regular two-point buffer calibration (pH 4.01 and pH 6.86). Glass bulb must remain wet in 3M KCl solution and cannot dry out in the chamber.'
    ]
  },
  {
    id: 'turbidity',
    name: 'SEN0189 Turbidity Sensor Module & Fork Probe',
    shortName: 'SEN0189 Turbidity',
    category: 'Water Quality Sensor',
    meshPrefixes: ['turbidity', 'conditioning:turb', 'led:turbidity-light'],
    voltage: '5.0 V DC (VCC)',
    purpose: 'Detects suspended particulates, silt, organic colloids, and cloudiness in water through 880 nm optical light transmittance across a slotted sampling gap.',
    roleInAquaSentra: 'Provides immediate optical indication of particulate contamination, sediment disturbance, or pipe scouring. Triggers study-defined Risky warnings above 5.0 NTU and Critical anomaly alerts above 10.0 NTU.',
    proposedConnections: [
      { pin: 'VCC', target: 'Regulated +5.0 V Bus', domain: 'Power' },
      { pin: 'GND', target: 'Common DC Ground Bus', domain: 'Ground' },
      { pin: 'Signal (A)', target: 'Dedicated Voltage Scaler Input', domain: 'Signal' },
      { pin: 'Scaler OUT', target: 'ESP32 GPIO35 (ADC1_CH7)', domain: 'Signal' },
      { pin: '3-Pin Header', target: 'SEN0189 Optical Fork Probe Cable (JST-XH)', domain: 'Probe Cable' }
    ],
    specifications: [
      { label: 'Sensor Technology', value: 'Infrared LED (880 nm) & phototransistor optical absorption' },
      { label: 'Measurement Range', value: '0 – 3000 NTU (calibrated for 0 – 30 NTU clean range)' },
      { label: 'Analog Output', value: '0.0 – 4.5 V (High voltage = clear water; Low voltage = turbid)' },
      { label: 'Operating Temp', value: '5 °C to +90 °C' },
      { label: 'Response Time', value: '< 500 ms' }
    ],
    assumptionsAndWarnings: [
      'APPROXIMATE 3D MODEL: Reconstructed from DFRobot SEN0189 documentation. The dual-tine fork and conditioning adapter are accurately shaped.',
      'INVERTED RESPONSE CURVE: Higher turbidity yields lower voltage (light obstruction). Firmware/backend must apply validated inverse calibration polynomials.',
      'WATERPROOFING LIMITATION: The optical tines are water-resistant, but the cable junction at the top of the probe head is NOT fully submersible and must be sealed with a bulkhead gland.'
    ]
  },
  {
    id: 'tds',
    name: 'TDS Meter V1.0 & Titanium Probe',
    shortName: 'TDS Meter V1.0',
    category: 'Water Quality Sensor',
    meshPrefixes: ['tds', 'led:tds-light'],
    voltage: '3.3 V to 5.0 V DC',
    purpose: 'Measures total dissolved ionic solids and minerals (salts, calcium, magnesium, heavy metal ions) in solution via electrical conductivity.',
    roleInAquaSentra: 'Assesses mineral contamination and chemical dissolution against the provisional study Normal limit (≤ 600 mg/L) and Critical limit (> 900 mg/L). Informs XGBoost model of sudden electrolyte spikes.',
    proposedConnections: [
      { pin: 'VCC', target: 'Regulated +5.0 V (or 3.3 V) Bus', domain: 'Power' },
      { pin: 'GND', target: 'Common DC Ground Bus', domain: 'Ground' },
      { pin: 'AOUT (Analog Out)', target: 'ESP32 GPIO32 (ADC1_CH4)', domain: 'Signal' },
      { pin: '2-Pin JST Terminal', target: 'Titanium Two-Electrode Probe Cable', domain: 'Probe Cable' }
    ],
    specifications: [
      { label: 'Measurement Range', value: '0 – 1000 ppm (mg/L)' },
      { label: 'Measurement Accuracy', value: '±10% Full Scale (at 25 °C)' },
      { label: 'Excitation Source', value: 'AC excitation signal (eliminates probe polarization & oxidation)' },
      { label: 'Electrode Material', value: 'Corrosion-resistant Titanium alloy dual pins' },
      { label: 'Output Range', value: '0.0 – 2.3 V (Naturally compatible with ESP32 ADC range)' }
    ],
    assumptionsAndWarnings: [
      'APPROXIMATE 3D MODEL: Modeled after DFRobot SEN0244 / Gravity TDS V1.0 geometry with cylindrical black probe housing and dual needle electrodes.',
      'TEMPERATURE COMPENSATION: Water electrical conductivity changes by ~2% per °C. Firmware must incorporate real-time temperature compensation using the DS18B20 reading for accurate ppm conversion.',
      'PROBE PLACEMENT: Probe cannot touch the chamber walls or be situated directly next to metal ground bolts to avoid stray eddy currents.'
    ]
  },
  {
    id: 'temperature',
    name: 'DS18B20 Waterproof Stainless Probe',
    shortName: 'DS18B20 Temp Probe',
    category: 'Operational Telemetry',
    meshPrefixes: ['temperature', 'conditioning:ds18b20'],
    voltage: '3.0 V to 5.5 V DC (Powered at 3.3 V)',
    purpose: 'Supplies high-accuracy digital water temperature readings for operational logging and real-time compensation of pH and TDS calculations.',
    roleInAquaSentra: 'Monitors thermal operating context (provisional operational reference: 15–35 °C). Out-of-range temperatures are flagged as operational notices but do NOT directly close the valve.',
    proposedConnections: [
      { pin: 'Red Wire (VDD)', target: '3.3 V Regulated Rail', domain: 'Power' },
      { pin: 'Black Wire (GND)', target: 'Common DC Ground Bus', domain: 'Ground' },
      { pin: 'Yellow Wire (DQ)', target: 'ESP32 GPIO4', domain: 'Signal' },
      { pin: 'External Resistor', target: '4.7 kΩ Pull-up Resistor between DQ and 3.3 V', domain: 'Signal' }
    ],
    specifications: [
      { label: 'Digital Interface', value: 'Dallas 1-Wire protocol (single data line)' },
      { label: 'Measurement Range', value: '-55 °C to +125 °C' },
      { label: 'Resolution', value: 'Selectable 9-bit to 12-bit (0.0625 °C steps)' },
      { label: 'Accuracy', value: '±0.5 °C (from -10 °C to +85 °C)' },
      { label: 'Enclosure', value: '6 mm × 50 mm food-grade stainless steel capsule' }
    ],
    assumptionsAndWarnings: [
      'APPROXIMATE 3D MODEL: 3D stainless steel tube with black heat-shrink strain relief and 3-wire colored lead.',
      'PULL-UP RESISTOR REQUIRED: 1-Wire DQ line is open-drain; a physical 4.7 kΩ resistor to 3.3V is strictly required. Internal ESP32 pull-ups (~50 kΩ) are too weak and cause packet dropouts.',
      'CORROSION ASSUMPTION: 304 stainless steel capsule is suitable for potable freshwater, but high-chlorine or saline water will pit stainless over extended duration.'
    ]
  },
  {
    id: 'relay',
    name: '5 V Single-Channel Relay Module',
    shortName: '5V Relay Module',
    category: 'Virtual Actuator Interface',
    meshPrefixes: ['relay'],
    voltage: '5.0 V DC (Coil VCC) / 3.3 V Trigger',
    purpose: 'Optocoupler-isolated electromechanical switch controlling the 12 V power circuit of the normally closed solenoid isolation valve.',
    roleInAquaSentra: 'Executes the virtual isolation command from the ESP32. De-energizing the relay opens the 12 V circuit to drop the solenoid valve into its fail-closed sealed position.',
    proposedConnections: [
      { pin: 'VCC', target: 'Regulated +5.0 V Bus', domain: 'Power' },
      { pin: 'GND', target: 'Common DC Ground Bus', domain: 'Ground' },
      { pin: 'IN', target: 'ESP32 GPIO26', domain: 'Signal' },
      { pin: 'COM (Common)', target: 'Inline 2A Fused +12 V Bus from Power Supply', domain: '12V Power' },
      { pin: 'NO (Normally Open)', target: 'Solenoid Valve (+) Coil Terminal', domain: '12V Power' }
    ],
    specifications: [
      { label: 'Relay Model', value: 'Songle SRD-05VDC-SL-C' },
      { label: 'Contact Capacity', value: '10 A @ 250 VAC / 10 A @ 30 VDC' },
      { label: 'Isolation', value: 'PC817 Optocoupler galvanic barrier' },
      { label: 'Actuation Time', value: '≤ 10 ms operate time, ≤ 5 ms release time' },
      { label: 'Indicator LEDs', value: 'Power LED (Green) & Relay State LED (Red)' }
    ],
    assumptionsAndWarnings: [
      'APPROXIMATE 3D MODEL: Distinct Songle blue plastic cube, 3-position screw terminal block, optocoupler DIP-4 IC, transistor driver, and flyback protection diode.',
      'ACKNOWLEDGMENT VS VERIFICATION: Relay state LED or contact continuity proves ONLY electrical circuit switching, NOT physical valve spindle movement or water stoppage.',
      'FAIL-SAFE LOGIC: Active state energizes the relay to keep the NC valve open; power failure de-energizes the coil, causing immediate spring-return shutoff.'
    ]
  },
  {
    id: 'valve',
    name: '12 V Normally Closed Solenoid Valve',
    shortName: '12V NC Solenoid Valve',
    category: 'Hydraulic Actuator',
    meshPrefixes: ['valve'],
    voltage: '12.0 V DC (Nominal coil rating, ~400 mA)',
    purpose: 'Spring-loaded electromechanical fluid barrier designed to immediately shut off municipal household water feed upon detected contamination.',
    roleInAquaSentra: 'Primary fail-closed isolation valve. Automatically isolated when persistent anomalies are confirmed by rule and XGBoost detection. Restored only under authorized administrator inspection.',
    proposedConnections: [
      { pin: 'Coil Terminal (+)', target: 'Relay NO (Normally Open) Terminal', domain: '12V Power' },
      { pin: 'Coil Terminal (-)', target: '12V Power Supply Return (GND)', domain: '12V Ground' },
      { pin: 'Feedback Switch (+)', target: 'ESP32 GPIO27', domain: 'Feedback' },
      { pin: 'Feedback Switch (-)', target: 'Common Ground Bus', domain: 'Ground' },
      { pin: 'Inlet Port', target: 'Chamber Discharge Pipe (1/2" NPT Female)', domain: 'Hydraulic' },
      { pin: 'Outlet Port', target: 'Household Water Distribution Line', domain: 'Hydraulic' }
    ],
    specifications: [
      { label: 'Valve Action', value: 'Normally Closed (De-energized = Sealed Shut)' },
      { label: 'Body Material', value: 'Cast Brass with 1/2" NPT Female threaded ports' },
      { label: 'Working Pressure', value: '0.02 – 0.8 MPa (3 – 115 PSI)' },
      { label: 'Coil Rating', value: '12 V DC, 4.8 W, IP65 water-resistant' },
      { label: 'Feedback Mechanism', value: 'Independent physical limit/microswitch on valve stem' }
    ],
    assumptionsAndWarnings: [
      'APPROXIMATE 3D MODEL: Cast brass hexagonal valve body, electromagnetic coil block, spring-loaded armature plunger, and illustrative stem position limit switch.',
      'INDUCTIVE SPIKE SUPPRESSION: Disconnecting 12 V from an inductive coil generates a high-voltage back-EMF spike (>100 V). A 1N4007 flyback diode across coil terminals is mandatory.',
      'SIMULATED VERIFICATION ONLY: In the software prototype, position feedback is simulated. Physical installation requires calibrated flow sensors or validated microswitches to certify actual water shutoff.'
    ]
  },
  {
    id: 'power',
    name: '12 V Power Supply & DC-DC Buck Converter',
    shortName: 'Power & Regulation',
    category: 'Power Infrastructure',
    meshPrefixes: ['power'],
    voltage: 'AC 100–240 V Input → 12 V DC (Primary) & 5.0 V DC (Regulated Secondary)',
    purpose: 'Delivers isolated 12 V DC power for the solenoid valve and step-down regulated 5.0 V DC power for the ESP32 and sensor modules.',
    roleInAquaSentra: 'Provides clean, ripple-free dual-voltage electrical distribution. Physically isolates high-current actuator transients from sensitive micro-controller ADC reference voltages.',
    proposedConnections: [
      { pin: 'PSU V+ (+12V)', target: 'Buck Converter VIN+ & Inline 2A Fuse', domain: '12V Power' },
      { pin: 'PSU V- (0V)', target: 'Common 0V Ground Bus & Buck VIN-', domain: 'Ground' },
      { pin: 'Buck VOUT+ (+5.0V)', target: 'ESP32 VIN & Sensor VCC Bus', domain: '5V Power' },
      { pin: 'Buck VOUT- (GND)', target: 'Common DC Ground Bus', domain: 'Ground' }
    ],
    specifications: [
      { label: 'AC/DC Supply', value: 'Enclosed switching power supply, 12 V DC @ 2.0 A (24 W)' },
      { label: 'Regulator Type', value: 'LM2596 / MP1584 DC-DC Step-Down Buck Converter' },
      { label: 'Efficiency', value: 'Up to 92% switching efficiency at 150 kHz' },
      { label: 'Protection', value: 'Inline fast-blow 2.0 A fuse on 12 V valve feeder branch' }
    ],
    assumptionsAndWarnings: [
      'APPROXIMATE 3D MODEL: Perforated aluminum silver power supply cage with terminal block and blue LM2596 buck converter PCB with toroidal coil and trimmer.',
      'MAINS SAFETY: AC mains (110–240 V) wiring is NOT modeled or certified for student physical contact. Use pre-certified enclosed 12 V wall-adapter supplies.',
      'VOLTAGE CALIBRATION: Buck converter output potentiometer must be calibrated to exactly 5.00 V with a digital multimeter BEFORE connecting the ESP32.'
    ]
  },
  {
    id: 'chamber',
    name: 'Inline Water Flow Chamber, Tubing & Mounting Frame',
    shortName: 'Hydraulic Chamber & Frame',
    category: 'Hydraulic Manifold',
    meshPrefixes: ['chamber', 'water', 'tube', 'base', 'frame'],
    voltage: 'Passive Mechanical Structure',
    purpose: 'Houses all four water-quality sensor probes in continuous contact with flowing water without leakage or bubble entrapment, mounted on a rigid baseplate.',
    roleInAquaSentra: 'Provides the hydraulic test loop ensuring uniform water contact time across pH, Turbidity, TDS, and Temperature probes prior to reaching the isolation valve.',
    proposedConnections: [
      { pin: 'Inlet Fitting', target: 'Supply Line (1/2" ID Flexible Food-Grade Tubing)', domain: 'Hydraulic' },
      { pin: 'Probe Port 1', target: 'PH-4502C E201 Probe (Gland sealed PG7/PG9)', domain: 'Mechanical' },
      { pin: 'Probe Port 2', target: 'SEN0189 Turbidity Fork Probe (Submerged in cell)', domain: 'Mechanical' },
      { pin: 'Probe Port 3', target: 'TDS Titanium Conductivity Probe (Compression sealed)', domain: 'Mechanical' },
      { pin: 'Probe Port 4', target: 'DS18B20 Stainless Temperature Capsule', domain: 'Mechanical' },
      { pin: 'Outlet Fitting', target: 'Solenoid Isolation Valve Inlet', domain: 'Hydraulic' }
    ],
    specifications: [
      { label: 'Chamber Material', value: 'CNC-machined clear Polycarbonate / Cast Acrylic' },
      { label: 'Tubing Dimensions', value: '1/2" Inner Diameter (ID) × 5/8" Outer Diameter (OD)' },
      { label: 'Internal Volume', value: '~450 mL active fluid testing cell' },
      { label: 'Sealing', value: 'Food-grade EPDM gaskets and through-bolted compression plates' },
      { label: 'Baseplate', value: 'Anodized aluminum alloy baseplate with rubber vibration feet' }
    ],
    assumptionsAndWarnings: [
      'APPROXIMATE 3D MODEL: Transparent flow cell with water volume, bubble visuals, brass tube clamps, and mounting brackets. Dimensions are conceptual.',
      'PRESSURE WARNING: Acrylic test chambers cannot withstand unregulated mains pressure (which can spike above 80 PSI). Must be installed behind a pressure-reducing valve (PRV).',
      'BUBBLE TRAP ARTIFACTS: Entrapped air bubbles sticking to the turbidity optical lens or pH glass bulb will distort readings. Upward flow orientation is recommended.'
    ]
  }
];

export const COMPONENT_MAP = Object.fromEntries(COMPONENTS_DATA.map(c => [c.id, c]));

export function getComponentByMeshName(meshName = '') {
  const [prefix, detail = ''] = String(meshName).split(':');
  if (COMPONENT_MAP[prefix]) return COMPONENT_MAP[prefix];
  if (prefix === 'conditioning') {
    if (detail.startsWith('ph')) return COMPONENT_MAP.ph;
    if (detail.startsWith('turb')) return COMPONENT_MAP.turbidity;
    if (detail.startsWith('ds18b20')) return COMPONENT_MAP.temperature;
  }
  if (['water', 'tube', 'base', 'frame'].includes(prefix)) return COMPONENT_MAP.chamber;
  if (prefix === 'led') {
    if (detail.startsWith('ph-')) return COMPONENT_MAP.ph;
    if (detail.startsWith('turbidity-')) return COMPONENT_MAP.turbidity;
    if (detail.startsWith('tds-')) return COMPONENT_MAP.tds;
    if (detail.includes('wifi')) return COMPONENT_MAP.esp32;
  }
  return null;
}
