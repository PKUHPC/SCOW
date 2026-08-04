import {
  normalizePathForValidation,
  validateContainerMountTargetPath,
  validateHomeScopedPath,
  validateLinuxAbsolutePath,
  validateRelativeToHomePath,
  validateSafePath,
} from "src/pathValidation";

describe("path validation", () => {
  const homeDir = "/home/user";

  it("normalizes repeated slashes without using Node path APIs", () => {
    expect(normalizePathForValidation("//home//user//work/")).toBe("/home/user/work");
    expect(normalizePathForValidation("project//run1/")).toBe("project/run1");
  });

  it("accepts safe paths for supported scenarios", () => {
    expect(validateRelativeToHomePath("project/run1", homeDir)).toBeUndefined();
    expect(validateRelativeToHomePath("/home/user", homeDir)).toBeUndefined();
    expect(validateHomeScopedPath("/home/user/work", homeDir)).toBeUndefined();
    expect(validateContainerMountTargetPath("/workspace/data")).toBeUndefined();
    expect(validateLinuxAbsolutePath("/data/file")).toBeUndefined();
  });

  it("rejects unsafe characters and traversal segments", () => {
    expect(validateSafePath("../x")).toBeDefined();
    expect(validateSafePath("a b")).toBeDefined();
    expect(validateSafePath("a;rm")).toBeDefined();
  });

  it("rejects paths outside home directory", () => {
    expect(validateHomeScopedPath("/home/other/x", homeDir)).toBeDefined();
    expect(validateRelativeToHomePath("/home/other/x", homeDir)).toBeDefined();
    expect(validateHomeScopedPath("//home//other/x", homeDir)).toBeDefined();
  });

  it("rejects invalid container mount targets", () => {
    expect(validateContainerMountTargetPath("/")).toBeDefined();
    expect(validateContainerMountTargetPath("/etc/passwd")).toBeDefined();
    expect(validateContainerMountTargetPath("/usr/local")).toBeDefined();
    expect(validateContainerMountTargetPath("workspace/data")).toBeDefined();
  });

  it("normalizes repeated slashes before checking forbidden container mount targets", () => {
    expect(validateContainerMountTargetPath("//etc/aa")).toBeDefined();
    expect(validateContainerMountTargetPath("///usr/local")).toBeDefined();
    expect(validateContainerMountTargetPath("/var//log")).toBeDefined();
    expect(validateContainerMountTargetPath("/workspace//data")).toBeUndefined();
  });

  it("rejects current directory segments where absolute scoped validation requires it", () => {
    expect(validateLinuxAbsolutePath("/home/user/./work")).toBeDefined();
    expect(validateHomeScopedPath("/home/user/./work", homeDir)).toBeDefined();
    expect(validateContainerMountTargetPath("/workspace/./data")).toBeDefined();
  });
});
