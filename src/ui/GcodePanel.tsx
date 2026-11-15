import { useMemo, useState } from 'react';
import { generateGcode, pathStats, type Dialect } from '../core/gcode/post';
import type { Settings } from '../core/settings';
import type { ProfileOperation, ToolpathSegment } from '../core/toolpath/profile';

interface Props { segments: ToolpathSegment[]; settings: Settings; operations: ProfileOperation[] }
export function GcodePanel({ segments, settings, operations }: Props) {
  const [dialect, setDialect] = useState<Dialect>('GRBL');
  const [precision, setPrecision] = useState(3);
  const [lineNumbers, setLineNumbers] = useState(false);
  const [notice, setNotice] = useState('');
  const result = useMemo(() => {
    if (!segments.length) return { code: '', error: '' };
    try { return { code: generateGcode(segments, settings, operations, { dialect, precision, lineNumbers }), error: '' }; }
    catch (e) { return { code: '', error: e instanceof Error ? e.message : 'Export failed.' }; }
  }, [segments, settings, operations, dialect, precision, lineNumbers]);
  const stats = pathStats(segments);
  const download = () => {
    const url = URL.createObjectURL(new Blob([result.code], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url; link.download = dialect === 'Marlin' ? 'toolpath.gcode' : 'toolpath.nc'; link.click();
    URL.revokeObjectURL(url);
  };
  return <section className="gcode-panel">
    <h2>G-code</h2>
    <div className="post-controls">
      <label>Post-processor <select value={dialect} onChange={e => setDialect(e.target.value as Dialect)}>{(['GRBL', 'Mach3', 'LinuxCNC', 'Marlin'] as const).map(d => <option key={d}>{d}</option>)}</select></label>
      <label>Precision <input type="number" min="1" max="6" step="1" value={precision} onChange={e => setPrecision(e.target.valueAsNumber)} /></label>
      <label><input type="checkbox" checked={lineNumbers} onChange={e => setLineNumbers(e.target.checked)} /> Line numbers</label>
      <button disabled={!result.code} onClick={() => void navigator.clipboard.writeText(result.code).then(() => setNotice('Copied.'), () => setNotice('Copy failed; select the code instead.'))}>Copy</button>
      <button disabled={!result.code} onClick={download}>Download</button>
    </div>
    {stats && <p className="hint">Path: {stats.length.toFixed(2)} {settings.units} · Cutting time: {stats.cuttingMinutes.toFixed(1)} min (excludes rapids) · Bounds in stock coordinates: {stats.min.map(n => n.toFixed(2)).join(', ')} to {stats.max.map(n => n.toFixed(2)).join(', ')}</p>}
    {result.error && <p className="error" role="alert">{result.error}</p>}
    {notice && <p role="status">{notice}</p>}
    <textarea aria-label="Generated G-code" readOnly value={result.code} placeholder="Generate a toolpath to see G-code." spellCheck={false} />
  </section>;
}
