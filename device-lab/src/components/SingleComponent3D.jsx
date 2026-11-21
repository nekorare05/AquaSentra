import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { isolateComponent } from '../data/componentModel';

function Part({ componentId, wireframe }) {
  const invalidate = useThree(state => state.invalidate);
  const { scene } = useGLTF('/models/aquasentra-device.glb');
  const model = useMemo(() => isolateComponent(scene, componentId), [scene, componentId]);
  useEffect(() => {
    model.traverse(node => { if (node.isMesh) node.material.wireframe = wireframe; });
    invalidate();
  }, [model, wireframe, invalidate]);
  useEffect(() => () => {
    model.traverse(node => { if (node.isMesh) node.material.dispose(); });
  }, [model]);
  return <primitive object={model} />;
}

export default function SingleComponent3D({ componentId, autoRotate, wireframe, resetVersion }) {
  const controls = useRef(null);
  useEffect(() => { controls.current?.reset(); }, [componentId, resetVersion]);
  return (
    <Canvas frameloop={autoRotate ? 'always' : 'demand'} camera={{ position: [2.05, 1.55, 4.95], fov: 38 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#eaf0ee']} />
      <hemisphereLight intensity={1.55} color="#ffffff" groundColor="#baccc7" />
      <directionalLight position={[2, 6, 5]} intensity={2.1} />
      <directionalLight position={[-4, 2, -3]} intensity={1.4} />
      <Suspense fallback={<Html center><span className="viewer-loading">Loading model…</span></Html>}>
        <Part componentId={componentId} wireframe={wireframe} />
      </Suspense>
      <OrbitControls ref={controls} autoRotate={autoRotate} autoRotateSpeed={1.2}
        enableDamping enablePan={false} minDistance={2} maxDistance={10} />
    </Canvas>
  );
}
