import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSTL } from '../stl/parser';
import { defaultSettings as defaults } from '../settings';
import { generateProfiles, type ProfileOperation } from '../toolpath/profile';
import { offsetPolygons, planarContours, sliceMesh } from './slice';
import { generateGcode } from '../gcode/post';

function sample(name: string) {
  const data = readFileSync(new URL(`../../../public/samples/${name}.stl`, import.meta.url));
  return parseSTL(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}
const op: ProfileOperation = { id: 'profile', kind: 'profile', enabled: true, side: 'outside', sliceZ: -1, depth: 5, stepdown: 2, allowance: 0, spring: false, direction: 'climb', stepover: 40 };
const defaultSettings = { ...defaults, stockX: 40, stockY: 40 };
function flatMesh(triangles: number[][][]) {
  const facets = triangles.map(triangle => `facet normal 0 0 1\nouter loop\n${triangle.map(vertex => `vertex ${vertex.join(' ')}`).join('\n')}\nendloop\nendfacet`).join('\n');
  return parseSTL(new TextEncoder().encode(`solid flat\n${facets}\nendsolid flat`).buffer);
}
describe('mesh slicing and toolpaths', () => {
  it('uses 400 by 400 mm stock by default', () => {
    expect([defaults.units, defaults.stockX, defaults.stockY]).toEqual(['mm', 400, 400]);
  });
  it('slices a 20 mm cube and generates the required outside profile and passes', () => {
    const mesh = sample('cube-20mm');
    expect(mesh.nonManifoldEdges).toBe(0);
    const contours = sliceMesh(mesh, defaultSettings, -1);
    expect(contours).toHaveLength(1);
    const xs = contours[0].map(p => p.x);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([10, 30]);
    const path = generateProfiles(mesh, defaultSettings, [op]);
    const cuts = path.filter(s => s.type === 'cut');
    expect([...new Set(cuts.map(s => s.z))]).toEqual([-2, -4, -5]);
    expect([Math.min(...cuts.map(s => s.x)), Math.max(...cuts.map(s => s.x))]).toEqual([7, 33]);
    expect([Math.min(...cuts.map(s => s.y)), Math.max(...cuts.map(s => s.y))]).toEqual([7, 33]);
    expect(generateGcode(path, defaultSettings, [op], { dialect: 'GRBL', precision: 3, lineNumbers: false })).toContain('Z-5.000');
    path.forEach((s, i) => {
      if (s.type === 'rapid' && i && (s.x !== path[i - 1].x || s.y !== path[i - 1].y)) expect(path[i - 1].z).toBeGreaterThanOrEqual(defaultSettings.safeZ);
      expect(s.z).toBeGreaterThanOrEqual(-5);
    });
  });
  it('slices a cylinder into a single closed contour', () => {
    const mesh = sample('cylinder-20mm');
    expect(mesh.nonManifoldEdges).toBe(0);
    const contours = sliceMesh(mesh, defaultSettings, -1);
    expect(contours).toHaveLength(1);
    expect(Math.max(...contours[0].map(p => p.x))).toBeCloseTo(30);
    expect(Math.min(...contours[0].map(p => p.x))).toBeCloseTo(10);
  });
  it('clears a pocket at multiple concentric offsets', () => {
    const path = generateProfiles(sample('cube-20mm'), defaultSettings, [{ ...op, kind: 'pocket', depth: 2, stepover: 40 }]);
    const plunges = path.filter(segment => segment.type === 'cut' && segment.feed === defaultSettings.plunge);
    expect(plunges.length).toBeGreaterThan(1);
    expect(path.every(segment => segment.z >= -2)).toBe(true);
  });
  it('offsets holes in the opposite direction to the outer contour', () => {
    const square = (a: number, b: number) => [{ x: a, y: a }, { x: b, y: a }, { x: b, y: b }, { x: a, y: b }];
    const paths = offsetPolygons([square(0, 20), square(5, 15)], 3);
    const bounds = paths.map(p => [Math.min(...p.map(v => v.x)), Math.max(...p.map(v => v.x))]).sort((a, b) => a[0] - b[0]);
    expect(bounds).toEqual([[-3, 23], [8, 12]]);
  });
  it('performs finishing at each depth and a separate spring pass', () => {
    const path = generateProfiles(sample('cube-20mm'), defaultSettings, [{ ...op, allowance: 1, spring: true }]);
    const plunges = path.filter(s => s.type === 'cut' && s.feed === defaultSettings.plunge);
    expect(plunges.map(s => s.z)).toEqual([-2, -2, -4, -4, -5, -5, -5]);
  });
  it('rejects depths beyond the stock and flute length', () => {
    expect(() => generateProfiles(sample('cube-20mm'), defaultSettings, [{ ...op, depth: 21 }])).toThrow(/depth exceeds/i);
  });
  it('unions flat triangles regardless of winding and ignores degenerate triangles', () => {
    const mesh = flatMesh([
      [[0, 0, 0], [20, 0, 0], [20, 20, 0]],
      [[0, 0, 0], [0, 20, 0], [20, 20, 0]],
      [[0, 0, 0], [0, 0, 0], [20, 0, 0]],
      [[0, 0, 0], [20, 0, 0], [20, 20, 0]],
    ]);
    expect(mesh.nonManifoldEdges).toBeGreaterThan(0);
    expect(mesh.degenerate).toBe(1);
    const outline = planarContours(mesh, defaultSettings);
    expect(outline).toHaveLength(1);
    const path = generateProfiles(mesh, defaultSettings, [{ ...op, sliceZ: 0 }]);
    const cuts = path.filter(s => s.type === 'cut');
    expect([...new Set(cuts.map(s => s.z))]).toEqual([-2, -4, -5]);
    expect([Math.min(...cuts.map(s => s.x)), Math.max(...cuts.map(s => s.x))]).toEqual([7, 33]);
    expect([Math.min(...cuts.map(s => s.y)), Math.max(...cuts.map(s => s.y))]).toEqual([7, 33]);
    expect(generateGcode(path, defaultSettings, [op], { dialect: 'GRBL', precision: 3, lineNumbers: false })).toContain('Z-5.000');
    expect(generateProfiles(mesh, defaultSettings, [{ ...op, kind: 'pocket', depth: 2 }]).length).toBeGreaterThan(0);
  });
  it('preserves holes and separate islands in planar meshes', () => {
    const rectangle = (x1: number, y1: number, x2: number, y2: number) => [
      [[x1, y1, 0], [x2, y1, 0], [x2, y2, 0]],
      [[x1, y1, 0], [x2, y2, 0], [x1, y2, 0]],
    ];
    const mesh = flatMesh([
      ...rectangle(0, 0, 20, 5), ...rectangle(0, 15, 20, 20),
      ...rectangle(0, 5, 5, 15), ...rectangle(15, 5, 20, 15),
      ...rectangle(25, 0, 30, 5),
    ]);
    const outlines = planarContours(mesh, defaultSettings);
    expect(outlines).toHaveLength(3);
    expect(offsetPolygons(outlines, 0)).toHaveLength(3);
    expect(generateProfiles(mesh, defaultSettings, [{ ...op, side: 'on', depth: 2 }]).filter(s => s.feed === defaultSettings.plunge)).toHaveLength(3);
  });
  it('accepts a non-manifold solid when its slice is closed, and rejects an open slice', () => {
    const cube = sample('cube-20mm');
    const withoutTop = cube.positions.slice();
    const triangles = Array.from({ length: cube.triangles }, (_, i) => Array.from({ length: 3 }, (_, j) =>
      Array.from(withoutTop.slice(i * 9 + j * 3, i * 9 + j * 3 + 3))));
    const openTop = flatMesh(triangles.filter(tri => !tri.every(p => p[2] === 20)));
    expect(openTop.nonManifoldEdges).toBeGreaterThan(0);
    expect(generateProfiles(openTop, defaultSettings, [op]).length).toBeGreaterThan(0);
    const openSide = flatMesh(triangles.filter(tri => !tri.every(p => p[0] === 0)));
    expect(() => generateProfiles(openSide, defaultSettings, [op])).toThrow(/closed contours/);
  });
  it('still rejects planar models and offset toolpaths outside stock bounds', () => {
    const mesh = flatMesh([[[0, 0, 0], [40, 0, 0], [40, 40, 0]], [[0, 0, 0], [40, 40, 0], [0, 40, 0]]]);
    expect(() => generateProfiles(mesh, defaultSettings, [op])).toThrow(/outside the stock XY bounds/);
    expect(() => generateProfiles(mesh, { ...defaultSettings, scale: 2 }, [op])).toThrow(/model extends outside/);
  });
  it('applies scaling, rotation and flip to planar outlines', () => {
    const mesh = flatMesh([[[0, 0, 0], [10, 0, 0], [10, 20, 0]], [[0, 0, 0], [10, 20, 0], [0, 20, 0]]]);
    const path = generateProfiles(mesh, { ...defaultSettings, scale: 0.5, rotation: 90, flip: true }, [{ ...op, side: 'on', depth: 2 }]);
    const cuts = path.filter(s => s.type === 'cut');
    expect([Math.min(...cuts.map(s => s.x)), Math.max(...cuts.map(s => s.x))]).toEqual([15, 25]);
    expect([Math.min(...cuts.map(s => s.y)), Math.max(...cuts.map(s => s.y))]).toEqual([17.5, 22.5]);
  });
});
