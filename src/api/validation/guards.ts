export const isStringArray = (len: number) => (val: unknown): val is string[] => 
  Array.isArray(val) && val.length === len && val.every(v => typeof v === 'string');

export const isUint8Array = (len: number) => (val: unknown): val is number[] => 
  Array.isArray(val) && val.length === len && val.every(v => typeof v === 'number' && v >= 0 && v <= 255);

export const isString = (val: unknown): val is string => typeof val === 'string';

export const isNumberArray = (val: unknown): val is number[] => 
  Array.isArray(val) && val.every(v => typeof v === 'number');

export const isAffinePoint2d = (val: unknown): boolean => {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return 'x' in obj && 'y' in obj && isString(obj.x) && isString(obj.y);
};

export const isComplexAffinePoint2d = (val: unknown): boolean => {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return (
    'x_c0' in obj && 'x_c1' in obj && 'y_c0' in obj && 'y_c1' in obj &&
    isString(obj.x_c0) && isString(obj.x_c1) && isString(obj.y_c0) && isString(obj.y_c1)
  );
};

export const isField12 = (val: unknown): boolean => {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  const keys = ['g00', 'g01', 'g10', 'g11', 'g20', 'g21', 'h00', 'h01', 'h10', 'h11', 'h20', 'h21'];
  return keys.every(key => key in obj && isString(obj[key]));
};