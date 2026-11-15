export type Units = 'mm' | 'inch';
export interface Settings {
  units: Units;
  modelUnits: Units;
  scale: number;
  rotation: number;
  flip: boolean;
  stockX: number;
  stockY: number;
  stockZ: number;
  modelZ: number;
  originXY: 'corner' | 'center';
  originZ: 'top' | 'bottom';
  safeZ: number;
  clearanceZ: number;
  toolDiameter: number;
  fluteLength: number;
  maxStepdown: number;
  spindle: number;
  feed: number;
  plunge: number;
}

export const defaultSettings: Settings = {
  units: 'mm', modelUnits: 'mm', scale: 1, rotation: 0, flip: false,
  stockX: 400, stockY: 400, stockZ: 20, modelZ: 0,
  originXY: 'corner', originZ: 'top', safeZ: 5, clearanceZ: 5,
  toolDiameter: 6, fluteLength: 20, maxStepdown: 2, spindle: 18000, feed: 1000, plunge: 300,
};

export function validateSettings(s: Settings): string[] {
  const errors: string[] = [];
  for (const [label, value] of Object.entries({
    'Scale': s.scale, 'Stock X': s.stockX, 'Stock Y': s.stockY, 'Stock Z': s.stockZ,
    'Safe height': s.safeZ, 'Clearance height': s.clearanceZ, 'Tool diameter': s.toolDiameter,
    'Flute length': s.fluteLength, 'Maximum stepdown': s.maxStepdown, 'Spindle speed': s.spindle,
    'Feed rate': s.feed, 'Plunge rate': s.plunge,
  })) if (!Number.isFinite(value) || value <= 0) errors.push(`${label} must be greater than zero.`);
  if (!Number.isFinite(s.modelZ) || s.modelZ > 0 || s.modelZ < -s.stockZ) errors.push('Model Z must lie between the stock bottom and top.');
  if (s.clearanceZ < s.safeZ) errors.push('Clearance height must be at least the safe height.');
  return errors;
}
