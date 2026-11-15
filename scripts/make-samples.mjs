import { mkdirSync, writeFileSync } from 'node:fs';

const samples = new URL('../public/samples/', import.meta.url);
mkdirSync(samples, { recursive: true });

function save(name, triangles) {
  const facets = triangles.map(triangle => `facet normal 0 0 0\n outer loop\n${triangle.map(p => `  vertex ${p.join(' ')}`).join('\n')}\n endloop\nendfacet`).join('\n');
  writeFileSync(new URL(`${name}.stl`, samples), `solid ${name}\n${facets}\nendsolid ${name}\n`);
}

function block(top) {
  const bottom = [[0, 0, 0], [20, 0, 0], [20, 20, 0], [0, 20, 0]];
  const p = [...bottom, ...top];
  return [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]].map(face => face.map(i => p[i]));
}
save('cube-20mm', block([[0, 0, 20], [20, 0, 20], [20, 20, 20], [0, 20, 20]]));
save('relief', block([[0, 0, 10], [20, 0, 12], [20, 20, 18], [0, 20, 16]]));

const cylinder = [];
const n = 32;
for (let i = 0; i < n; i++) {
  const point = (index, z) => {
    const angle = 2 * Math.PI * (index % n) / n;
    return [Number((10 + 10 * Math.cos(angle)).toFixed(6)), Number((10 + 10 * Math.sin(angle)).toFixed(6)), z];
  };
  const a = point(i, 0), b = point(i + 1, 0), c = point(i + 1, 20), d = point(i, 20);
  cylinder.push([a, b, c], [a, c, d], [[10, 10, 0], b, a], [[10, 10, 20], d, c]);
}
save('cylinder-20mm', cylinder);
