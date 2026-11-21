import React, { useState } from 'react';
import { ChevronRight, Pause, Play, RotateCcw, Scan } from 'lucide-react';
import SingleComponent3D from './SingleComponent3D';
import ViewerBoundary from './ViewerBoundary';
import { COMPONENTS_DATA } from '../data/componentData';

export default function ComponentLibrary() {
  const [selectedId, setSelectedId] = useState(COMPONENTS_DATA[0].id);
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const comp = COMPONENTS_DATA.find(item => item.id === selectedId);
  const preview = `/components/${comp.id}.webp`;

  return (
    <div className="component-library-container">
      <aside className="component-sidebar">
        <h2>Component library</h2>
        <p>Explore the nine parts of the prototype.</p>
        <label className="mobile-picker">Choose a component
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {COMPONENTS_DATA.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <nav className="component-list" aria-label="Components">
          {COMPONENTS_DATA.map(item => (
            <button key={item.id} className="component-nav-button" aria-pressed={selectedId === item.id}
              onClick={() => setSelectedId(item.id)}>
              <img src={`/components/${item.id}.webp`} alt="" width="56" height="44" />
              <span>{item.label}</span><ChevronRight size={14}/>
            </button>
          ))}
        </nav>
      </aside>
      <section className="component-detail-view" aria-labelledby="part-title">
        <header className="part-heading">
          <h2 id="part-title">{comp.label}</h2>
          <p>{comp.name}</p>
        </header>
        <figure className="part-figure">
          <ViewerBoundary fallback={<div className="comp-canvas-wrapper part-fallback"><img src={preview} alt={comp.name}/><p>Model preview · Interactive 3D unavailable</p></div>}>
            <div className="comp-canvas-wrapper" role="group" aria-label={`Interactive 3D model of ${comp.label}`}>
              <SingleComponent3D componentId={comp.id} autoRotate={autoRotate} wireframe={wireframe} resetVersion={resetVersion}/>
            </div>
          <figcaption>
            <span>Drag to rotate · Scroll or pinch to zoom</span>
            <div className="part-tools">
              <button aria-pressed={autoRotate} onClick={() => setAutoRotate(!autoRotate)}>
                {autoRotate ? <Pause size={15}/> : <Play size={15}/>} Rotate
              </button>
              <button aria-pressed={wireframe} onClick={() => setWireframe(!wireframe)}><Scan size={15}/> Wireframe</button>
              <button onClick={() => { setAutoRotate(false); setWireframe(false); setResetVersion(v => v + 1); }}><RotateCcw size={15}/> Reset view</button>
            </div>
          </figcaption>
          </ViewerBoundary>
        </figure>
        <p className="part-description">{comp.summary}</p>
        <div className="part-details" key={comp.id}>
          <details><summary>Specifications</summary>
            <p>{comp.purpose}</p>
            <table className="spec-table"><tbody>
              {[{ label: 'Power', value: comp.voltage }, ...comp.specifications].map(spec =>
                <tr key={spec.label}><th scope="row">{spec.label}</th><td>{spec.value}</td></tr>)}
            </tbody></table>
          </details>
          <details><summary>Wiring connections</summary>
            <div className="connections-table-wrap"><table className="connections-table">
              <thead><tr><th>Pin or terminal</th><th>Connects to</th><th>Type</th></tr></thead>
              <tbody>{comp.proposedConnections.map(conn => <tr key={conn.pin}><td>{conn.pin}</td><td>{conn.target}</td><td>{conn.domain}</td></tr>)}</tbody>
            </table></div>
          </details>
          <details><summary>Prototype notes</summary><p>{comp.roleInAquaSentra}</p>
            <ul>{comp.assumptionsAndWarnings.map(note => <li key={note}>{note}</li>)}</ul>
          </details>
        </div>
      </section>
    </div>
  );
}
