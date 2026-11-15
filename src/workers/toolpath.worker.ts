import { generateProfiles, type ProfileOperation } from '../core/toolpath/profile';
import type { Mesh } from '../core/stl/parser';
import type { Settings } from '../core/settings';

self.onmessage = (event: MessageEvent<{ mesh: Mesh; settings: Settings; operations: ProfileOperation[] }>) => {
  try {
    const { mesh, settings, operations } = event.data;
    const segments = generateProfiles(mesh, settings, operations, fraction => self.postMessage({ progress: fraction }));
    self.postMessage({ segments });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Toolpath generation failed.' });
  }
};
