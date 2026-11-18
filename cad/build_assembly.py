"""AquaSentra reference *conceptual* mechanical CAD assembly.

Source dimensions are in millimetres. Run with cadquery and trimesh installed:
    python cad/build_assembly.py
Exports STEP for SolidCraft (B-rep imported solids) and GLB for React Three Fiber.
NOT a manufacturing, waterproofing, electrical, or certified fluid-path drawing.
"""
from __future__ import annotations
from pathlib import Path
import json, math, re
import numpy as np
import cadquery as cq
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parent
WEB = ROOT.parent/'frontend'/'public'/'models'
WEB.mkdir(parents=True, exist_ok=True)
COMPONENTS=[]
COLORS={
 'base':(0.35,0.42,0.49,1), 'frame':(0.67,0.82,0.9,0.25),
 'esp32':(0.07,0.16,0.22,1), 'power':(0.64,0.68,0.73,1),
 'ph':(0.12,0.55,0.66,1), 'turbidity':(0.14,0.56,0.75,1),
 'tds':(0.36,0.43,0.75,1), 'temperature':(0.77,0.66,0.33,1),
 'display':(0.05,0.13,0.23,1), 'relay':(0.1,0.34,0.72,1),
 'valve':(0.79,0.57,0.21,1), 'tube':(0.27,0.72,0.94,0.38),
 'chamber':(0.53,0.87,0.98,0.22), 'water':(0.18,0.67,0.84,0.3),
 'wire':(0.15,0.25,0.30,1), 'led':(0.12,0.91,0.64,1),
}

def box(w,d,h,x,y,z):
 return cq.Workplane('XY').box(w,d,h,centered=True).translate((x,y,z)).val()

def cyl(r,h,x,y,z):
 return cq.Workplane('XY').circle(r).extrude(h).translate((x,y,z)).val()

def cyl_x(r,length,x,y,z):
 # face at x, cylinder axis towards +x
 return cq.Workplane('YZ').circle(r).extrude(length).translate((x,y,z)).val()

def part(group,name,shape,color=None,info=None):
 COMPONENTS.append({'group':group,'name':f'{group}:{name}', 'shape':shape,'rgba':color or COLORS.get(group,(0.5,0.6,0.7,1)),'info':info})

# Fixture: 400 x 240 x 12 mm footprint, 230 mm tall. All indicative.
part('base','main-plate', box(400,240,12,0,0,6))
part('base','front-rail', box(386,6,18,0,-117,18))
part('frame','back-acrylic', box(385,7,210,0,106,122))
for x in [-182,182]:
 part('frame',f'side-guard-{x}',box(6,196,190,x,9,109))
for x in [-171,171]:
 for y in [-96,97]:
  part('base',f'mount-{x}-{y}',cyl(7,7,x,y,12))

# Power module (real power switching + protective barriers NOT modeled).
part('power','dc-supply',box(74,22,98,-145,85,171))
part('power','supply-vent',box(56,1,72,-145,72.7,170),(0.22,0.27,0.32,1))
part('power','dc-buck',box(61,16,23,-145,83,67),(0.13,0.33,0.61,1))

# ESP32 stack: board, metal radio shield and visible mount details.
part('esp32','controller-board',box(49,6,90,-69,83,167))
part('esp32','rf-shield',box(32,2,31,-69,78,179),(0.64,0.72,0.76,1))
part('esp32','usb-connector',box(12,9,8,-69,77,119),(0.74,0.76,0.79,1))
for z in [132,145,158,171,184,197]:
 for x in [-91,-47]:part('esp32',f'gpio-{x}-{z}',box(2,4,4,x,77,z),(0.81,0.64,0.28,1))

# Three conditioning boards, one per analog probe.
for grp,z,label in [('ph',207,'pH'),('turbidity',161,'turbidity'),('tds',115,'TDS')]:
 part(grp,'signal-module',box(67,7,35,19,83,z), (0.065,0.20,0.29,1))
 part(grp,'calibration-pot',box(17,6,17,39,77,z),(0.14,0.52,0.90,1))
 part('led',f'{grp}-light',cyl(3,4,-5,75,z), (0.09,0.95,0.60,1))
 part(grp,'connector',box(15,9,12,-12,76,z+8),(0.9,0.89,0.81,1))

# OLED case, display and status LED signals.
part('display','display-case',box(114,15,80,125,83,190))
part('display','screen',box(102,2,65,125,74,190),(0.025,0.09,0.16,1))
for z,clr,nam in [(220,(0.09,0.94,0.60,1),'power'),(197,(0.12,0.69,1,1),'wifi'),(174,(1,0.74,0.15,1),'valve')]:
 part('led',f'status-{nam}',cyl(5,3,184,75,z),clr)
