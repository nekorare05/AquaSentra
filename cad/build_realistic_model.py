"""AquaSentra visual digital-twin mesh generator.

Creates a detailed, editable GLB with distinct meshes for recognizable components.
These are visual reconstructions of common electronic modules, NOT manufacturer CAD,
certified electronics, waterproofing design, or a manufacturable assembly.

Use: python cad/build_realistic_model.py
Requires: trimesh numpy pillow scipy
"""
from __future__ import annotations
import math, json, random
from pathlib import Path
from collections import defaultdict
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
from trimesh.visual.material import PBRMaterial
from visual_netlist import NETS, P, PIN_ASSIGNMENTS

ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT.parent/'frontend/public/models/aquasentra-device.glb'
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
S=.019  # original 400-mm design fits previous dashboard camera and selection anchor positions
random.seed(481)
COL={
'black':'#0b1521','dark':'#19232c','pcb':'#093826','pcb2':'#112f38','pcb3':'#112b28','copper':'#dcaa53',
'silver':'#b9c6cd','aluminum':'#929fa9','white':'#ebf2f1','cream':'#ddd7bf','text':'#e2faf4',
'blue':'#1766bb','relay':'#155dc0','cyan':'#0fd9d1','green':'#18d481','red':'#ec4940',
'orange':'#f2a039','glass':'#52bde7','rubber':'#111923','brass':'#c8a04e','gold':'#cb9f3e',
'yellow':'#e6b946', 'chip':'#12171a'}

def rgba(v, opacity=1):
 if isinstance(v,tuple): return tuple(int(c) for c in v)
 h=COL.get(v,v).lstrip('#');return tuple(int(h[i:i+2],16) for i in (0,2,4))+(int(opacity*255),)

def wp(x,y,z):return np.array([x*S,z*S,-y*S],dtype=float)

# Key is (DIL/React component, type/material), each key becomes a pickable GLB mesh.
buckets=defaultdict(list)
meta=[]

def add(tag,mesh,color='silver',opacity=1,metal=0.05,rough=.48):
 key=(tag,color,opacity,metal,rough)
 buckets[key].append(mesh)

def box(tag,xyz,whd,color='silver',alpha=1,metal=.08,rough=.49):
 x,y,z=xyz;w,d,h=whd
 m=trimesh.creation.box(extents=[w*S,h*S,d*S]);m.apply_translation(wp(x,y,z));add(tag,m,color,alpha,metal,rough)

def rod(tag, a,b,r,color='silver',n=12,opacity=1,metal=.1,rough=.45):
 a,b=wp(*a),wp(*b);vec=b-a;length=np.linalg.norm(vec)
 if length<1e-6:return
 m=trimesh.creation.cylinder(radius=r*S,height=length,sections=n)
 trans=trimesh.geometry.align_vectors([0,0,1],vec/length)
 m.apply_transform(trans);m.apply_translation((a+b)/2);add(tag,m,color,opacity,metal,rough)

def sphere(tag,xyz,r,color='silver',opacity=1):
 m=trimesh.creation.icosphere(subdivisions=2,radius=r*S);m.apply_translation(wp(*xyz));add(tag,m,color,opacity)

def ring(tag,xyz,outer,inner,depth,color='silver',orientation='z',metal=.1):
 # CSG-free annulus with smooth cylindrical sides
 from trimesh.creation import annulus
 m=annulus(r_min=inner*S,r_max=outer*S,height=depth*S,sections=28)
 if orientation=='z':m.apply_transform(trimesh.geometry.align_vectors([0,0,1],[0,1,0]))
 elif orientation=='y':m.apply_transform(trimesh.geometry.align_vectors([0,0,1],[0,0,-1]))
 elif orientation=='x':m.apply_transform(trimesh.geometry.align_vectors([0,0,1],[1,0,0]))
 m.apply_translation(wp(*xyz));add(tag,m,color,1,metal,.42)

