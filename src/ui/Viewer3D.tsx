import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Mesh } from '../core/stl/parser';
import type { Settings } from '../core/settings';
import type { ToolpathSegment } from '../core/toolpath/profile';

interface Props { mesh: Mesh | null; settings: Settings; segments: ToolpathSegment[] }

export function Viewer3D({ mesh, settings: s, segments }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const views = useRef<(view: string) => void>(() => {});
  const tool = useRef<THREE.Group | null>(null);
  const [showCuts, setShowCuts] = useState(true);
  const [showRapids, setShowRapids] = useState(true);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setPosition(0); setPlaying(false); }, [segments]);
  useEffect(() => {
    if (!playing || segments.length < 2) return;
    let frame = 0, last = 0;
    const tick = (time: number) => {
      if (last) setPosition(value => {
        const next = value + (time - last) / 20000;
        if (next >= 1) { setPlaying(false); return 1; }
        return next;
      });
      last = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, segments]);
  useEffect(() => {
    const element = host.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#18212d');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    camera.up.set(0, 0, 1);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(1, 2, 3);
    scene.add(light);
    const stockSize = Math.max(s.stockX || 1, s.stockY || 1, s.stockZ || 1, 1);
    const grid = new THREE.GridHelper(stockSize * 2, 20, 0x65768b, 0x354455);
    grid.rotation.x = Math.PI / 2;
    grid.position.set(s.stockX / 2, s.stockY / 2, -s.stockZ);
    scene.add(grid);
    const axes = new THREE.AxesHelper(stockSize / 3);
    axes.position.set(s.originXY === 'center' ? s.stockX / 2 : 0, s.originXY === 'center' ? s.stockY / 2 : 0, s.originZ === 'bottom' ? -s.stockZ : 0);
    scene.add(axes);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(Math.max(s.stockX, 0.001), Math.max(s.stockY, 0.001), Math.max(s.stockZ, 0.001)), new THREE.MeshBasicMaterial({ color: 0x91aabc, transparent: true, opacity: 0.12, depthWrite: false }));
    stock.position.set(s.stockX / 2, s.stockY / 2, -s.stockZ / 2);
    scene.add(stock);
    controls.target.set(s.stockX / 2, s.stockY / 2, -s.stockZ / 2);
    const size = stockSize * 2.5;
    if (mesh) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
      const model = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x73c6df, metalness: 0.15, roughness: 0.6, side: THREE.DoubleSide }));
      model.position.set(-(mesh.min[0] + mesh.max[0]) / 2, -(mesh.min[1] + mesh.max[1]) / 2, -(s.flip ? mesh.min[2] : mesh.max[2]));
      const flip = new THREE.Group();
      flip.rotation.x = s.flip ? Math.PI : 0;
      const factor = s.scale * (s.modelUnits === s.units ? 1 : s.modelUnits === 'inch' ? 25.4 : 1 / 25.4);
      flip.scale.setScalar(factor);
      flip.add(model);
      const placement = new THREE.Group();
      placement.position.set(s.stockX / 2, s.stockY / 2, s.modelZ);
      placement.rotation.z = s.rotation * Math.PI / 180;
      placement.add(flip);
      scene.add(placement);
    }
    for (const kind of ['rapid', 'cut'] as const) {
      if ((kind === 'rapid' && !showRapids) || (kind === 'cut' && !showCuts)) continue;
      const points: number[] = [];
      for (let i = 1; i < segments.length; i++) {
        const previous = segments[i - 1], current = segments[i];
        if (current.type === kind) points.push(previous.x, previous.y, previous.z, current.x, current.y, current.z);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      scene.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: kind === 'cut' ? 0xffb352 : 0x8db6ed })));
    }
    if (segments.length) {
      const marker = new THREE.Group();
      const height = Math.max(s.toolDiameter * 2, 0.01);
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(s.toolDiameter / 2, s.toolDiameter / 2, height, 20), new THREE.MeshStandardMaterial({ color: 0xe9e9ee, metalness: 0.5 }));
      cylinder.rotation.x = Math.PI / 2;
      cylinder.position.z = height / 2;
      marker.add(cylinder);
      scene.add(marker);
      tool.current = marker;
    } else tool.current = null;
    views.current = (view: string) => {
      const direction = view === 'Top' ? [0, 0.001, 1] : view === 'Front' ? [0, -1, 0] : view === 'Right' ? [1, 0, 0] : [1, -1, 1];
      camera.position.copy(controls.target).add(new THREE.Vector3(...direction as [number, number, number]).normalize().multiplyScalar(size));
      camera.near = Math.max(size / 10000, 0.001);
      camera.far = size * 100;
      camera.updateProjectionMatrix();
      controls.update();
    };
    views.current('Isometric');
    const resize = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = element;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    });
    resize.observe(element);
    let frame = 0;
    const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
      tool.current = null;
      element.removeChild(renderer.domElement);
    };
  }, [mesh, s, segments, showCuts, showRapids]);
  useEffect(() => {
    if (!tool.current || !segments.length) return;
    const index = position * (segments.length - 1);
    const a = segments[Math.floor(index)], b = segments[Math.min(Math.ceil(index), segments.length - 1)];
    const t = index - Math.floor(index);
    tool.current.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  }, [position, segments, mesh, s, showCuts, showRapids]);
  return <section className="viewer" aria-label="3D preview">
    <div className="viewer-toolbar">{['Fit', 'Top', 'Front', 'Right', 'Isometric'].map(view =>
      <button key={view} onClick={() => views.current(view)}>{view}</button>)}</div>
    <div className="canvas" ref={host} />
    <div className="viewer-bottom">
      <div className="viewer-hint">Drag to rotate · Scroll to zoom · Right-drag to pan</div>
      <div className="simulation">
        <label><input type="checkbox" checked={showCuts} onChange={e => setShowCuts(e.target.checked)} /> Cuts</label>
        <label><input type="checkbox" checked={showRapids} onChange={e => setShowRapids(e.target.checked)} /> Rapids</label>
        <button disabled={segments.length < 2} onClick={() => { if (position === 1) setPosition(0); setPlaying(!playing); }}>{playing ? 'Pause' : 'Play'}</button>
        <input aria-label="Toolpath simulation position" type="range" min="0" max="1" step="0.001" value={position} disabled={segments.length < 2} onChange={e => { setPlaying(false); setPosition(Number(e.target.value)); }} />
      </div>
    </div>
  </section>;
}