part('relay','module-board',box(91,7,52,128,84,103),(0.08,0.23,0.48,1))
part('relay','switch-block',box(39,15,29,126,72,105),(0.06,0.25,0.63,1))
part('relay','screw-terminal',box(18,14,28,166,70,102),(0.13,0.42,0.71,1))

# Sensor chamber (transparent acrylic housing): 250 x 76 x 80, location as built below.
# Deliberately simplified enclosure with visual water volume only.
part('chamber','outer-chamber',box(252,77,81,-4,-46,65))
part('water','water-volume',box(238,64,49,-4,-46,58))
part('chamber','top-cover',box(256,80,8,-4,-46,110))
for x in [-112,104]:
 for y in [-80,-12]:part('base',f'flow-mount-{x}-{y}',box(15,15,14,x,y,22))

# Sensor ports and shafts, tubes enter vertical from chamber top.
for grp,x,clr,r in [('ph',-99,(0.15,0.62,0.91,1),6),('turbidity',-40,(0.27,0.42,0.49,1),11),('tds',19,(0.84,0.82,0.62,1),6),('temperature',80,(0.73,0.77,0.79,1),4)]:
 part(grp,'probe-body',cyl(r,71,x,-46,48),clr)
 part(grp,'bulkhead-nut',cyl(r+7,12,x,-46,114),(0.13,0.18,0.23,1))
 part('wire',f'{grp}-lead',cyl(2.8,25,x,-46,126),(0.12,0.20,0.26,1))

# Inline plumbing and fail-closed valve, right of chamber.
part('tube','inlet',cyl_x(9,64,-194,-46,60))
part('tube','outlet',cyl_x(9,94,122,-46,60))
part('valve','brass-inline-body',cyl_x(17,53,139,-46,60))
part('valve','coil',box(43,43,53,169,-46,93),(0.13,0.16,0.21,1))
part('valve','coil-cap',box(39,39,4,169,-46,122),(0.08,0.12,0.17,1))
part('valve','plunger-visual',cyl(6,19,169,-46,116),(0.73,0.75,0.77,1))
for x in [-132,-126,122,137,195,202]:
 part('tube',f'pipe-collar-{x}',cyl_x(13,6,x,-46,60),(0.90,0.94,0.94,1))
# Cable routes, diagrammatic power/control leads (not validated electrical schematics).
part('wire','power-bus',box(250,3,3,-30,70,43),(0.75,0.19,0.19,1))
part('wire','data-bus',box(190,3,3,-28,68,49),(0.14,0.73,0.52,1))
part('wire','valve-lead',box(4,4,42,169,60,136),(0.80,0.28,0.20,1))

# Export solids without native SolidCraft feature history: SolidCraft opens imported STEP as B-rep.
assembly=cq.Assembly(name='AquaSentra_Concept_3D')
for i,p in enumerate(COMPONENTS):
 try:
  assembly.add(p['shape'], name=re.sub('[^a-zA-Z0-9_]+','_',p['name'])+f'_{i}',color=cq.Color(*p['rgba']))
 except Exception as e:print('Assembly add warning',p['name'],e)
step_path=ROOT/'AquaSentra_Concept_Assembly.step'
assembly.save(str(step_path),exportType='STEP')

# Matching per-component glTF objects, converted from CAD mm Z-up to glTF metre-ish Y-up.
scene=trimesh.Scene()
for i,p in enumerate(COMPONENTS):
 try:
  points,faces=p['shape'].tessellate(0.95,0.35)
  verts=np.array([[v.x*0.019,v.z*0.019,-v.y*0.019] for v in points],dtype=float)
  mesh=trimesh.Trimesh(vertices=verts,faces=np.asarray(faces,dtype=int),process=False)
  if len(mesh.faces)<1:continue
  rgb=p['rgba']; color=[int(max(0,min(1,v))*255) for v in rgb]
  material=PBRMaterial(name=p['name'],baseColorFactor=color,metallicFactor=0.62 if p['group'] in ('base','power','valve') else .12,roughnessFactor=.44,alphaMode='BLEND' if rgb[3]<.9 else 'OPAQUE', doubleSided=True)
  mesh.visual=trimesh.visual.TextureVisuals(material=material)
  scene.add_geometry(mesh, node_name=p['name'],geom_name=p['name'])
 except Exception as e:print('mesh warning',p['name'],repr(e))
model_path=WEB/'aquasentra-device.glb'
model_path.write_bytes(scene.export(file_type='glb'))
meta=[{'group':p['group'],'name':p['name'],'rgba':p['rgba']} for p in COMPONENTS]
(ROOT/'assembly-parts.json').write_text(json.dumps(meta,indent=2))
print('Wrote STEP:',step_path,step_path.stat().st_size)
print('Wrote GLB:',model_path,model_path.stat().st_size)
print('Parts:',len(COMPONENTS))
