import { describe, expect, it } from 'vitest';
import { offsetPolygons } from '../geometry/slice';
import { depthPasses } from './profile';

describe('profile toolpaths', () => {
  it('clamps the final depth pass', () => expect(depthPasses(10, 3)).toEqual([3, 6, 9, 10]));
  it('offsets a square by the tool radius in either direction', () => {
    const square = [[{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }]];
    const range = (distance: number) => {
      const points = offsetPolygons(square, distance).flat();
      return [Math.min(...points.map(p => p.x)), Math.max(...points.map(p => p.x))];
    };
    expect(range(3)).toEqual([-3, 23]);
    expect(range(-3)).toEqual([3, 17]);
  });
});
