"""AquaSentra detailed B-rep concept for SolidCraft/FreeCAD import.
The geometry is visually informed by common modules, not manufacturer dimensional CAD.
The STEP assembly comprises editable imported solids; native parametric sketch history is not included.
"""
from pathlib import Path
import cadquery as cq
import math
from collections import Counter
from visual_netlist import NETS, P
ROOT=Path(__file__).resolve().parent
A=cq.Assembly(name='AquaSentra_Detailed_BRep_Concept')
counts=Counter()
P={
'base':(0.54,0.59,0.64),'acrylic':(.62,.85,.91),'silver':(.73,.76,.78),
'black':(.07,.09,.11),'pcb':(.02,.20,.14),'pcb2':(.03,.14,.20),'blue':(.05,.31,.67),
'white':(.93,.92,.85),'gold':(.77,.57,.25),'brass':(.74,.58,.27),'glass':(.13,.59,.82),
'red':(.89,.18,.15),'green':(.12,.77,.49), 'dark':(.12,.17,.20), 'yellow':(.86,.69,.20)}

def put(group,name,shape,color):
 counts[group]+=1
 A.add(shape,name=f'{group}_{name}_{counts[group]}',color=cq.Color(*P.get(color,P['base'])))
def box(g,n,x,y,z,w,d,h,c):
 put(g,n,cq.Workplane('XY').box(w,d,h,centered=(True,True,True)).translate((x,y,z)).val(),c)
def rod(g,n,a,b,r,c):
 aa,bb=cq.Vector(*a),cq.Vector(*b);dv=bb-aa
 put(g,n,cq.Solid.makeCylinder(r,dv.Length,aa,dv.normalized()),c)
def hexrod(g,n,a,b,r,c):
 aa,bb=cq.Vector(*a),cq.Vector(*b);dv=bb-aa
 # circular approximation with six flat sides for recognizable nut
 if abs(dv.z)>0: s=cq.Workplane('XY').polygon(6,2*r).extrude(dv.Length).translate(tuple(aa.toTuple())).val()
 else: s=cq.Solid.makeCylinder(r,dv.Length,aa,dv.normalized())
 put(g,n,s,c)

box('base','plate',0,0,7,400,235,14,'base')
for x in [-177,177]:
 for y in [-97,97]:box('base','rubber_foot',x,y,-3,23,19,8,'black')
box('acrylic','back_panel',0,106,129,392,6,211,'acrylic')
for x in (-195,195):box('acrylic','side_panel',x,0,117,5,203,213,'acrylic')
# Power housing mechanical sheet, terminals and actual round vent cut-outs
psu=cq.Workplane('XY').box(74,34,94).translate((-147,77,171)).val()
# circular holes in front cage are Boolean-cut to improve shape fidelity
for x in [-176,-166,-156,-146,-136,-126,-117]:
 for z in [139,151,163,175,187,199,209]:
  hole=cq.Solid.makeCylinder(2.5,3.7,cq.Vector(x,58.8,z),cq.Vector(0,1,0))
  psu=psu.cut(hole)
put('power','perforated_case',psu,'silver')
box('power','terminal_strip',-147,53,122,60,12,13,'black')
for x in (-168,-154,-140,-126):rod('power','screw_contact',(x,48,122),(x,42,122),3.1,'gold')
box('power','regulator_board',-147,59,69,63,3,32,'blue')
rod('power','buck_coil',(-150,55,70),(-150,46,70),9,'black')
for x in (-171,-125):rod('power','capacitor',(x,56,72),(x,47,72),4,'silver')
box('power','buck_trimmer',-138,49,80,11,8,9,'blue')
# ESP32 DevKit - PCB, shield, antenna, USB, buttons, 36 terminal pins
box('esp32','devboard',-72,77,166,49,3,88,'pcb2')
box('esp32','rf_can',-72,72,182,33,5,33,'silver')
box('esp32','antenna',-72,72,208,40,1.5,10,'black')
box('esp32','usb_jack',-72,67,120,15,11,7,'silver')
for x in (-94,-50):
 box('esp32','header_plastic',x,73,166,5,5,82,'black')
 for j in range(18):
  z=166+(j-8.5)*4.35
  rod('esp32','pin',(x,72,z),(x,67,z),.75,'gold')
for x in (-84,-60):box('esp32','tactile_switch',x,69,133,8,6,8,'silver')
for x,z in [(-80,149),(-61,152),(-72,150),(-58,143)]:box('esp32','smd_ic',x,73,z,6,4,4,'black')
# pH/Turbidity/TDS boards
for g,z,c in [('ph',207,'pcb'),('turbidity',163,'pcb2'),('tds',119,'pcb2')]:
 box(g,'conditioning_pcb',20,80,z,68,3,35,c)
 box(g,'blue_trimmer',33,71,z-2,14,11,14,'blue')
 rod(g,'trimmer_adjust',(33,64,z-2),(33,62,z-2),2.5,'silver')
 box(g,'signal_ic',8,74,z,12,8,10,'black')
 box(g,'jst_connector',-10,71,z+5,11,13,10,'white')
 for ix in (-7,-1,5):box(g,'smd_resistor',ix,75,z-10,3,2,2,'white')
 for ix in ([-9,49]):
  for zz in (z-13,z+13):rod(g,'mounting_rivet',(ix,79,zz),(ix,74,zz),2,'silver')
