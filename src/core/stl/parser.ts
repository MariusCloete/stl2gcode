export interface Mesh {
  positions: Float32Array;
  normals: Float32Array;
  min: [number, number, number];
  max: [number, number, number];
  triangles: number;
  degenerate: number;
  nonManifoldEdges: number;
}

export function isPlanarMesh(mesh: Mesh): boolean {
  return mesh.min[2] === mesh.max[2];
}

export function parseSTL(buffer: ArrayBuffer): Mesh {
  if (!buffer.byteLength) throw new Error('The STL file is empty.');
  const view = new DataView(buffer);
  const count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  const binary = count > 0 && 84 + count * 50 === buffer.byteLength;
  let positions: Float32Array;
  if (binary) {
    positions = new Float32Array(count * 9);
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < 9; j++) positions[i * 9 + j] = view.getFloat32(84 + i * 50 + 12 + j * 4, true);
    }
  } else {
    const text = new TextDecoder().decode(buffer);
    if (!/^\s*solid(?:\s|$)/i.test(text) || !/\bendsolid\b/i.test(text)) {
      throw new Error('Invalid or truncated STL file.');
    }
    const vertices = [...text.matchAll(/\bvertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/gi)];
    if (!vertices.length || vertices.length % 3 !== 0 ||
        (text.match(/\bfacet\s+normal\b/gi)?.length ?? 0) !== vertices.length / 3 ||
        (text.match(/\bendfacet\b/gi)?.length ?? 0) !== vertices.length / 3) {
      throw new Error('The STL has no complete triangles.');
    }
    positions = Float32Array.from(vertices.flatMap(v => [Number(v[1]), Number(v[2]), Number(v[3])]));
  }
  const min: Mesh['min'] = [Infinity, Infinity, Infinity];
  const max: Mesh['max'] = [-Infinity, -Infinity, -Infinity];
  let degenerate = 0;
  const normals = new Float32Array(positions.length);
  const edges = new Map<string, number>();
  const key = (i: number) => `${positions[i]},${positions[i + 1]},${positions[i + 2]}`;
  for (let i = 0; i < positions.length; i += 9) {
    for (let j = 0; j < 9; j++) {
      const value = positions[i + j];
      if (!Number.isFinite(value)) throw new Error('The STL contains invalid coordinates.');
      min[j % 3] = Math.min(min[j % 3], value);
      max[j % 3] = Math.max(max[j % 3], value);
    }
    const ax = positions[i + 3] - positions[i], ay = positions[i + 4] - positions[i + 1], az = positions[i + 5] - positions[i + 2];
    const bx = positions[i + 6] - positions[i], by = positions[i + 7] - positions[i + 1], bz = positions[i + 8] - positions[i + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-12) degenerate++;
    else for (let j = 0; j < 9; j += 3) {
      normals[i + j] = nx / length; normals[i + j + 1] = ny / length; normals[i + j + 2] = nz / length;
    }
    const points = [key(i), key(i + 3), key(i + 6)];
    for (let j = 0; j < 3; j++) {
      const edge = [points[j], points[(j + 1) % 3]].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  if (degenerate === positions.length / 9) throw new Error('The mesh contains only degenerate triangles.');
  let nonManifoldEdges = 0;
  for (const n of edges.values()) if (n !== 2) nonManifoldEdges++;
  return { positions, normals, min, max, triangles: positions.length / 9, degenerate, nonManifoldEdges };
}
