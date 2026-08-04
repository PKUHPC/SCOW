import { status } from "@grpc/grpc-js";

import { resolveSubmitJobWorkingDirectory } from "src/clusterops/job/workingDirectory";

const catchError = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error("Expected function to throw");
};

describe("resolveSubmitJobWorkingDirectory", () => {
  const homeDir = "/home/user";

  it("resolves relative paths under user home directory", () => {
    expect(resolveSubmitJobWorkingDirectory("relative/path", homeDir)).toBe("/home/user/relative/path");
  });

  it("keeps absolute paths under user home directory", () => {
    expect(resolveSubmitJobWorkingDirectory("/home/user/work", homeDir)).toBe("/home/user/work");
  });

  it("rejects paths outside user home directory", () => {
    expect(catchError(() => resolveSubmitJobWorkingDirectory("/home/other/work", homeDir))).toEqual(
      expect.objectContaining({ code: status.INVALID_ARGUMENT }),
    );
  });

  it("rejects traversal and unsafe characters", () => {
    expect(catchError(() => resolveSubmitJobWorkingDirectory("../work", homeDir))).toEqual(
      expect.objectContaining({ code: status.INVALID_ARGUMENT }),
    );
    expect(catchError(() => resolveSubmitJobWorkingDirectory("bad path", homeDir))).toEqual(
      expect.objectContaining({ code: status.INVALID_ARGUMENT }),
    );
    expect(catchError(() => resolveSubmitJobWorkingDirectory("bad;path", homeDir))).toEqual(
      expect.objectContaining({ code: status.INVALID_ARGUMENT }),
    );
  });
});
