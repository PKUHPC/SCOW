import { StorageEntrySchema } from "@scow/config/build/cluster";
import { normPath } from "@scow/utils";
import { isUserPrivateEntryPath, isParentOrSameFolder } from "src/utils/filePath";

// ─── normPath ───────────────────────────────────────────────────────────

describe("normPath", () => {
  it("collapses consecutive slashes", () => {
    expect(normPath("/home//user///data")).toBe("/home/user/data");
  });

  it("leaves a normal path unchanged", () => {
    expect(normPath("/home/user/data")).toBe("/home/user/data");
  });

  it("preserves a leading single slash", () => {
    expect(normPath("/data")).toBe("/data");
  });
});

// ─── isParentOrSameFolder ────────────────────────────────────────────────────

describe("isParentOrSameFolder", () => {
  it("returns true when paths are identical", () => {
    expect(isParentOrSameFolder("/home/user", "/home/user")).toBe(true);
  });

  it("returns true for an immediate child", () => {
    expect(isParentOrSameFolder("/home/user", "/home/user/docs")).toBe(true);
  });

  it("returns true for a deeply nested child", () => {
    expect(isParentOrSameFolder("/home", "/home/user/a/b/c")).toBe(true);
  });

  it("returns false when parent is not a prefix of child", () => {
    expect(isParentOrSameFolder("/home/user2", "/home/user/docs")).toBe(false);
  });

  it("does not match when child only shares a name prefix (not a directory boundary)", () => {
    // /home/user should NOT match /home/username
    expect(isParentOrSameFolder("/home/user", "/home/username")).toBe(false);
  });

  it("normPaths .. in paths before comparing", () => {
    // /home/user/../user is the same as /home/user
    expect(isParentOrSameFolder("/home/user", "/home/user/../user")).toBe(true);
  });
});

// ─── isUserPrivateEntryPath ──────────────────────────────────────────────────

/** Helper to build a minimal StorageEntrySchema for tests */
function makeEntry(mountPath: string, pathTemplate: string): StorageEntrySchema {
  return {
    storageId: "test-storage",
    mountPath,
    paths: [
      {
        displayName: { i18n: { default: "Test Path" } },
        pathTemplate,
      },
    ],
  };
}

describe("isUserPrivateEntryPath", () => {
  it("returns true for an exact match of a {{userId}} template", () => {
    const entryPaths = [makeEntry("/data", "/data/{{userId}}")];
    expect(isUserPrivateEntryPath(entryPaths, "alice", "/data/alice")).toBe(true);
  });

  it("returns true when template also contains {{mountPath}}", () => {
    const entryPaths = [makeEntry("/mnt/storage", "{{mountPath}}/users/{{userId}}")];
    expect(isUserPrivateEntryPath(entryPaths, "bob", "/mnt/storage/users/bob")).toBe(true);
  });

  it("returns false when the path is a child of the private path, not the path itself", () => {
    const entryPaths = [makeEntry("/data", "/data/{{userId}}")];
    expect(isUserPrivateEntryPath(entryPaths, "alice", "/data/alice/subdir")).toBe(false);
  });

  it("returns false when template does not contain {{userId}}", () => {
    const entryPaths = [makeEntry("/shared", "/shared/public")];
    expect(isUserPrivateEntryPath(entryPaths, "alice", "/shared/public")).toBe(false);
  });

  it("returns false when entryPaths is undefined", () => {
    expect(isUserPrivateEntryPath(undefined, "alice", "/data/alice")).toBe(false);
  });

  it("returns false when entryPaths is an empty array", () => {
    expect(isUserPrivateEntryPath([], "alice", "/data/alice")).toBe(false);
  });

  it("returns false for a non-matching path", () => {
    const entryPaths = [makeEntry("/data", "/data/{{userId}}")];
    expect(isUserPrivateEntryPath(entryPaths, "alice", "/data/mallory")).toBe(false);
  });

  it("is not fooled by a path with .. segments (no normalization normPaths ..)", () => {
    // normPath only collapses // — it does NOT normPath ".."
    // So "/data/alice/../alice" does NOT equal "/data/alice" after normPath.
    // This test documents the current behavior: path traversal via .. is NOT collapsed.
    const entryPaths = [makeEntry("/data", "/data/{{userId}}")];
    expect(isUserPrivateEntryPath(entryPaths, "alice", "/data/alice/../alice")).toBe(false);
  });

  it("is not fooled by double slashes in the target path", () => {
    // normPath collapses // so //data//alice becomes /data/alice
    const entryPaths = [makeEntry("/data", "/data/{{userId}}")];
    expect(isUserPrivateEntryPath(entryPaths, "alice", "//data//alice")).toBe(true);
  });

  it("is not fooled by a userId that embeds path separators", () => {
    // If an attacker supplies userId = "alice/../../root", the normPathd template
    // would be "/data/alice/../../root".  normPath only collapses slashes,
    // so the result is "/data/alice/../../root" — which does NOT equal any real
    // private path.  This test documents that the function is safe for injection
    // at the comparison layer (isUserPrivateEntryPath returns false).
    const entryPaths = [makeEntry("/data", "/data/{{userId}}")];
    expect(isUserPrivateEntryPath(entryPaths, "alice/../../root", "/root")).toBe(false);
  });

  it("returns false when userId is empty and path does not match the resulting template", () => {
    const entryPaths = [makeEntry("/data", "/data/{{userId}}")];
    // With empty userId the normPathd template becomes "/data/" which after normalization is "/data/"
    expect(isUserPrivateEntryPath(entryPaths, "", "/data")).toBe(false);
  });

  it("matches the first entry in a multi-entry list", () => {
    const entryPaths = [makeEntry("/data", "/data/{{userId}}"), makeEntry("/scratch", "/scratch/{{userId}}")];
    expect(isUserPrivateEntryPath(entryPaths, "carol", "/data/carol")).toBe(true);
  });

  it("matches a later entry in a multi-entry list", () => {
    const entryPaths = [makeEntry("/data", "/data/{{userId}}"), makeEntry("/scratch", "/scratch/{{userId}}")];
    expect(isUserPrivateEntryPath(entryPaths, "carol", "/scratch/carol")).toBe(true);
  });
});
