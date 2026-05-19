export function range(start = 1, end = 0, step = 1): number[] {
  const r = [] as number[];
  for (let i = start; i < end; i += step) {
    r.push(i);
  }
  return r;
}

interface ObjectTypeWithType {
  type: string;
  [key: string]: any;
}

export function extractTypesFromObjects(array: ObjectTypeWithType[]): string[] {
  const types = new Set<string>();
  for (const item of array) {
    if (item.type) {
      types.add(item.type);
    }
  }
  return Array.from(types);
}
