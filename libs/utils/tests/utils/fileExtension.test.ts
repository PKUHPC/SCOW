import {
  areFileExtensionsValid,
  isValidFileExtension,
  matchesFileExtension,
  normalizeAsciiCase,
} from "src/fileExtension";

describe("file extension helpers", () => {
  it.each([
    [".sh", true],
    [".tar.gz", true],
    ["sh", false],
    [".", false],
    ["...", false],
    [".tar gz", false],
    [".tar/gz", false],
    [".tar\\gz", false],
  ])("validates extension %s", (extension, expected) => {
    expect(isValidFileExtension(extension)).toBe(expected);
  });

  it("rejects ASCII case-insensitive duplicate extensions", () => {
    expect(areFileExtensionsValid([".sh", ".PY"])).toBe(true);
    expect(areFileExtensionsValid([".sh", ".SH"])).toBe(false);
  });

  it("only normalizes ASCII uppercase characters", () => {
    expect(normalizeAsciiCase("AÄZ")).toBe("aÄz");
  });

  it.each([
    ["/home/user/a.sh", [".sh"], true],
    ["/home/user/a.SH", [".sh"], true],
    ["/home/user/a.tar.gz", [".tar.gz"], true],
    ["/home/user/a.tar.gz", [".gz"], true],
    ["/home/user/a.sh.bak", [".sh"], false],
    ["/home/user/.sh", [".sh"], false],
    ["/home/user/a.py", [], true],
  ])("matches %s against %j", (filePath, extensions, expected) => {
    expect(matchesFileExtension(filePath, extensions)).toBe(expected);
  });
});
