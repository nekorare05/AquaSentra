import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Html } from '@react-three/drei';
import * as THREE from 'three';
import { getComponentByMeshName } from '../data/componentData';

function IsolatedMeshGroup({ componentId, wireframe, autoRotate }) {
  const { scene } = useGLTF('/models/aquasentra-device.glb');
  const groupRef = useRef();

  const isolatedScene = useMemo(() => {
    const root = new THREE.Group();
    const box = new THREE.Box3();
    let hasMeshes = false;

    scene.traverse(node => {
      if (!node.isMesh) return;
      const comp = getComponentByMeshName(node.name);
      if (comp && comp.id === componentId) {
        const clonedMesh = node.clone();
        clonedMesh.material = node.material.clone();
        clonedMesh.material.wireframe = wireframe;
        // Keep textures and materials visible
        if (clonedMesh.material.transparent) {
          clonedMesh.material.opacity = Math.max(clonedMesh.material.opacity, 0.45);
        }
        root.add(clonedMesh);
        box.expandByObject(clonedMesh);
        hasMeshes = true;
      }
    });

    if (hasMeshes) {
      // Re-center geometry around origin (0, 0, 0)
      const center = new THREE.Vector3();
      box.getCenter(center);
      root.position.set(-center.x, -center.y, -center.z);
      
      // Calculate normalized scale factor so small modules (like probe) and large units (like chamber) fit comfortably
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetDim = 3.5;
      const scaleFactor = maxDim > 0 ? targetDim / maxDim : 1;
      root.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }

    return root;
  }, [scene, componentId, wireframe]);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={isolatedScene} />
    </group>
  );
}

export default function SingleComponent3D({ componentId, autoRotate = false, wireframe = false }) {
  const controlsRef = useRef();

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0a101d', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [3, 2.5, 4.5], fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#0a101d']} />
        
        {/* Balanced studio lighting */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 8, 5]} intensity={1.2} />
        <directionalLight position={[-6, -4, -4]} intensity={0.5} color="#38bdf8" />
        <pointLight position={[0, 4, 0]} intensity={0.8} />

        <React.Suspense fallback={<Html center><div style={{ color: '#38bdf8', fontSize: '13px', fontWeight: 600 }}>Loading 3D Model...</div></Html>}>
          <IsolatedMeshGroup componentId={componentId} wireframe={wireframe} autoRotate={autoRotate} />
        </React.Suspense>

        {/* Circular engineering grid on ground */}
        <gridHelper args={[8, 16, '#1e293b', '#0f172a']} position={[0, -1.8, 0]} />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={12}
        />
      </Canvas>
    </div>
  );
}
