export function isServer() {
  return typeof window === "undefined";
}

export function isFormData(a: any): a is FormData {
  return !isServer() && a instanceof FormData;
}
