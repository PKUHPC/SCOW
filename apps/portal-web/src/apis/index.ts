import { mockApi } from "src/apis/api.mock";
import { USE_MOCK } from "src/apis/useMock";
import { delay } from "src/utils/delay";

import { api as realApi } from "./api";

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
      const promise = new Promise((res) => {
        console.log(`Calling API ${fn.name}, args ${JSON.stringify(args)}`);
        delay(500).then(() => res(fn(...args)));
      });
      // @ts-ignore
      promise.httpError = () => {
        return promise;
      };
      return promise;
    };

    mockApi[k] = newFn;
  }
}

// changing this line during development to set USE_MOCK dynamically

// judge whether USE_MOCK here can help reduce the size of bundle
// by tree shaking mock modules at production build
// @ts-ignore
export const api: typeof realApi = USE_MOCK ? { ...realApi, ...mockApi } : realApi;