rod('ph','bnc_connector',(50,77,205),(66,77,205),6.5,'silver')
rod('ph','bnc_collar',(65,77,205),(69,77,205),8,'silver')
# Status display and indicators
box('display','bezel',123,76,188,115,13,83,'black')
box('display','display_glass',123,68.5,188,103,2.3,69,'glass')
for x in (72,174):
 for z in (151,226):rod('display','fastener',(x,66,z),(x,64,z),3,'silver')
for z in (171,194,217):rod('display','indicator',(183,68,z),(183,63,z),4,'green')
# Relay housing has the physical blue electromagnetic brick, terminals, IC and mounting board
box('relay','pcb',125,82,100,87,3,52,'pcb2')
box('relay','songle_cube',119,68,102,42,20,31,'blue')
box('relay','terminal_blue',160,67,103,20,23,35,'blue')
for z in (90,101,112):rod('relay','terminal_screw',(167,55,z),(167,52,z),3,'silver')
box('relay','optocoupler',90,73,111,10,7,13,'black')
# Transparent chamber modelled with proper wall thickness, not a single solid filled cuboid
shell=cq.Workplane('XY').box(252,77,81).translate((-4,-47,65)).val()
inner=cq.Workplane('XY').box(243,69,72).translate((-4,-47,65)).val()
put('chamber','hollow_acrylic_cell',shell.cut(inner),'acrylic')
box('chamber','removable_lid',-4,-47,110,254,81,6,'acrylic')
for x in (-128,120):
 for y in (-85,-9):rod('chamber','through_bolt',(x,y,26),(x,y,119),2,'silver')
# Distinct probe tips and cable glands
for g,x in [('ph',-99),('turbidity',-40),('tds',19),('temperature',80)]:
 rod(g,'threaded_gland',(x,-47,105),(x,-47,131),12,'black')
 hexrod(g,'locknut',(x,-47,116),(x,-47,125),15,'black')
rod('ph','glass_electrode',(-99,-47,48),(-99,-47,110),6,'glass')
rod('ph','pH_cable_cap',(-99,-47,123),(-99,-47,138),8,'black')
rod('turbidity','sensor_neck',(-40,-47,87),(-40,-47,116),10,'white')
box('turbidity','fork_body',-40,-47,71,23,19,23,'white')
for x in (-48,-32):box('turbidity','optical_fork_arm',x,-47,52,8,18,30,'white')
rod('tds','insulation_body',(19,-47,70),(19,-47,123),7,'black')
for x in (15,23):rod('tds','conductivity_pin',(x,-47,48),(x,-47,79),2,'silver')
rod('temperature','waterproof_steel', (80,-47,52),(80,-47,112),4,'silver')
rod('temperature','heat_shrink',(80,-47,112),(80,-47,139),5,'black')
# Hoses, coupling collars and normally closed solenoid valve (only virtual in this project)
rod('tube','incoming',(-196,-47,65),(-127,-47,65),10,'glass')
rod('tube','outgoing',(120,-47,65),(221,-47,65),10,'glass')
for x in (-133,-124,119,137,197,202):rod('tube','pipe_union',(x,-47,65),(x+5,-47,65),14,'white')
rod('valve','brass_main',(139,-47,65),(197,-47,65),17,'brass')
for x in (141,191):rod('valve','hex_fitting',(x,-47,65),(x+8,-47,65),20,'gold')
rod('valve','valve_stem',(168,-47,73),(168,-47,108),8,'silver')
box('valve','normally_closed_coil',168,-47,108,46,38,48,'black')
box('valve','terminal_cap',168,-47,132,43,38,5,'dark')
rod('valve','internal_plunger',(168,-47,121),(168,-47,143),4,'silver')
# Wiring is generated from the same named netlist as the GLB model.
# CAD traces are segmented tubes at exact terminal endpoints; not electrical validation.
for z,grp in ((203,'ph'),(159,'turb')):
 box('conditioning',grp+'_adc_scaler',-26,52,z,27,3,17,'pcb2')
 for x in (-34,-25,-16):box('conditioning',grp+'_divider_resistor',x,49.8,z-1,5,1.4,2.3,'white')
box('conditioning','ds18b20_pullup',-31,37,180,18,3,29,'pcb2')
box('power','12v_fuse_holder',114,53,76,29,12,14,'black')
box('valve','independent_position_feedback',199,-40,99,14,12,21,'black')
# Colored CAD wires are swept between named route points, not arbitrary decorative lines.
for net in NETS:
 points=net['points']
 if net['domain'] != 'probe' and net['id'] not in ('relay_no_to_valve','valve_to_12v_return',
     'temperature_data','temperature_supply','temperature_ground','temperature_pullup',
     'turb_to_divider','ph_to_divider','fused_12v','psu_to_buck_plus','psu_to_buck_ground'):
  a,b=points[0],points[-1]
  ry={'signal':89,'GND':94,'5V':91,'3V3':94,'feedback':88,'12V':84}.get(net['domain'],89)
  points=[a,(a[0],ry,a[2]),(b[0],ry,a[2]),(b[0],ry,b[2]),b]
 color={'yellow':'yellow','black':'black','red':'red','green':'green','orange':'yellow'}.get(net['color'],'dark')
 for a,b in zip(points,points[1:]):
  if cq.Vector(*a).sub(cq.Vector(*b)).Length>0.001:
   rod('wiring',net['id'],a,b,1.05 if net['domain']!='12V' else 1.65,color)
path=ROOT/'AquaSentra_Detailed_Assembly.step'
A.save(str(path),exportType='STEP')
print('Wrote',path,path.stat().st_size,'bytes; solids',sum(counts.values()), 'component groups',dict(counts))
