type RequiredBy<T, K extends keyof T> = Omit<T, K> & {
  [k in keyof Required<Pick<T, K>>]: NonNullable<T[k]>;
};

export function ensureNotUndefined<TObj, TKeys extends keyof TObj>(obj: TObj, keys: TKeys[]): RequiredBy<TObj, TKeys> {
  for (const key of keys) {
    if (obj[key] === undefined) {
      throw new Error(`Field ${String(key)} is undefined.`);
    }
  }

  return obj as any;
}
