import type { ProfileOperation } from '../core/toolpath/profile';
import type { Settings } from '../core/settings';

interface Props {
  operations: ProfileOperation[];
  setOperations: (ops: ProfileOperation[]) => void;
  settings: Settings;
  planar: boolean;
}

export function newProfile(kind: ProfileOperation['kind'] = 'profile'): ProfileOperation {
  return { id: crypto.randomUUID(), kind, enabled: true, side: 'outside', sliceZ: -1, depth: 5, stepdown: 2, allowance: 0, spring: false, direction: 'climb', stepover: 40 };
}
export function OperationList({ operations, setOperations, settings: s, planar }: Props) {
  const patch = (id: string, value: Partial<ProfileOperation>) => setOperations(operations.map(op => op.id === id ? { ...op, ...value } : op));
  const move = (index: number, delta: number) => {
    const next = [...operations], target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOperations(next);
  };
  return <section><h2>Operations</h2>
    {operations.map((op, index) => <div className="operation" key={op.id}>
      <div className="operation-heading"><label><input type="checkbox" checked={op.enabled} onChange={e => patch(op.id, { enabled: e.target.checked })} /> {op.kind === 'pocket' ? 'Pocket' : 'Profile'} {index + 1}</label>
        <div><button aria-label={`Move operation ${index + 1} up`} onClick={() => move(index, -1)} disabled={index === 0}>↑</button>{' '}
          <button aria-label={`Move operation ${index + 1} down`} onClick={() => move(index, 1)} disabled={index === operations.length - 1}>↓</button>{' '}
          <button aria-label={`Delete operation ${index + 1}`} onClick={() => setOperations(operations.filter(o => o.id !== op.id))}>×</button></div></div>
      {op.kind === 'profile' && <label className="field">Cut side<select value={op.side} onChange={e => patch(op.id, { side: e.target.value as ProfileOperation['side'] })}><option value="outside">Outside</option><option value="inside">Inside</option><option value="on">On line</option></select></label>}
      {op.kind === 'pocket' && <label className="field">Stepover<span><input title="Stepover (% of tool diameter)" type="number" min="1" max="50" step="any" value={Number.isFinite(op.stepover) ? op.stepover : ''} onChange={e => patch(op.id, { stepover: e.target.value === '' ? NaN : e.target.valueAsNumber })} /> %</span></label>}
      {planar && <p className="hint">Flat model: the triangle outlines are used instead of a slice height.</p>}
      {([
        ...(!planar ? [['Slice Z from stock top', 'sliceZ'] as const] : []),
        ['Total depth from stock top', 'depth'],
        ['Depth per pass', 'stepdown'],
        ['Finishing allowance', 'allowance'],
      ] as const).map(([label, key]) => <label className="field" key={key}>{label}<span><input title={`${label} (${s.units})`} type="number" step="any" value={Number.isFinite(op[key]) ? op[key] : ''} onChange={e => patch(op.id, { [key]: e.target.value === '' ? NaN : e.target.valueAsNumber })} /> {s.units}</span></label>)}
      <label className="field">Direction<select value={op.direction} onChange={e => patch(op.id, { direction: e.target.value as ProfileOperation['direction'] })}><option value="climb">Climb</option><option value="conventional">Conventional</option></select></label>
      <label className="check"><input type="checkbox" checked={op.spring} onChange={e => patch(op.id, { spring: e.target.checked })} /> Spring pass</label>
    </div>)}
    <button onClick={() => setOperations([...operations, newProfile()])}>Add profile</button>{' '}
    <button onClick={() => setOperations([...operations, newProfile('pocket')])}>Add pocket</button>
  </section>;
}
