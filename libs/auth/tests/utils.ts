export const mockFetch = (
  mock: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    status: number;
    text?: string;
    json?: object;
  },
) => {
  // @ts-ignore
  globalThis.fetch = jest.fn((input, init) => {
    const resp = mock(input as string, init);

    return {
      status: resp.status,
      text: async () => resp.text ?? "",
      json: async () => resp.json,
    };
  });
};
