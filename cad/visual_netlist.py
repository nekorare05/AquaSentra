"""Model-space layout of proposed AquaSentra signal paths, not a validated PCB wiring diagram.

Original CAD coordinates are millimeters; x,y,z are mapped to the web GLB renderer
by the `wp` helper of build_realistic_model.py. All endpoints refer to named
illustrative terminal pads constructed in the model, rather than arbitrary freehand lines.
"""
from __future__ import annotations

ESP32_LEFT_TOP = {'GPIO34': 4, 'GPIO35': 5, 'GPIO32': 6, 'GPIO26': 9,
                   'GPIO27': 10, 'GND': 13, 'VIN5V': 18}
ESP32_RIGHT_TOP = {'3V3': 0, 'GPIO4': 12, 'GND': 6}

def header_point(name):
    side, index = ('left', ESP32_LEFT_TOP[name]) if name in ESP32_LEFT_TOP else ('right', ESP32_RIGHT_TOP[name])
    return (-94 if side == 'left' else -50, 66, round(166 + (9-index)*4.35, 3))

def net(name, color, from_label, to_label, points, note='', domain='signal'):
    assert len(points) >= 2
    return dict(id=name, color=color, source=from_label, destination=to_label,
                points=points, domain=domain, note=note)

# Connector positions are also rendered as small solder pads / screw terminals.
P = {
    'ph_signal':(-13,63,212), 'ph_vcc':(-10,63,208), 'ph_gnd':(-7,63,204),
    'turb_signal':(-13,63,168),'turb_vcc':(-10,63,164),'turb_gnd':(-7,63,160),
    'tds_signal':(-13,63,124),'tds_vcc':(-10,63,120),'tds_gnd':(-7,63,116),
    'ph_div_in':(-26,48,208),'ph_div_out':(-26,48,198),'ph_div_gnd':(-35,48,204),
    'turb_div_in':(-26,48,164),'turb_div_out':(-26,48,154),'turb_div_gnd':(-35,48,160),
    'dallas_data':(80,-47,138),'dallas_vcc':(83,-47,136),'dallas_gnd':(77,-47,136),
    'relay_in':(89,64,114),'relay_vcc':(89,64,105),'relay_gnd':(89,64,96),
    'relay_com':(167,52,90),'relay_no':(167,52,101),'relay_nc':(167,52,112),
    'valve_plus':(171,-27,128),'valve_minus':(166,-27,128),
    'position_signal':(199,-40,101),'position_gnd':(199,-40,94),
    'psu_plus':(-168,40,122),'psu_minus':(-154,40,122),
    'buck_in_plus':(-166,48,79),'buck_in_minus':(-165,48,71),
    'buck_out_plus':(-128,48,79),'buck_out_minus':(-128,48,71),
    'fuse_in':(106,51,76),'fuse_out':(122,51,76),
    'pullup_dq':(-30,36,163),'pullup_3v3':(-40,36,205),
    'ph_probe':(-99,-47,139),'ph_bnc':(65,77,205),
    'turb_probe':(-40,-47,132),'turb_probe_module':(51,65,165),
    'tds_probe':(19,-47,132),'tds_probe_module':(51,65,121),
}
for pin in list(ESP32_LEFT_TOP) + list(ESP32_RIGHT_TOP):
    P['esp_'+pin] = header_point(pin)

# Each route travels through identifiable harness corridors; conductor endpoints
# coincide with explicit connector pads. No bypass from a 5 V analog output to the ESP32.
NETS = [
    net('psu_to_buck_plus','red','PSU +12V','buck converter VIN+',
        [P['psu_plus'],(-179,38,109),(-179,43,90),P['buck_in_plus']], domain='12V'),
    net('psu_to_buck_ground','black','PSU 0V','buck converter VIN-',
        [P['psu_minus'],(-160,38,102),(-173,42,79),P['buck_in_minus']],domain='12V'),
    net('fivev_to_esp32','red','buck regulated +5V','ESP32 VIN5V',
        [P['buck_out_plus'],(-108,39,78),(-105,39,126),P['esp_VIN5V']],domain='5V'),
    net('ground_to_esp32','black','buck ground','ESP32 GND',
        [P['buck_out_minus'],(-115,37,69),(-107,37,148),P['esp_GND']],domain='GND'),
]

