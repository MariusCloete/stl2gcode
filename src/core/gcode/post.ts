import { validateSettings, type Settings } from '../settings';
import type { ProfileOperation, ToolpathSegment } from '../toolpath/profile';

export type Dialect = 'GRBL' | 'Mach3' | 'LinuxCNC' | 'Marlin';
export interface PostOptions { dialect: Dialect; precision: number; lineNumbers: boolean }
export interface PathStats { min: [number, number, number]; max: [number, number, number]; length: number; cuttingMinutes: number }

export function pathStats(segments: ToolpathSegment[]): PathStats | null {
  if (!segments.length) return null;
  const min: PathStats['min'] = [Infinity, Infinity, Infinity], max: PathStats['max'] = [-Infinity, -Infinity, -Infinity];
  let length = 0, cuttingMinutes = 0;
  segments.forEach((s, i) => {
    [s.x, s.y, s.z].forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
    if (i) {
      const prev = segments[i - 1];
      const distance = Math.hypot(s.x - prev.x, s.y - prev.y, s.z - prev.z);
      length += distance;
      if (s.type === 'cut' && s.feed) cuttingMinutes += distance / s.feed;
    }
  });
  return { min, max, length, cuttingMinutes };
}

export function generateGcode(segments: ToolpathSegment[], settings: Settings, operations: ProfileOperation[], options: PostOptions): string {
  if (!segments.length) throw new Error('Generate a toolpath before exporting.');
  const errors = validateSettings(settings);
  if (errors.length) throw new Error(errors.join(' '));
  if (!Number.isInteger(options.precision) || options.precision < 1 || options.precision > 6) throw new Error('Precision must be between 1 and 6 decimal places.');
  const multiplier = 10 ** options.precision;
  const fmt = (n: number) => {
    const rounded = Number(n.toFixed(options.precision));
    return (Object.is(rounded, -0) ? 0 : rounded).toFixed(options.precision);
  };
  const zOffset = settings.originZ === 'bottom' ? settings.stockZ : 0;
  const originX = settings.originXY === 'center' ? settings.stockX / 2 : 0;
  const originY = settings.originXY === 'center' ? settings.stockY / 2 : 0;
  const zfmt = (z: number) => fmt(Math.ceil((z + zOffset) * multiplier - 1e-8) / multiplier);
  if (Math.round(settings.spindle) <= 0) throw new Error('Spindle speed rounds to zero.');
  const lines = [
    options.dialect === 'Marlin' ? '; STL2GCODE - verify in simulator and air cut' : '(STL2GCODE - verify in simulator and air cut)',
    settings.units === 'mm' ? 'G21' : 'G20', 'G90', 'G17',
    `G0 Z${zfmt(settings.clearanceZ)}`,
    `M3 S${Math.round(settings.spindle)}`,
  ];
  let previous: ToolpathSegment | null = null;
  for (const segment of segments) {
    const op = operations.find(o => o.id === segment.operation && o.enabled);
    if (!op || ![segment.x, segment.y, segment.z].every(Number.isFinite) || segment.x < 0 || segment.y < 0 ||
      segment.x > settings.stockX || segment.y > settings.stockY || segment.z < -op.depth - 1e-8 || segment.z < -settings.stockZ - 1e-8) {
      throw new Error('Toolpath failed export safety validation.');
    }
    if (segment.type === 'rapid' && previous && (segment.x !== previous.x || segment.y !== previous.y) &&
      (previous.z < settings.safeZ || segment.z < settings.safeZ)) throw new Error('Unsafe XY rapid detected below safe height.');
    if (segment.type === 'cut' && (!segment.feed || !Number.isFinite(segment.feed) || segment.feed <= 0 || Number(fmt(segment.feed)) <= 0)) throw new Error('A cutting move has an invalid feed rate at the chosen precision.');
    lines.push(`${segment.type === 'rapid' ? 'G0' : 'G1'} X${fmt(segment.x - originX)} Y${fmt(segment.y - originY)} Z${zfmt(segment.z)}${segment.type === 'cut' ? ` F${fmt(segment.feed!)}` : ''}`);
    previous = segment;
  }
  lines.push(`G0 Z${zfmt(settings.clearanceZ)}`);
  if (options.dialect === 'Marlin') lines.push('M400', 'M5');
  else lines.push('M5', 'M30');
  return lines.map((line, i) => options.lineNumbers ? `N${(i + 1) * 10} ${line}` : line).join('\n') + '\n';
}
