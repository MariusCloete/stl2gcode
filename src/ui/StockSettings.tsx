import type { Settings } from '../core/settings';

interface Props { settings: Settings; update: (patch: Partial<Settings>) => void }

export function StockSettings({ settings: s, update }: Props) {
  const number = (label: string, key: keyof Settings, suffix: string, min = 0) =>
    <label className="field">{label}<span><input title={`${label} (${suffix})`} type="number" step="any" min={min} value={Number.isFinite(s[key] as number) ? s[key] as number : ''}
      onChange={e => update({ [key]: e.target.value === '' ? NaN : e.target.valueAsNumber })} /> {suffix}</span></label>;
  return <section>
    <h2>Stock &amp; model</h2>
    <label className="field">Working units<select value={s.units} onChange={e => update({ units: e.target.value as Settings['units'] })}><option value="mm">mm</option><option value="inch">inch</option></select></label>
    <label className="field">STL units<select value={s.modelUnits} onChange={e => update({ modelUnits: e.target.value as Settings['modelUnits'] })}><option value="mm">mm</option><option value="inch">inch</option></select></label>
    <p className="hint">Changing units reinterprets entered values; update dimensions and feeds to match.</p>
    {number('Model scale', 'scale', '×')}
    <label className="field">Rotate around Z<select value={s.rotation} onChange={e => update({ rotation: Number(e.target.value) })}>{[0, 90, 180, 270].map(n => <option key={n} value={n}>{n}°</option>)}</select></label>
    <label className="check"><input type="checkbox" checked={s.flip} onChange={e => update({ flip: e.target.checked })} /> Flip model over X axis</label>
    {number('Stock X', 'stockX', s.units)}{number('Stock Y', 'stockY', s.units)}{number('Stock Z', 'stockZ', s.units)}
    {number('Model top from stock top', 'modelZ', s.units, -s.stockZ)}
    <label className="field">XY origin<select value={s.originXY} onChange={e => update({ originXY: e.target.value as Settings['originXY'] })}><option value="corner">Lower-left corner</option><option value="center">Center</option></select></label>
    <label className="field">Z origin<select value={s.originZ} onChange={e => update({ originZ: e.target.value as Settings['originZ'] })}><option value="top">Stock top</option><option value="bottom">Stock bottom</option></select></label>
    {number('Safe height above stock', 'safeZ', s.units)}{number('Rapid clearance above stock', 'clearanceZ', s.units)}
  </section>;
}
