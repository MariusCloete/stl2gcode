import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings';
import type { ProfileOperation, ToolpathSegment } from '../toolpath/profile';
import { generateGcode, type Dialect } from './post';

const operation: ProfileOperation = { id: 'one', kind: 'profile', enabled: true, side: 'outside', sliceZ: -1, depth: 5, stepdown: 2, allowance: 0, spring: false, direction: 'climb', stepover: 40 };
const path: ToolpathSegment[] = [
  { type: 'rapid', x: 1, y: 1, z: 5, operation: 'one' },
  { type: 'cut', x: 1, y: 1, z: -5, feed: 300, operation: 'one' },
  { type: 'cut', x: 2, y: 1, z: -5, feed: 1000, operation: 'one' },
  { type: 'rapid', x: 2, y: 1, z: 5, operation: 'one' },
];
describe('post-processors', () => {
  it.each(['GRBL', 'Mach3', 'LinuxCNC', 'Marlin'] as Dialect[])('%s output', dialect => {
    expect(generateGcode(path, defaultSettings, [operation], { dialect, precision: 3, lineNumbers: false })).toMatchSnapshot();
  });
  it('rejects a rapid XY move below safe Z', () => {
    expect(() => generateGcode([...path.slice(0, 2), { type: 'rapid', x: 2, y: 1, z: -5, operation: 'one' }], defaultSettings, [operation], { dialect: 'GRBL', precision: 3, lineNumbers: false })).toThrow(/Unsafe/);
  });
  it('rounds Z toward the stock top, never deeper', () => {
    const op = { ...operation, depth: 5.0006 };
    const result = generateGcode([{ ...path[0] }, { ...path[1], z: -5.0006 }], defaultSettings, [op], { dialect: 'GRBL', precision: 3, lineNumbers: false });
    expect(result).toContain('Z-5.000');
  });
});