# +5V and common GND are genuinely traced from the supply, not floating lines.
for sensor,z in [('ph',207),('turb',163),('tds',119)]:
    NETS += [
      net('supply_'+sensor,'red','buck +5V','%s module VCC'%sensor,
          [P['buck_out_plus'],(-103,40,78),(-35,39,82),(-30,39,z),P[sensor+'_vcc']],domain='5V',
          note='TDS module accepts 3.3–5.5V on verified DFRobot SEN0244; module variant must be checked.' if sensor=='tds' else ''),
      net('ground_'+sensor,'black','buck GND','%s module GND'%sensor,
          [P['buck_out_minus'],(-116,38,69),(-40,38,85),(-37,38,z-4),P[sensor+'_gnd']],domain='GND'),
    ]

NETS += [
  net('ph_to_divider','yellow','PH-4502C analog PO','pH ADC voltage scaler input',
      [P['ph_signal'],(-20,51,212),P['ph_div_in']],note='Analog output must be limited to ESP32 ADC voltage range.'),
  net('ph_div_to_gpio34','yellow','pH scaler output','ESP32 GPIO34 / ADC1_CH6',
      [P['ph_div_out'],(-40,42,197),(-101,42,188),P['esp_GPIO34']]),
  net('ph_scaler_ground','black','pH scaler GND','common GND',
      [P['ph_div_gnd'],(-42,42,194),(-103,39,148),P['esp_GND']],domain='GND'),
  net('turb_to_divider','yellow','SEN0189 analog A','turbidity ADC voltage scaler input',
      [P['turb_signal'],(-20,51,169),P['turb_div_in']],note='SEN0189 analog output can exceed 3.3V.'),
  net('turb_div_to_gpio35','yellow','turbidity scaler output','ESP32 GPIO35 / ADC1_CH7',
      [P['turb_div_out'],(-42,41,154),(-104,41,183),P['esp_GPIO35']]),
  net('turb_scaler_ground','black','turbidity scaler GND','common GND',
      [P['turb_div_gnd'],(-43,40,153),(-109,39,148),P['esp_GND']],domain='GND'),
  net('tds_to_gpio32','yellow','TDS Meter V1.0 analog','ESP32 GPIO32 / ADC1_CH4',
      [P['tds_signal'],(-31,45,124),(-45,42,131),(-101,42,179),P['esp_GPIO32']],
      note='Assumes verified TDS module output <= ESP32 ADC max; measure actual output before building.'),
]

# DS18B20 sensor and physical pull-up shown as its own resistor on a modeled carrier.
NETS += [
  net('temperature_data','yellow','DS18B20 DQ','ESP32 GPIO4',
      [P['dallas_data'],(91,-12,158),(82,18,164),(-37,29,163),P['esp_GPIO4']]),
  net('temperature_supply','red','ESP32 3V3','DS18B20 VDD',
      [P['esp_3V3'],(-40,36,205),(99,29,205),(100,-10,146),P['dallas_vcc']],domain='3V3'),
  net('temperature_ground','black','ESP32 GND','DS18B20 GND',
      [P['esp_GND'],(-103,35,149),(96,26,146),(95,-10,139),P['dallas_gnd']],domain='GND'),
  net('temperature_pullup','orange','DS18B20 DQ','4.7k resistor to ESP32 3V3',
      [P['pullup_dq'],(-30,36,192),P['pullup_3v3']],domain='3V3',
      note='Conceptual 4.7k data pull-up. Verify physical module has no existing pull-up.'),
]

