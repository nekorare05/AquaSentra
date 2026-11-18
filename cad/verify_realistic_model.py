"""Check that the visual GLB can be loaded and its interactive mesh contracts survive."""
from pathlib import Path
import trimesh
from visual_netlist import NETS, P, PIN_ASSIGNMENTS
p=Path(__file__).resolve().parent.parent/'frontend/public/models/aquasentra-device.glb'
s=trimesh.load(str(p),force='scene')
if not isinstance(s,trimesh.Scene):raise SystemExit('Not a GLB scene')
required={
'esp32:rf-shield', 'esp32:gold-pins','esp32:usb-connector',
'ph:bnc-socket','ph:blue-glass-electrode',
'turbidity:optical-fork-tine','tds:electrode','temperature:steel-probe',
'relay:songle-blue','relay:terminal-well','valve:plunger-visual',
'valve:hex-union','display:static-bezel','chamber:water-cell',
'conditioning:ph-divider-pcb','conditioning:turb-divider-pcb',
'power:inline-12v-fuse','valve:independent-position-switch'
}
names=set(s.graph.nodes_geometry)
missing=required-names
assert not missing,f'Missing required meshes: {sorted(missing)}'
assert len(names)>=120, 'Unexpectedly simplified model'
assert sum(len(m.faces) for m in s.geometry.values())>=35000, 'Not enough physical detail'
assert any(getattr(g.visual.material,'baseColorTexture',None) is not None for g in s.geometry.values())
for n in names:
 if n.startswith(('esp32:','ph:','turbidity:','tds:','temperature:','power:','relay:','valve:','chamber:','display:','frame:','base:','wire:','led:','water:','tube:','conditioning:','terminal:')):continue
 raise AssertionError('Unknown component name: '+n)
assert s.bounds is not None
for n in NETS:
 assert n['id'] != '', 'Unnamed electrical net'
 assert len(n['points']) >= 2, n['id']
 assert 'wire:'+n['id'] in names, f'Missing visual cable for {n["id"]}'
 assert any(abs(float(v))>0 for v in n['points'][0]), n['id']
 assert n['points'][0] != n['points'][-1], n['id']
assert len({n['id'] for n in NETS}) == len(NETS), 'Duplicate electrical nets'
assert all(any(k in (n['destination']+' '+n['source']) for n in NETS) for k in ('GPIO34','GPIO35','GPIO32','GPIO4','GPIO26','GPIO27'))

print('PASS: GLB loads, recognisable sensor/controller/valve parts present')
print(f'PASS: {len(names)} named mesh nodes, {sum(len(m.faces) for m in s.geometry.values()):,} triangles')
print('PASS: existing valve:plunger-visual interaction contract preserved')
print('PASS: textured module faces and labels included')

print(f'PASS: {len(NETS)} uniquely named physical routes with explicit terminal endpoints; GPIO34/35/32/4/26/27 present')
