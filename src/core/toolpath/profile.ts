import { isPlanarMesh, type Mesh } from '../stl/parser';
import { validateSettings, type Settings } from '../settings';
import { offsetPolygons, planarContours, sliceMesh, transformPoint } from '../geometry/slice';

export interface ProfileOperation {
  id: string;
  kind: 'profile' | 'pocket';
  enabled: boolean;
  side: 'outside' | 'inside' | 'on';
  sliceZ: number;
  depth: number;
  stepdown: number;
  allowance: number;
  spring: boolean;
  direction: 'climb' | 'conventional';
  stepover: number;
}
export interface ToolpathSegment { type: 'rapid' | 'cut'; x: number; y: number; z: number; feed?: number; operation: string }

export function depthPasses(total: number, step: number): number[] {
  if (!Number.isFinite(total) || !Number.isFinite(step) || total <= 0 || step <= 0) throw new Error('Depth and stepdown must be positive.');
  const count = Math.ceil(total / step);
  if (count > 10000) throw new Error('Too many depth passes.');
  return Array.from({ length: count }, (_, i) => Math.min(total, (i + 1) * step));
}

export function generateProfiles(mesh: Mesh, s: Settings, operations: ProfileOperation[], progress: (fraction: number) => void = () => {}): ToolpathSegment[] {
  const errors = validateSettings(s);
  if (errors.length) throw new Error(errors.join(' '));
  const enabled = operations.filter(op => op.enabled);
  if (!enabled.length) throw new Error('Enable at least one operation.');
  const corners = [mesh.min[0], mesh.max[0]].flatMap(x => [mesh.min[1], mesh.max[1]].flatMap(y =>
    [mesh.min[2], mesh.max[2]].map(z => transformPoint(x, y, z, mesh, s))));
  if (corners.some(([x, y, z]) => x < -1e-7 || x > s.stockX + 1e-7 || y < -1e-7 || y > s.stockY + 1e-7 || z < -s.stockZ - 1e-7 || z > 1e-7)) {
    throw new Error('The positioned model extends outside the stock.');
  }
  const segments: ToolpathSegment[] = [];
  for (const [index, op] of enabled.entries()) {
    if (!isPlanarMesh(mesh) && (!Number.isFinite(op.sliceZ) || op.sliceZ >= 0 || op.sliceZ <= -s.stockZ)) throw new Error('Slice height must be inside the stock.');
    if (!Number.isFinite(op.depth) || op.depth > s.stockZ || op.depth > s.fluteLength) throw new Error('Cut depth exceeds stock thickness or flute length.');
    if (!Number.isFinite(op.stepdown) || op.stepdown > s.maxStepdown) throw new Error('Stepdown exceeds the tool maximum.');
    if (!Number.isFinite(op.allowance) || op.allowance < 0) throw new Error('Finishing allowance must be non-negative.');
    const depths = depthPasses(op.depth, op.stepdown);
    const slice = isPlanarMesh(mesh) ? planarContours(mesh, s) : sliceMesh(mesh, s, op.sliceZ);
    const radius = s.toolDiameter / 2;
    if (op.kind !== 'profile' && op.kind !== 'pocket') throw new Error('Unknown operation type.');
    const offset = op.kind === 'pocket' ? -radius : op.side === 'outside' ? radius : op.side === 'inside' ? -radius : 0;
    const roughOffset = offset + (op.kind === 'pocket' || op.side === 'inside' ? -op.allowance : op.allowance);
    const rough = offsetPolygons(slice, roughOffset);
    const finish = op.allowance > 0 ? offsetPolygons(slice, offset) : rough;
    const pocketLoops = [...rough];
    if (op.kind === 'pocket') {
      if (!Number.isFinite(op.stepover) || op.stepover <= 0 || op.stepover > 50) throw new Error('Pocket stepover must be greater than 0% and no more than 50%.');
      const step = s.toolDiameter * op.stepover / 100;
      let completed = false;
      for (let i = 1; i <= 10000; i++) {
        const next = offsetPolygons(slice, roughOffset - i * step, true);
        if (!next.length) { completed = true; break; }
        pocketLoops.push(...next);
      }
      if (!completed) throw new Error('Pocket requires too many offset passes.');
    }
    const cutLoops = (loops: typeof rough, depth: number) => {
      for (const original of loops) {
        const loop = op.direction === 'conventional' ? [...original].reverse() : original;
        if (loop.some(p => p.x < 0 || p.y < 0 || p.x > s.stockX || p.y > s.stockY)) throw new Error('Toolpath moves outside the stock XY bounds.');
        const start = loop[0];
        segments.push({ type: 'rapid', x: start.x, y: start.y, z: s.clearanceZ, operation: op.id });
        segments.push({ type: 'cut', x: start.x, y: start.y, z: -depth, feed: s.plunge, operation: op.id });
        for (const point of [...loop.slice(1), start]) segments.push({ type: 'cut', x: point.x, y: point.y, z: -depth, feed: s.feed, operation: op.id });
        segments.push({ type: 'rapid', x: start.x, y: start.y, z: s.clearanceZ, operation: op.id });
      }
    };
    for (const depth of depths) {
      cutLoops(op.kind === 'pocket' ? pocketLoops : rough, depth);
      if (op.allowance > 0) cutLoops(finish, depth);
    }
    if (op.spring) cutLoops(finish, op.depth);
    progress((index + 1) / enabled.length);
  }
  return segments;
}
