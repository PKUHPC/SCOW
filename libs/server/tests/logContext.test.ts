import { extractLogContext, getActiveLogContext, runWithLogContext } from "src/logContext";

it("extracts only whitelisted log context fields", () => {
  expect(
    extractLogContext({
      userId: "user1",
      tenantName: "tenant1",
      accountName: "account1",
      cluster: "hpc01",
      clusterId: "hpc02",
      token: "secret",
      path: "/tmp/a",
    }),
  ).toEqual({
    userId: "user1",
    tenantName: "tenant1",
    accountName: "account1",
    cluster: "hpc01",
    clusterId: "hpc02",
  });
});

it("ignores empty and non-string log context field values", () => {
  expect(
    extractLogContext({
      userId: "",
      tenantName: "  ",
      accountName: undefined,
      cluster: 1,
      clusterId: "hpc01",
    }),
  ).toEqual({
    clusterId: "hpc01",
  });
});

it("returns an empty context for non-object input", () => {
  expect(extractLogContext(undefined)).toEqual({});
  expect(extractLogContext("user1")).toEqual({});
});

it("merges nested async log contexts", () => {
  runWithLogContext({ req: "req1", path: "/api/trpc" }, () => {
    expect(getActiveLogContext()).toEqual({ req: "req1", path: "/api/trpc" });

    runWithLogContext({ userId: "user1" }, () => {
      expect(getActiveLogContext()).toEqual({ req: "req1", path: "/api/trpc", userId: "user1" });
    });

    expect(getActiveLogContext()).toEqual({ req: "req1", path: "/api/trpc" });
  });
});
