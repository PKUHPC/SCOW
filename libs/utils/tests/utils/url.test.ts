import { joinWithUrl, normalizePathnameWithQuery } from "src/url";

it.each([
  [["http://example.com", "foo"], "http://example.com/foo"],
  [["example.com", "foo"], "example.com/foo"],
  [["http://example.com/test", "foo"], "http://example.com/test/foo"],
  [["example.com/test", "foo"], "example.com/test/foo"],
  [["http://example.com:8080/test?ok=3", "foo"], "http://example.com:8080/test/foo?ok=3"],
  [["example.com:8080/test?test=1", "foo", "test/32"], "example.com:8080/test/foo/test/32?test=1"],
  [["/example/test", "foo/test"], "/example/test/foo/test"],
])("should join %o to %o", ([base, ...paths], expected) => {
  expect(joinWithUrl(base, ...paths)).toBe(expected);
});

it.each([
  ["/test//test", "/test/test"],
  ["/test//test/", "/test/test/"],
  ["/test//test?test=ok", "/test/test?test=ok"],
  ["/test//test?test=ok/test//a", "/test/test?test=ok/test//a"],
])("should normalize %o to %o", (pathname, expected) => {
  expect(normalizePathnameWithQuery(pathname)).toBe(expected);
});
