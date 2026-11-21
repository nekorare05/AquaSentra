import { Box3, Group, Vector3 } from 'three';
import { getComponentByMeshName } from './componentData.js';

// GLTFLoader keeps the CAD name here and removes its colons from Object3D.name.
export const cadName = mesh => mesh.userData.name || mesh.name;

// Present accessories beside their module instead of leaving assembly-sized gaps between them.
function displayGroup(id, name) {
  if (['ph', 'turbidity', 'tds', 'temperature'].includes(id)) {
    if (name.startsWith('conditioning:')) return 'signal board';
    if (/:(bulkhead|seal|hex-gland|blue-glass|glass-bulb|probe|collar|neck|optical|electrode|steel-probe|heat-shrink)/.test(name)) return 'probe';
  }
  if (id === 'power' && name.includes('fuse')) return 'fuse';
  return 'module';
}

export function isolateComponent(scene, componentId) {
  const parts = new Group();
  const groups = new Map();
  scene.updateWorldMatrix(true, true);
  scene.traverse(node => {
    if (!node.isMesh || getComponentByMeshName(cadName(node))?.id !== componentId) return;
    const part = node.clone(false);
    node.matrixWorld.decompose(part.position, part.quaternion, part.scale);
    part.material = node.material.clone();
    const key = displayGroup(componentId, cadName(node));
    if (!groups.has(key)) groups.set(key, new Group());
    groups.get(key).add(part);
  });
  if (!groups.size) throw new Error(`Component geometry missing for ${componentId}`);

  let left = 0;
  for (const group of groups.values()) {
    const box = new Box3().setFromObject(group);
    const center = box.getCenter(new Vector3());
    group.position.set(left - box.min.x, -center.y, -center.z);
    left += box.max.x - box.min.x + 0.16;
    parts.add(group);
  }
  const bounds = new Box3().setFromObject(parts);
  parts.position.copy(bounds.getCenter(new Vector3())).negate();
  const centered = new Group();
  centered.add(parts);
  centered.scale.setScalar(3.4 / bounds.getSize(new Vector3()).length());
  return centered;
}
