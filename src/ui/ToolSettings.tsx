import { useState } from 'react';
import type { Settings } from '../core/settings';

interface Props { settings: Settings; update: (patch: Partial<Settings>) => void }
type Tool = Pick<Settings, 'toolDiameter' | 'fluteLength' | 'maxStepdown' | 'spindle' | 'feed' | 'plunge' | 'units'>;
const toolKeys = ['toolDiameter', 'fluteLength', 'maxStepdown', 'spindle', 'feed', 'plunge'] as const;
const libraryKey = 'stl2gcode-tools-v1';

export function ToolSettings({ settings: s, update }: Props) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [library, setLibrary] = useState<Record<string, Tool>>(() => {
    try { return JSON.parse(localStorage.getItem(libraryKey) ?? '{}'); } catch { return {}; }
  });
  const number = (label: string, key: typeof toolKeys[number], suffix: string) =>
    <label className="field">{label}<span><input title={`${label} (${suffix})`} type="number" min="0" step="any" value={Number.isFinite(s[key]) ? s[key] : ''}
      onChange={e => update({ [key]: e.target.value === '' ? NaN : e.target.valueAsNumber })} /> {suffix}</span></label>;
  const save = () => {
    if (!name.trim()) { setMessage('Enter a preset name.'); return; }
    if (toolKeys.some(key => !Number.isFinite(s[key]) || s[key] <= 0)) { setMessage('Enter valid positive tool values before saving.'); return; }
    const tool: Tool = { units: s.units, toolDiameter: s.toolDiameter, fluteLength: s.fluteLength, maxStepdown: s.maxStepdown, spindle: s.spindle, feed: s.feed, plunge: s.plunge };
    const next = { ...library, [name.trim()]: tool };
    try { localStorage.setItem(libraryKey, JSON.stringify(next)); setLibrary(next); setMessage('Preset saved.'); }
    catch { setMessage('Could not save preset in local storage.'); }
  };
  return <section>
    <h2>Tool</h2>
    <p className="hint">Flat end mill</p>
    {number('Diameter', 'toolDiameter', s.units)}{number('Flute length', 'fluteLength', s.units)}
    {number('Maximum stepdown', 'maxStepdown', s.units)}{number('Spindle', 'spindle', 'RPM')}
    {number('Feed', 'feed', `${s.units}/min`)}{number('Plunge', 'plunge', `${s.units}/min`)}
    <label className="field">Preset name<input value={name} onChange={e => setName(e.target.value)} /></label>
    <button type="button" onClick={save}>Save tool</button>
    <label className="field">Load preset<select value="" onChange={e => {
      const preset = library[e.target.value];
      if (!preset) return;
      if (preset.units !== s.units) { setMessage('Preset units differ or are unknown; select matching working units first.'); return; }
      if (toolKeys.some(key => !Number.isFinite(preset[key]) || preset[key] <= 0)) { setMessage('The saved tool preset is invalid.'); return; }
      update(preset); setMessage('Preset loaded.');
    }}><option value="">Select a tool…</option>{Object.keys(library).map(key => <option key={key} value={key}>{key} ({library[key].units ?? 'units unknown'})</option>)}</select></label>
    {message && <p role="status">{message}</p>}
  </section>;
}
