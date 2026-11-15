import { describe, expect, it } from 'vitest';
import { parseSTL } from './parser';

describe('STL parsing', () => {
  it('parses ASCII triangles and reports open edges', () => {
    const text = 'solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t';
    const mesh = parseSTL(new TextEncoder().encode(text).buffer);
    expect(mesh.triangles).toBe(1);
    expect(mesh.max).toEqual([1, 1, 0]);
    expect(mesh.nonManifoldEdges).toBe(3);
  });
  it('parses binary triangles even with a solid header', () => {
    const buffer = new ArrayBuffer(134);
    const view = new DataView(buffer);
    new Uint8Array(buffer).set(new TextEncoder().encode('solid binary'));
    view.setUint32(80, 1, true);
    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => view.setFloat32(96 + i * 4, v, true));
    expect(parseSTL(buffer).triangles).toBe(1);
  });
  it('rejects empty and degenerate meshes', () => {
    expect(() => parseSTL(new ArrayBuffer(0))).toThrow(/empty/);
    expect(() => parseSTL(new TextEncoder().encode('solid x facet normal 0 0 1 vertex 0 0 0 vertex 0 0 0 vertex 0 0 0 endfacet endsolid').buffer)).toThrow(/degenerate/);
  });
});
