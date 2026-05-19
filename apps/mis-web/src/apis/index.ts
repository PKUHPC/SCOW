import type { HttpError } from "@ddadaal/next-typed-api-routes-runtime";

import { mockApi } from "src/apis/api.mock";
import { USE_MOCK } from "src/apis/useMock";
import { delay } from "src/utils/delay";

import { api as realApi } from "./api";

class MockPromise<T> implements PromiseLike<T> {
  constructor(
    private fn: (...args) => Promise<T>,
    private args: any[],
  ) {}

  errorHandlers = new Map<number, (e: HttpError) => any>();

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    console.log(`Calling API ${this.fn.name}, args ${JSON.stringify(this.args)}`);
    return delay(500).then(() => {
      return this.fn(...this.args)
        .then((r) => {
          return onfulfilled?.(r);
        }, onrejected)
        .catch((e) => {
          if (this.errorHandlers.has(e.status)) {
            return this.errorHandlers.get(e.status)!(e.data);
          } else {
            console.log("Error occurred", e);
            throw e;
          }
        });
    });
  }

  catch<TResult = T>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined,
  ): PromiseLike<T | TResult> {
    return this.then(undefined, onrejected);
  }

  httpError(code: number, handler: (e: HttpError) => any) {
    this.errorHandlers.set(code, handler);
    return this;
  }
}

if (USE_MOCK) {
  // filter out null mocks
  for (const k in mockApi) {
    const fn = mockApi[k];
    if (!fn) {
      delete mockApi[k];
      continue;
    }

    // add logging to the mock function
    const newFn = (...args: any) => {
      return new MockPromise(fn, args);
    };

    mockApi[k] = newFn;
  }
}

// changing this line during development to set USE_MOCK dynamically

// judge whether USE_MOCK here can help reduce the size of bundle
// by tree shaking mock modules at production build
// @ts-ignore
export const api: typeof realApi = USE_MOCK ? { ...realApi, ...mockApi } : realApi;