# Relay board controls a normally closed valve via dry NO contacts. GPIO is never
# connected directly to the solenoid coil or external 12V load.
NETS += [
  net('relay_gpio26','yellow','ESP32 GPIO26','relay module IN',
      [P['esp_GPIO26'],(-106,40,165),(86,41,146),P['relay_in']],domain='signal'),
  net('relay_5v','red','buck +5V','relay module VCC',
      [P['buck_out_plus'],(-106,38,80),(82,37,90),P['relay_vcc']],domain='5V'),
  net('relay_ground','black','buck common GND','relay module GND',
      [P['buck_out_minus'],(-109,36,70),(79,36,80),P['relay_gnd']],domain='GND'),
  net('fused_12v','red','PSU +12V','inline 12V fuse input',
      [P['psu_plus'],(-181,43,112),(-182,55,72),(100,55,72),P['fuse_in']],domain='12V',
      note='Illustrative fuse; rating requires selected valve and power supply specifications.'),
  net('fused_12v_to_relay_com','red','inline fuse output','relay dry contact COM',
      [P['fuse_out'],(145,48,76),(166,50,80),P['relay_com']],domain='12V'),
  net('relay_no_to_valve','red','relay dry contact NO','valve coil +12V',
      [P['relay_no'],(186,40,105),(184,18,132),P['valve_plus']],domain='12V',
      note='Contact energizes to open. Default NO open must cut power.'),
  net('valve_to_12v_return','black','valve coil 0V','PSU 0V',
      [P['valve_minus'],(178,-16,116),(184,0,42),(-182,37,42),P['psu_minus']],domain='12V'),
  net('feedback_gpio27','green','independent valve-position switch','ESP32 GPIO27',
      [P['position_signal'],(203,6,149),(-106,35,158),P['esp_GPIO27']],domain='feedback',
      note='Switch is a concept only. GPIO27 digital input needs verified bias and debouncing.'),
  net('feedback_ground','black','independent valve-position switch','ESP32 GND',
      [P['position_gnd'],(205,1,136),(-108,34,143),P['esp_GND']],domain='GND'),
]
# Shielded / molded probe leads connect to the correct modules, never the GPIOs directly.
NETS += [
  net('ph_probe_to_bnc','black','E201 pH electrode BNC cable','PH-4502C BNC socket',
      [P['ph_probe'],(-100,-27,172),(-76,8,220),(55,44,225),P['ph_bnc']],domain='probe'),
  net('turb_probe_to_board','black','SEN0189 optical probe cable','SEN0189 conditioning module',
      [P['turb_probe'],(-37,-12,150),(36,27,166),P['turb_probe_module']],domain='probe'),
  net('tds_probe_to_board','black','TDS conductivity probe cable','TDS Meter board',
      [P['tds_probe'],(24,-9,145),(44,29,141),P['tds_probe_module']],domain='probe'),
]

# Signal-only blueprint expected for accurate schematic review.
PIN_ASSIGNMENTS = {
    'pH': 'ADC1 GPIO34 (through analog voltage scaling)',
    'Turbidity': 'ADC1 GPIO35 (through analog voltage scaling)',
    'TDS': 'ADC1 GPIO32 (module output must be proven <= ADC tolerance)',
    'Temperature DQ': 'GPIO4 with external 4.7 kΩ pull-up to 3.3V',
    'Relay IN': 'GPIO26 (virtual-only; active polarity and boot state untested)',
    'Independent switch': 'GPIO27 (virtual-only, pull-up and debouncing unverified)',
    'Solenoid +': 'PSU fused +12 V -> relay NO -> valve +',
    'Solenoid return': 'valve - -> PSU return; never from GPIO',
}

if __name__=='__main__':
    import json
    from pathlib import Path
    destination=Path(__file__).with_name('proposed-netlist.json')
    destination.write_text(json.dumps({'status':'illustrative, not validated for assembly',
                                      'pin_assignments':PIN_ASSIGNMENTS,'connections':NETS},indent=2))
    print('Wrote',destination,len(NETS),'named nets')
