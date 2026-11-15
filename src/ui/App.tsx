import { useEffect, useRef, useState } from 'react';
import { isPlanarMesh, type Mesh } from '../core/stl/parser';
import { defaultSettings, validateSettings, type Settings } from '../core/settings';
import { Viewer3D } from './Viewer3D';
import { StockSettings } from './StockSettings';
import { ToolSettings } from './ToolSettings';
import { OperationList, newProfile } from './OperationList';
import type { ProfileOperation, ToolpathSegment } from '../core/toolpath/profile';
import { GcodePanel } from './GcodePanel';

export function App() {
  const [mesh, setMesh] = useState<Mesh | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('stl2gcode-theme') === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });
  const [settings, setSettings] = useState<Settings>(() => {
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem('stl2gcode-settings-v1') ?? '{}') }; }
    catch { return defaultSettings; }
  });
  const [storageError, setStorageError] = useState('');
  const [operations, setOperations] = useState<ProfileOperation[]>(() => {
    try { return (JSON.parse(localStorage.getItem('stl2gcode-operations-v1') ?? 'null') as ProfileOperation[] | null)?.map(op => ({ ...op, kind: op.kind ?? 'profile', stepover: op.stepover ?? 40 })) ?? [newProfile()]; }
    catch { return [newProfile()]; }
  });
  const [segments, setSegments] = useState<ToolpathSegment[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const pathWorker = useRef<Worker | null>(null);
  const importId = useRef(0);
  const validSettings = validateSettings(settings);
  const previewSettings = useRef(validSettings.length ? defaultSettings : settings);
  if (!validSettings.length) previewSettings.current = settings;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('stl2gcode-theme', theme); }
    catch { setStorageError('Theme could not be saved in local storage.'); }
  }, [theme]);
  useEffect(() => {
    try { localStorage.setItem('stl2gcode-settings-v1', JSON.stringify(settings)); setStorageError(''); }
    catch { setStorageError('Settings could not be saved in local storage.'); }
  }, [settings]);
  useEffect(() => {
    setSegments([]);
    pathWorker.current?.terminate();
    pathWorker.current = null;
    setProgress(null);
    try { localStorage.setItem('stl2gcode-operations-v1', JSON.stringify(operations)); }
    catch { setStorageError('Operations could not be saved in local storage.'); }
  }, [settings, operations, mesh]);
  const invalidate = () => { setSegments([]); pathWorker.current?.terminate(); pathWorker.current = null; setProgress(null); };
  const update = (patch: Partial<Settings>) => { invalidate(); setSettings(current => ({ ...current, ...patch })); };
  const updateOperations = (next: ProfileOperation[]) => { invalidate(); setOperations(next); };
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => { importId.current++; worker.current?.terminate(); pathWorker.current?.terminate(); }, []);
  const load = async (file?: File) => {
    if (!file) return;
    const request = ++importId.current;
    worker.current?.terminate();
    invalidate();
    setError(''); setMesh(null); setName(file.name); setLoading(true);
    try {
      const data = await file.arrayBuffer();
      if (request !== importId.current) return;
      const instance = new Worker(new URL('../workers/import.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = event => {
        if (request !== importId.current) return;
        setLoading(false);
        if (event.data.error) setError(event.data.error);
        else setMesh(event.data.mesh);
        instance.terminate();
      };
      instance.onerror = () => { setLoading(false); setError('STL import worker failed.'); instance.terminate(); };
      instance.postMessage(data, [data]);
    } catch (e) { if (request === importId.current) { setLoading(false); setError(e instanceof Error ? e.message : 'Could not read the file.'); } }
  };
  const generate = () => {
    if (!mesh) { setError('Choose an STL file first.'); return; }
    setError(''); setSegments([]); setProgress(0);
    const instance = new Worker(new URL('../workers/toolpath.worker.ts', import.meta.url), { type: 'module' });
    pathWorker.current = instance;
    instance.onmessage = event => {
      if (event.data.progress !== undefined) setProgress(event.data.progress);
      else {
        setProgress(null);
        if (event.data.error) setError(event.data.error);
        else setSegments(event.data.segments);
        instance.terminate(); pathWorker.current = null;
      }
    };
    instance.onerror = () => { setError('Toolpath worker failed.'); setProgress(null); instance.terminate(); pathWorker.current = null; };
    instance.postMessage({ mesh: { ...mesh, normals: new Float32Array(0) }, settings, operations });
  };
  return <main>
    <header><div><h1>STL to G-code</h1><p>Browser-based CNC workspace</p></div><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button></header>
    <div className="layout">
      <aside tabIndex={0} aria-label="Model and machining settings">
        <h2>Model</h2>
        <label className="drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void load(e.dataTransfer.files[0]); }}>
          <strong>Drop an STL here</strong><span>or choose a file</span>
          <input type="file" accept=".stl,model/stl" onChange={e => void load(e.target.files?.[0])} />
        </label>
        <p className="hint">Sample models: <a href="samples/cube-20mm.stl" download>cube</a> · <a href="samples/cylinder-20mm.stl" download>cylinder</a> · <a href="samples/relief.stl" download>relief</a></p>
        {loading && <p role="status">Reading mesh in background…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {mesh && <div className="details">
          <strong>{name}</strong>
          <p>Triangles: {mesh.triangles.toLocaleString()}</p>
          <p>Dimensions: {mesh.max.map((v, i) => (v - mesh.min[i]).toFixed(2)).join(' × ')} {settings.modelUnits} (before scaling)</p>
          {mesh.degenerate > 0 && <p className="warning">{mesh.degenerate} degenerate triangles will be ignored. Verify the resulting outline.</p>}
          {mesh.nonManifoldEdges > 0 && <p className="warning">{mesh.nonManifoldEdges} open or non-manifold edges. {isPlanarMesh(mesh) ? 'Flat model outlines are derived from filled triangles.' : 'Slices must still form closed contours.'}</p>}
        </div>}
        <StockSettings settings={settings} update={update} />
        <ToolSettings settings={settings} update={update} />
        <OperationList operations={operations} setOperations={updateOperations} settings={settings} planar={!!mesh && isPlanarMesh(mesh)} />
        <div className="generate"><button onClick={generate} disabled={progress !== null || !mesh || validSettings.length > 0}>Generate toolpath</button>
          {progress !== null && <><progress aria-label="Toolpath progress" max={1} value={progress} /><button onClick={() => { pathWorker.current?.terminate(); pathWorker.current = null; setProgress(null); }}>Cancel</button></>}
        </div>
        {validSettings.map(error => <p className="error" key={error}>{error}</p>)}
        {storageError && <p className="warning" role="status">{storageError}</p>}
        <p className="disclaimer"><strong>Safety:</strong> Always verify G-code in a simulator and run an air cut before machining real material.</p>
        <p className="warning">Experimental: flat outlines or single-slice 2D paths only. No 3D collision, holder, or remaining-material checks are performed.</p>
      </aside>
      <div className="workspace">
        {validSettings.length > 0 && <p className="error" role="status">Preview shows the last valid settings until input errors are corrected.</p>}
        <Viewer3D mesh={mesh} settings={previewSettings.current} segments={segments} />
        {error && <p className="error">Toolpath/import error: {error}</p>}
        <GcodePanel settings={settings} segments={segments} operations={operations} />
      </div>
    </div>
  </main>;
}
