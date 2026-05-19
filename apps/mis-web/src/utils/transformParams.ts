export function emptyStringArrayToUndefined(arr: string[] | undefined) {
  if (Array.isArray(arr) && arr.length === 1 && arr[0] === "") {
    return undefined;
  }
  return arr;
}