def bezier_wire(tag, points,r,color='black',segments=18):
 # Piecewise Catmull-Rom, smooth real-looking cable rather than straight square prisms.
 P=np.asarray(points,dtype=float); pts=[]
 for i in range(len(P)-1):
  p0=P[max(0,i-1)];p1=P[i];p2=P[i+1];p3=P[min(len(P)-1,i+2)]
  for j in range(segments//(len(P)-1)+1):
   t=j/(segments//(len(P)-1)+1);t2=t*t;t3=t2*t
   q=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3)
   pts.append(q)
 pts.append(P[-1])
 for a,b in zip(pts,pts[1:]):rod(tag,a,b,r,color,n=7,rough=.7)

def hex_bolt(tag,x,y,z,r=3):
 # visible front screw heads and a dark slot
 rod(tag,(x,y,z),(x,y-1.8,z),r,'silver',n=6,metal=.75)
 box(tag+':slot',(x,y-2.0,z),(r*1.5,.5,.7),'dark')

def font(size,bold=False):
 opts=('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
       '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf')
 for p in opts:
  if Path(p).exists():return ImageFont.truetype(p,size)
 return ImageFont.load_default()

def texture(kind,title,subtitle='',size=(660,360),bg='#0a3027',accent='#29dfba',extras=True):
 im=Image.new('RGBA',size,bg);d=ImageDraw.Draw(im)
 w,h=size
 # gently patterned PCB traces around components
 if kind in ('pcb','esp32','sensor','relay'):
  rng=random.Random(len(title)*177)
  for _ in range(85):
   x=rng.randrange(15,w-15);y=rng.randrange(15,h-15)
   x2=x+rng.randrange(-70,70);y2=y+rng.choice([-1,0,1])*rng.randrange(4,35)
   d.line([(x,y),(x2,y2)],fill=('#215b50' if bg!='#06251d' else '#2c6649'),width=2)
  for x in range(12,w,35):
   for y in (12,h-12):d.ellipse((x-3,y-3,x+3,y+3),fill='#a8ba9b')
 if kind=='display':
  d.rounded_rectangle((12,12,w-12,h-12),radius=15,outline='#28798a',width=4)
  d.text((30,20),'◉  AquaSentra  /  DIGITAL TWIN',font=font(30,True),fill='#30e7ce')
  d.line((30,72,w-30,72),fill='#2f7f83',width=3)
  rows=['pH       —','Turb.    — NTU','TDS      — mg/L','Temp.   — °C']
  for i,line in enumerate(rows):d.text((45,92+i*57),line,font=font(38,True),fill='#d8fafa')
  d.text((30,h-28),'SIMULATED • live figures on dashboard',font=font(16),fill='#69b5bd')
 elif kind=='power':
  d.rounded_rectangle((12,12,w-12,h-12),radius=10,fill='#edbb37')
  d.text((30,30),'HIGH VOLTAGE',font=font(40,True),fill='#172333')
  d.text((30,100),'12 V DC SUPPLY',font=font(33,True),fill='#172333')
  d.text((30,160),'CONCEPT ONLY',font=font(26),fill='#172333')
 else:
  d.text((22,25),title,font=font(48 if len(title)<16 else 37,True),fill='#ecf8f5')
  d.text((23,105),subtitle,font=font(26),fill=accent)
  if extras:
   d.text((20,h-47),'GND  VCC  AO   /   PROTOTYPE',font=font(22),fill='#b1c3b9')
 return im

def front_texture(name,xyz,wh,image):
 # Visible front panel facing +Z of WebGL (-Y in original mechanics)
 x,y,z=xyz;w,h=wh
 vertices=np.array([wp(x-w/2,y,z-h/2),wp(x+w/2,y,z-h/2),wp(x+w/2,y,z+h/2),wp(x-w/2,y,z+h/2)])
 m=trimesh.Trimesh(vertices=vertices, faces=[[0,1,2],[0,2,3]], process=False)
 material=PBRMaterial(name=name,baseColorTexture=image,baseColorFactor=[255,255,255,255],metallicFactor=0,roughnessFactor=.72,doubleSided=False)
 # Trimesh glTF exporter raster V orientation compensation (vertical flip only).
 # Keeps lettering upright and left-to-right when viewed from the front.
 m.visual=trimesh.visual.TextureVisuals(uv=np.array([[0,0],[1,0],[1,1],[0,1]]),material=material)
 meta.append((name,m))

def pin_header(prefix,xc,yc,z_center,count,pitch=3.1):
 box(prefix+':black-pin-header',(xc,yc,z_center),(5,5,(count-1)*pitch+6),'black')
 for i in range(count):
  z=z_center+(i-(count-1)/2)*pitch
  rod(prefix+':gold-pins',(xc,yc-3.8,z),(xc,yc-7,z),.7,'gold',n=6,metal=.72)

# Base, rubber feet, acrylic panels, mounting screws. Unit scale retained from previous scene.
box('base:aluminum-base',(0,0,7),(400,235,13),'aluminum',metal=.8)
box('base:front-lip',(0,-115,18),(382,8,18),'aluminum',metal=.68)
for x in (-176,176):
 for y in (-93,93):
  box('base:rubber-foot',(x,y,-3),(22,22,8),'rubber')
  rod('base:feet-bolts',(x,y,1),(x,y,8),3,'silver',n=10)
# Transparent acrylic guards
box('frame:clear-back',(0,106,129),(392,6,211),'glass',alpha=.12)
for x in (-195,195):box('frame:acrylic-side',(x,7,117),(5,203,213),'glass',alpha=.10)
for x in (-180,180):
 for z in (45,217):hex_bolt('frame:screw',x,100,z,3)
# Branded stainless plaque
box('base:nameplate',(0,-121.5,20),(135,2,27),'dark',metal=.32)
front_texture('base:brand',(0,-122.8,20),(127,22),texture('label','AquaSentra','IoT  •  WATER QUALITY  •  DEMO',size=(900,200),bg='#132d3a',accent='#36e3ce',extras=False))

# 12V supply: perforated silver metal cage with dozens of actual recessed-looking holes.
box('power:perforated-housing',(-147,77,171),(74,34,94),'aluminum',metal=.73)
box('power:front-grille',(-147,59.4,174),(66,1.5,78),'silver',metal=.8)
for cx in np.arange(-175,-118,10):
 for cz in np.arange(138,210,10):
  # dark well underneath each punched ventilation opening and shallow silver rim
  rod('power:vent-dark',(cx,58.3,cz),(cx,57.4,cz),2.9,'black',n=12)
  ring('power:vent-rim',(cx,57.9,cz),3.25,2.65,.4,'aluminum','y',metal=.7)
box('power:terminal-cover',(-147,55,122),(62,12,13),'dark')
for dx,co in zip((-23,-8,8,23),('gold','gold','silver','silver')):
 rod('power:supply-terminal',(-147+dx,48,122),(-147+dx,40,122),3,co,8,metal=.6)
front_texture('power:safety-label',(-147,56.2,199),(55,13),texture('power','12 V','',size=(490,130)))
# DC converter blue PCB, coil, capacitors, trim screw and terminals.
box('power:regulator-pcb',(-147,59,69),(63,3,32),'blue')
rod('power:buck-inductor',(-151,56,70),(-151,48,70),9,'dark',n=24)
rod('power:capacitor-a',(-170,56,71),(-170,46,71),5,'aluminum',n=16,metal=.4)
rod('power:capacitor-b',(-127,56,71),(-127,46,71),5,'aluminum',n=16,metal=.4)
box('power:trimpot',(-135,52,82),(11,9,10),'blue')
rod('power:trimmer-screw',(-135,46,82),(-135,45,82),2.2,'silver')
front_texture('power:buck-print',(-152,56.9,54),(46,10),texture('label','5 V REG','12 V → 5 V',size=(570,130),bg='#07376d',extras=False))
# Electrical routes are assembled from an auditable netlist below, not random arcs.

# ESP32 DevKit recognizable PCB board, RF shield/antenna, USB, dual button and GPIOs
box('esp32:pcb',(-72,77,166),(49,3,88),'pcb2')
# copper side rails with headers
for x in (-94,-50):pin_header('esp32',x,73,166,19,pitch=4.35)
box('esp32:rf-shield',(-72,73,182),(33,3.5,33),'silver',metal=.72)
front_texture('esp32:rf-mark',(-72,70.9,182),(30,30),texture('label','ESP32','WROOM-32',size=(460,470),bg='#aabcc6',accent='#102b34',extras=False))
# Antenna PCB top with copper zigzag
box('esp32:antenna-substrate',(-72,72.2,207),(40,1,10),'black')
for j in range(7):
 x=-88+j*5
 rod('esp32:antenna-trace',(x,71.2,203),(x+(2 if j%2 else -2),71.2,211),.6,'copper',n=5,metal=.5)
# USB C or microUSB bottom
box('esp32:usb-connector',(-72,67.5,120),(15,10,7),'silver',metal=.8)
box('esp32:usb-port',(-72,61.9,120),(10,.5,3),'black')
for x in (-84,-60):
 box('esp32:pushbutton',(x,70.5,133),(8,5,8),'silver',metal=.65)
 box('esp32:button-cap',(x,67.8,133),(3,1.2,3),'dark')
for x,z in [(-82,154),(-68,150),(-57,153),(-58,143),(-81,141)]:
 box('esp32:small-ic',(x,72, z),(5,2.7,4.5),'chip')
for i in range(10):
 box('esp32:resistors',(-90+(i%5)*9,71.2,156+(i//5)*4),(2.4,.8,1.4),'cream')
sphere('led:status-wifi',(-93,69.5,141),1.7,'green')
front_texture('esp32:pcb-legend',(-72,74.9,214),(37,5),texture('label','DEVKIT','ESPRESSIF',size=(680,115),bg='#10313b',extras=False))

# A realistic board of sensor circuits, BNC connector, tactile plastic and pin headers.
def analog_board(grp,x,z,board_color,title,model,ph=False):
 box(f'{grp}:pcb',(x,80,z),(68,2.8,35),board_color)
 front_texture(f'{grp}:silkscreen',(x,78.5,z),(64,31),texture('sensor',title,model, size=(880,415),bg=('#0a3929' if grp=='ph' else '#102a35'),accent='#30cda9'))
 for xx,zz in ((x-29,z-12),(x+29,z-12),(x-29,z+12),(x+29,z+12)):
  rod(f'{grp}:pcb-hole',(xx,78.2,zz),(xx,77.7,zz),1.8,'copper',n=10)
 # blue trimmer pot with a physical silver screw
 box(f'{grp}:trimmer',(x+13,72,z-2),(14,11,14),'blue')
 rod(f'{grp}:trimmer-screw',(x+13,65.2,z-2),(x+13,63.9,z-2),3,'silver',n=10,metal=.8)
 box(f'{grp}:chip',(x-12,74,z+1),(11,6,9),'black')
 for i in range(4):
  box(f'{grp}:resistor',(x-19+i*7,75,z-10),(3,2,2),'cream')
 box(f'{grp}:jst-housing',(x-30,71,z+5),(10,13,10),'white')
 for i,c in enumerate(['red','black','yellow']):
  rod('wire:jst-pins',(x-32+i*3.1,64,z+5),(x-32+i*3.1,61,z+5),.9,c,6)
 sphere(f'led:{grp}-light',(x+29,74,z+8),1.7,'green')
 if ph:
  # True axial BNC-style metal connector on right of pH module
  rod('ph:bnc-socket',(x+30,77,z-2),(x+45,77,z-2),6.7,'silver',20,metal=.85)
  ring('ph:bnc-collar',(x+43,77,z-2),7.8,5,5,'silver','x',metal=.75)
  rod('ph:bnc-tip',(x+43,77,z-2),(x+48,77,z-2),3.4,'black',12)
analog_board('ph',20,207,'pcb','PH-4502C','pH SIGNAL',ph=True)
analog_board('turbidity',20,163,'pcb2','DFROBOT','SEN0189')
analog_board('tds',20,119,'pcb3','TDS Meter','V1.0')
# Separate ADC voltage-scaling boards for the 5 V analog interface modules.
for z,mod in [(203,'ph'),(159,'turb')]:
 box(f'conditioning:{mod}-divider-pcb',(-26,52,z),(27,3,17),'pcb2')
 for x in (-34,-25,-16):
  box(f'conditioning:{mod}-resistor',(x,49.8,z-1),(5,1.4,2.3),'cream')
 for key in (f'{mod}_div_in',f'{mod}_div_out',f'{mod}_div_gnd'):
  sphere(f'conditioning:{mod}-pad',P[key],1.6,'gold')
 front_texture(f'conditioning:{mod}-label',(-26,49.8,z+5),(24,5),texture('label','ADC','SCALE',size=(320,110),bg='#163a47',extras=False))
# DS18B20 optional 4.7k pull-up resistor carrier (concept, not PCB).
box('conditioning:ds18b20-pullup-board',(-31,37,180),(18,3,29),'pcb2')
box('conditioning:ds18b20-4k7-resistor',(-30,34,180),(4,3,13),'cream')

# TFT status: black injection moulded bezel, rivets, antiglare face; dynamic actual readings injected in React.
box('display:frame',(123,76,188),(115,13,83),'dark')
box('display:screen-glass',(123,68.5,188),(103,2.3,69),'black',rough=.08)
front_texture('display:static-bezel',(123,66.9,188),(101,67),texture('display','AquaSentra','',size=(820,545)))
for x in (72,174):
 for z in (151,226):hex_bolt('display:case-fastener',x,65,z,2.7)
for k,(z,c) in enumerate([(217,'green'),(194,'blue'),(171,'orange')]):
 rod('display:indicator-bezel',(183,68,z),(183,64,z),5,'silver',16,metal=.7)
 sphere(f'led:display-{k}',(183,62,z),3.6,c)
# Relay module has a recognizable Songle switching brick, board terminals and optocoupler.
box('relay:pcb',(125,82,100),(87,3,52),'pcb2')
front_texture('relay:board-legend',(125,79.9,101),(82,45),texture('relay','RELAY','SRD-05VDC-SL-C',size=(750,420),bg='#102c39'))
box('relay:songle-blue',(119,68,102),(42,20,31),'relay')
front_texture('relay:songle-label',(119,57.6,102),(36,24),texture('label','SONGLE','SRD-05VDC-SL-C',size=(700,420),bg='#1257b5',accent='#dcefff',extras=False))
box('relay:terminal-strip',(160,67,103),(20,23,35),'blue')
for z in (90,101,112):
 rod('relay:terminal-well',(167,54.7,z),(167,53.8,z),3,'silver',16,metal=.8)
 rod('relay:terminal-screw',(167,53,z),(167,52,z),1.9,'dark',8)
box('relay:optocoupler',(90,72,111),(10,7,13),'chip')
rod('relay:capacitor',(91,71,93),(91,62,93),4,'aluminum',12)
sphere('relay:indicator',(93,71,119),2.1,'red')

# Flow chamber with clear bolt-together walls and distinct interior water, not one solid opaque box.
box('chamber:water-cell',(-4,-47,65),(248,76,81),'glass',alpha=.105)
box('chamber:top-plate',(-4,-47,110),(254,81,6),'silver',alpha=.52)
for x in (-128,120):
 for y in (-85,-9):
  rod('chamber:through-bolt',(x,y,26),(x,y,113),2.2,'silver',n=10,metal=.76)
  rod('chamber:bolt-head',(x,y,113),(x,y,117),5,'silver',n=6,metal=.74)
box('water:volume',(-4,-47,61),(238,66,56),'glass',alpha=.21)
for x in (-105,98):
 for y in (-88,-7):box('base:flow-bracket',(x,y,24),(22,20,24),'dark')
for i in range(18):
 x=random.uniform(-113,105);y=random.uniform(-74,-18);z=random.uniform(42,88)
 sphere('water:bubbles',(x,y,z),random.uniform(.6,1.4),'white',opacity=.28)

# Four measurement probes: accurate silhouettes, body materials and different tips.
probe_positions={'ph':-99,'turbidity':-40,'tds':19,'temperature':80}
for grp,x in probe_positions.items():
 rod(f'{grp}:bulkhead-thread',(x,-47,105),(x,-47,129),12,'black',n=24)
 ring(f'{grp}:seal-washer',(x,-47,110),16,12,6,'dark',metal=.28)
 rod(f'{grp}:hex-gland',(x,-47,118),(x,-47,128),16,'black',n=6)
# pH E201 glass electrode with blue body, protective bulb and metal BNC top
rod('ph:blue-glass-electrode',(-99,-47,48),(-99,-47,110),5.8,'glass',24,opacity=.72)
sphere('ph:glass-bulb',(-99,-47,46),5.9,'glass',opacity=.70)
rod('ph:probe-cap',(-99,-47,123),(-99,-47,139),8,'dark',16)
ring('ph:collar',(-99,-47,137),8.2,4.4,4,'silver','z',metal=.8)
# SEN0189: two optical tines around a visible central slot
rod('turbidity:neck',(-40,-47,88),(-40,-47,116),10,'cream',20)
box('turbidity:optical-fork-housing',(-40,-47,70),(24,19,28),'cream')
for dx in (-8,8):
 box('turbidity:optical-fork-tine',(-40+dx,-47,50),(9,18,28),'white')
 rod('turbidity:optical-eye',(-40+dx,-57,55),(-40+dx,-59,55),4,'dark',16)
# TDS black two-electrode fork stylized from common conductivity probe.
rod('tds:probe-plastic-body',(19,-47,100),(19,-47,125),9,'dark',16)
rod('tds:probe-neck',(19,-47,67),(19,-47,102),6,'black',16)
for dx in (-4,4):
 rod('tds:electrode',(19+dx,-47,50),(19+dx,-47,77),1.8,'silver',12,metal=.85)
 ring('tds:electrode-rim',(19+dx,-47,74),2.7,1.9,4,'silver','z',metal=.8)
# Temperature stainless DS18B20
rod('temperature:steel-probe',(80,-47,52),(80,-47,111),4,'silver',24,metal=.88)
rod('temperature:heat-shrink',(80,-47,111),(80,-47,139),5,'black',18)

# Inlet and outlet tubes with inner water tint + metallic ferrules
for start,end in [(-196,-127),(120,221)]:
 rod('tube:blue-tubing',(start,-47,65),(end,-47,65),10,'glass',20,opacity=.43)
 rod('tube:inner-water',(start,-47,65),(end,-47,65),6.8,'glass',16,opacity=.32)
for x in (-133,-124,119,137,197,202):
 ring('tube:union-fittings',(x,-47,65),15,10,8,'white','x')
 ring('tube:steel-clamp',(x,-47,65),16,13,3,'silver','x',metal=.8)

# NC brass valve body with flanges, polygonal union nuts, black coil, stem and gland
rod('valve:brass-inline-body',(139,-47,65),(197,-47,65),17,'brass',20,metal=.68)
for x in (141,191):
 rod('valve:hex-union',(x,-47,65),(x+8,-47,65),20,'gold',n=6,metal=.6)
ring('valve:inlet-thread',(139,-47,65),15,11,8,'silver','x',metal=.8)
ring('valve:outlet-thread',(194,-47,65),15,11,8,'silver','x',metal=.8)
rod('valve:stem',(168,-47,73),(168,-47,109),8,'silver',n=20,metal=.7)
box('valve:coil',(168,-47,108),(46,38,48),'black')
box('valve:coil-rib',(168,-47,128),(43,38,5),'dark')
front_texture('valve:rating-plate',(168,-67,113),(38,24),texture('label','NC VALVE','12 V DC',size=(600,360),bg='#17212d',accent='#f0bb57',extras=False))
# exact mesh id is used by the existing React animation; actual plunger is hidden inside coil
rod('valve:plunger-visual',(168,-47,120),(168,-47,142),4,'silver',n=16,metal=.8)
for x in (154,181):
 rod('valve:coil-screw',(x,-66,111),(x,-68,111),2.7,'silver',n=6,metal=.8)
# Independent position/flow feedback sensor represented by a separate switch.
# This sensor is only an illustrative future-hardware interface, and is NOT
# considered physical verification in the current web/backend prototype.
box('valve:independent-position-switch',(199,-40,99),(14,12,21),'dark')
rod('valve:position-switch-lever',(202,-46,105),(195,-50,112),1.6,'silver',n=10)
for pin_name in ('position_signal','position_gnd'):
 sphere(f'valve:feedback-terminal-{pin_name}',P[pin_name],2.1,'gold')
# 12 V fuse, physically separate from low-voltage MCU wiring.
box('power:inline-12v-fuse',(114,53,76),(29,12,14),'dark')
rod('power:fuse-glass',(106,48,76),(122,48,76),3,'glass',n=14,opacity=.7)
for key in ('fuse_in','fuse_out'):
 sphere('power:fuse-terminal',P[key],1.9,'gold')
# Signal and power terminal pads: every cable endpoint in the netlist
# corresponds to these named physical pad markers.
for name,position in P.items():
 if name.startswith('esp_'):color='gold'
 elif 'ground' in name or 'gnd' in name or 'minus' in name:color='silver'
 else:color='gold'
 sphere(f'terminal:{name}',position,1.2,color)
# Named, selectable wiring from explicit netlist. Domain is encoded in mesh ID.
for n in NETS:
 # Draw signal and power paths through the rear cable trough (behind circuit
 # boards) so the real connection layout is visible without spaghetti wires.
 # Sensor head cables and the isolated valve contact loop retain cable arcs.
 points = n['points']
 if n['domain'] not in ('probe',) and n['id'] not in ('relay_no_to_valve','valve_to_12v_return',
     'temperature_data','temperature_supply','temperature_ground','temperature_pullup',
     'turb_to_divider','ph_to_divider','fused_12v','psu_to_buck_plus','psu_to_buck_ground'):
  a,b=points[0],points[-1]
  rear_y = {'signal':89,'GND':94,'5V':91,'3V3':94,'feedback':88,'12V':84}.get(n['domain'],89)
  # Separate high and low supply bundles, and avoid arbitrary free-floating ends.
  points=[a,(a[0],rear_y,a[2]),(b[0],rear_y,a[2]),(b[0],rear_y,b[2]),b]
 radius=1.65 if n['domain']=='12V' else 1.15 if n['domain'] in ('5V','3V3','GND') else 1.05
 if n['domain']=='probe':radius=1.9
 bezier_wire('wire:'+n['id'],points,radius,n['color'],segments=20)

# Cable clips and fixed conduit ties
for x in (-135,-70,7,62,126):
 box('wire:clip',(x,60,52),(7,5,8),'dark')

# Merge per material + role to keep the interactive model responsive on older laptops.
scene=trimesh.Scene()
for (tag,col,opacity,metal,rough),meshes in buckets.items():
 if not meshes:continue
 mesh=trimesh.util.concatenate(meshes)
 color=rgba(col,opacity)
 mat=PBRMaterial(name=f'material-{tag}',baseColorFactor=list(color),metallicFactor=float(metal),roughnessFactor=float(rough),alphaMode='BLEND' if opacity<.95 else 'OPAQUE',doubleSided=True)
 mesh.visual=trimesh.visual.TextureVisuals(material=mat)
 # different material variants for a given named group need unique node suffix
 basename=tag; unique=basename;idx=1
 while unique in scene.graph.nodes:unique=f'{basename}-{idx}';idx+=1
 scene.add_geometry(mesh,geom_name=unique,node_name=unique)
for name,mesh in meta:
 scene.add_geometry(mesh,geom_name=name,node_name=name)
OUTPUT.write_bytes(scene.export(file_type='glb'))
contents={'version':'3.0-orientation-and-netlist-fix','format':'GLB','units':'visual scene uses same scale as dashboard',
 'total_mesh_nodes':len(scene.graph.nodes_geometry),'components': ['ESP32-WROOM32 DevKit','PH-4502C conditioning module','E201 pH electrode','SEN0189 turbidity module and fork probe','TDS Meter V1.0 and two-electrode probe','DS18B20 stainless probe','Songle 5V relay','12V normally-closed solenoid valve','perforated switching supply','5V buck regulator','TFT-style display','acrylic water chamber'],
 'netlist':'cad/proposed-netlist.json','connections':len(NETS),
 'warning':'Proposed, untested visual wiring mapped to selected board variants; verify voltage scaling, power protection, orientation and GPIO pin positions on actual purchased hardware.'}
(ROOT/'realistic-model-manifest.json').write_text(json.dumps(contents,indent=2))
print('OUTPUT',OUTPUT,OUTPUT.stat().st_size,'bytes','meshes',len(scene.graph.nodes_geometry),'bounds',scene.bounds)
