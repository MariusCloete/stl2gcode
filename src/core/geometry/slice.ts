import ClipperLib from 'clipper-lib';
import type { Mesh } from '../stl/parser';
import type { Settings } from '../settings';

export type Point = { x: number; y: number };
export type Polygon = Point[];
const precision = 100000;

function isDegenerateTriangle(p: Float32Array, i: number): boolean {
  const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
  const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
  return Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) < 1e-12;
}

export function transformPoint(x: number, y: number, z: number, mesh: Mesh, s: Settings): [number, number, number] {
  const factor = s.scale * (s.modelUnits === s.units ? 1 : s.modelUnits === 'inch' ? 25.4 : 1 / 25.4);
  x = (x - (mesh.min[0] + mesh.max[0]) / 2) * factor;
  y = (y - (mesh.min[1] + mesh.max[1]) / 2) * factor * (s.flip ? -1 : 1);
  z = (s.flip ? mesh.min[2] - z : z - mesh.max[2]) * factor + s.modelZ;
  const angle = s.rotation * Math.PI / 180;
  return [s.stockX / 2 + x * Math.cos(angle) - y * Math.sin(angle),
    s.stockY / 2 + x * Math.sin(angle) + y * Math.cos(angle), z];
}

export function sliceMesh(mesh: Mesh, s: Settings, z: number): Polygon[] {
  const vertices = new Map<string, Point>();
  const adjacency = new Map<string, string[]>();
  const pointKey = (p: Point) => `${Math.round(p.x * precision)},${Math.round(p.y * precision)}`;
  const add = (a: Point, b: Point) => {
    const ka = pointKey(a), kb = pointKey(b);
    if (ka === kb) return;
    vertices.set(ka, a); vertices.set(kb, b);
    adjacency.set(ka, [...(adjacency.get(ka) ?? []), kb]);
    adjacency.set(kb, [...(adjacency.get(kb) ?? []), ka]);
  };
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 9) {
    if (isDegenerateTriangle(p, i)) continue;
    const triangle = [0, 3, 6].map(j => transformPoint(p[i + j], p[i + j + 1], p[i + j + 2], mesh, s));
    const intersections: Point[] = [];
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      if (Math.abs(a[2] - z) < 1e-8) throw new Error('Slice crosses a mesh vertex or face; choose a different slice height.');
      if ((a[2] < z) !== (b[2] < z)) {
        const t = (z - a[2]) / (b[2] - a[2]);
        intersections.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t });
      }
    }
    if (intersections.length === 2) add(intersections[0], intersections[1]);
  }
  if (!adjacency.size) throw new Error('No contour at this slice height.');
  if ([...adjacency.values()].some(neighbors => neighbors.length !== 2)) throw new Error('Slice does not form closed contours. Check the mesh or choose a different slice height.');
  const loops: Polygon[] = [];
  const visited = new Set<string>();
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const loop: Polygon = [];
    let current = start, previous = '';
    do {
      if (visited.has(current)) throw new Error('Slice contour intersects itself.');
      visited.add(current);
      loop.push(vertices.get(current)!);
      const next = adjacency.get(current)!.find(n => n !== previous)!;
      previous = current; current = next;
    } while (current !== start);
    if (loop.length < 3) throw new Error('Slice contains an invalid contour.');
    loops.push(loop);
  }
  return loops;
}

export function planarContours(mesh: Mesh, s: Settings): Polygon[] {
  const paths: ClipperLib.Paths = [];
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 9) {
    if (isDegenerateTriangle(p, i)) continue;
    const triangle = [0, 3, 6].map(j => {
      const [x, y] = transformPoint(p[i + j], p[i + j + 1], p[i + j + 2], mesh, s);
      const X = Math.round(x * precision), Y = Math.round(y * precision);
      if (!Number.isSafeInteger(X) || !Number.isSafeInteger(Y) || Math.abs(X) > 1e12 || Math.abs(Y) > 1e12) {
        throw new Error('Coordinates are too large for polygon offsetting.');
      }
      return { X, Y };
    });
    const area = ClipperLib.Clipper.Area(triangle);
    if (area === 0) throw new Error('A planar triangle is too small to resolve at the current scale.');
    if (area < 0) triangle.reverse();
    paths.push(triangle);
  }
  if (!paths.length) throw new Error('The planar mesh has no usable triangles.');
  const clipper = new ClipperLib.Clipper();
  clipper.StrictlySimple = true;
  clipper.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const result: ClipperLib.Paths = [];
  if (!clipper.Execute(ClipperLib.ClipType.ctUnion, result, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero) || !result.length) {
    throw new Error('Could not form closed outlines from the planar mesh.');
  }
  return result.map(path => path.map(p => ({ x: p.X / precision, y: p.Y / precision })));
}

export function offsetPolygons(polygons: Polygon[], distance: number, allowEmpty = false): Polygon[] {
  const paths = polygons.map(path => path.map(p => ({ X: Math.round(p.x * precision), Y: Math.round(p.y * precision) })));
  if (paths.some(path => path.some(p => Math.abs(p.X) > 1e12 || Math.abs(p.Y) > 1e12))) throw new Error('Coordinates are too large for polygon offsetting.');
  const clipper = new ClipperLib.Clipper();
  clipper.StrictlySimple = true;
  clipper.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const normalized: ClipperLib.Paths = [];
  if (!clipper.Execute(ClipperLib.ClipType.ctUnion, normalized, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd)) throw new Error('Could not resolve slice contours.');
  const result: ClipperLib.Paths = [];
  if (distance === 0) result.push(...normalized);
  else {
    const offset = new ClipperLib.ClipperOffset(2, 0.01 * precision);
    offset.AddPaths(normalized, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    offset.Execute(result, distance * precision);
  }
  if (!result.length && !allowEmpty) throw new Error('Tool offset eliminated the contour; the feature may be too small.');
  return result.map(path => path.map(p => ({ x: p.X / precision, y: p.Y / precision })));
}
