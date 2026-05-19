import { ConnectError } from "@connectrpc/connect";

export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Ensure that the values of any specified keys are not undefined
 *
 * @param obj the object
 * @param keys the property keys that must not be undefined
 * @returns the object
 * @throws ConnectError if the value of any key in keys are undefined
 */
export function ensureNotUndefined<TObj, TKeys extends keyof TObj>(obj: TObj, keys: TKeys[]): RequiredBy<TObj, TKeys> {
  for (const key of keys) {
    if (obj[key] === undefined) {
      throw new ConnectError(`Property ${String(key)} is undefined`);
    }
  }
  return obj as RequiredBy<TObj, TKeys>;
}
