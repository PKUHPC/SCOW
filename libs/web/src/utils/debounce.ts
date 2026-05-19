export function debounce<F extends (...args: any[]) => any>(
  func: F,
  interval = 200,
): (this: ThisParameterType<F>, ...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>) => {
    if (timer) {
      clearTimeout(timer);
    }
    return new Promise((resolve) => {
      timer = setTimeout(() => {
        const resp = func(...args);
        if (resp instanceof Promise) {
          void resp.then((v) => resolve(v));
        } else {
          resolve(resp);
        }
      }, interval);
    });
  };
}
