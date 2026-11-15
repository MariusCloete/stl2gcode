import { parseSTL } from '../core/stl/parser';

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    const mesh = parseSTL(event.data);
    self.postMessage({ mesh }, { transfer: [mesh.positions.buffer, mesh.normals.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unable to parse STL.' });
  }
};
