import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS_DATA, COMPONENT_MAP, getComponentByMeshName } from '../src/data/componentData.js';
import { SIMULATION_STEPS, SCENARIOS } from '../src/data/simulationScenarios.js';
import wiringManifest from '../src/data/modelConnections.json' with { type: 'json' };

test('Component Library includes all 9 required standalone modules', () => {
  const expectedIds = ['esp32', 'ph', 'turbidity', 'tds', 'temperature', 'relay', 'valve', 'power', 'chamber'];
  assert.equal(COMPONENTS_DATA.length, 9);
  for (const id of expectedIds) {
    assert.ok(COMPONENT_MAP[id], `Missing component: ${id}`);
  }
});

test('Each component details name, purpose, proposed connections, voltage, and role in AquaSentra', () => {
  for (const comp of COMPONENTS_DATA) {
    assert.ok(comp.name.length > 5, `Name too short for ${comp.id}`);
    assert.ok(comp.purpose.length > 20, `Purpose too short for ${comp.id}`);
    assert.ok(comp.roleInAquaSentra.length > 20, `Role too short for ${comp.id}`);
    assert.ok(comp.voltage.length > 2, `Voltage missing for ${comp.id}`);
    assert.ok(Array.isArray(comp.proposedConnections) && comp.proposedConnections.length > 0, `Connections missing for ${comp.id}`);
    assert.ok(Array.isArray(comp.assumptionsAndWarnings) && comp.assumptionsAndWarnings.length > 0, `Warnings missing for ${comp.id}`);
  }
});

test('Simulation sequence contains exactly 10 ordered steps', () => {
  assert.equal(SIMULATION_STEPS.length, 10);
  for (let i = 0; i < 10; i++) {
    assert.equal(SIMULATION_STEPS[i].step, i + 1);
    assert.ok(SIMULATION_STEPS[i].title.length > 5);
    assert.ok(SIMULATION_STEPS[i].esp32Activity.length > 5);
    assert.ok(SIMULATION_STEPS[i].backendState.length > 5);
  }
});

test('Simulation includes Normal, Risky, Critical, fault, and recovery scenarios', () => {
  const scenarioIds = SCENARIOS.map(s => s.id);
  assert.ok(scenarioIds.includes('normal'));
  assert.ok(scenarioIds.includes('risky'));
  assert.ok(scenarioIds.includes('critical'));
  assert.ok(scenarioIds.includes('no_ack'));
  assert.ok(scenarioIds.includes('stuck'));
  assert.ok(scenarioIds.includes('no_feedback'));
  assert.ok(scenarioIds.includes('recovery'));
});

test('Safety rule: Acknowledged command without independent verification is never verified closed', () => {
  const stuckScenario = SCENARIOS.find(s => s.id === 'stuck');
  assert.equal(stuckScenario.valveCommanded, 'closed');
  assert.equal(stuckScenario.valveAcknowledged, 'closed');
  assert.notEqual(stuckScenario.valveVerified, 'closed', 'Stuck valve must NOT report verified closed');

  const noAckScenario = SCENARIOS.find(s => s.id === 'no_ack');
  assert.notEqual(noAckScenario.valveVerified, 'closed', 'No-ack valve must NOT report verified closed');
});

test('33 explicitly named wiring net connections preserved in 3D Lab', () => {
  const nets = wiringManifest.connections;
  assert.equal(nets.length, 33);
  assert.equal(new Set(nets.map(n => n.id)).size, 33);
  for (const n of nets) {
    assert.ok(n.source.length > 3);
    assert.ok(n.destination.length > 3);
  }
});

test('Mesh identifier resolution maps real GLB names to component definitions', () => {
  assert.equal(getComponentByMeshName('esp32:pcb')?.id, 'esp32');
  assert.equal(getComponentByMeshName('ph:blue-glass-electrode')?.id, 'ph');
  assert.equal(getComponentByMeshName('turbidity:optical-fork-housing')?.id, 'turbidity');
  assert.equal(getComponentByMeshName('tds:electrode')?.id, 'tds');
  assert.equal(getComponentByMeshName('temperature:steel-probe')?.id, 'temperature');
  assert.equal(getComponentByMeshName('relay:songle-blue')?.id, 'relay');
  assert.equal(getComponentByMeshName('valve:brass-inline-body')?.id, 'valve');
  assert.equal(getComponentByMeshName('power:perforated-housing')?.id, 'power');
  assert.equal(getComponentByMeshName('chamber:water-cell')?.id, 'chamber');
});

test('Every catalog selection isolates visible, centered geometry from the shipped GLB', async () => {
  const { readFile } = await import('node:fs/promises');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { Box3, Texture, Vector3 } = await import('three');
  const { isolateComponent, cadName } = await import('../src/data/componentModel.js');
  const bytes = await readFile(new URL('../public/models/aquasentra-device.glb', import.meta.url));
  // Geometry and CAD names use the production loader. Node has no image decoder.
  const loader = new GLTFLoader().register(() => ({
    name: 'GeometryTestTextures', loadTexture: async () => new Texture()
  }));
  const { scene } = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''
  );
  for (const component of COMPONENTS_DATA) {
    const model = isolateComponent(scene, component.id);
    let meshCount = 0;
    model.traverse(node => {
      if (!node.isMesh) return;
      meshCount++;
      assert.equal(getComponentByMeshName(cadName(node))?.id, component.id);
    });
    assert.ok(meshCount > 0, component.id);
    const box = new Box3().setFromObject(model);
    assert.ok(box.getCenter(new Vector3()).length() < 1e-5, component.id);
    assert.ok(Math.abs(box.getSize(new Vector3()).length() - 3.4) < 1e-5, component.id);
  }
});
