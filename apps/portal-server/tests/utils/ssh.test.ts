import { constructCommand } from "@scow/lib-ssh";

it.each([
  [["test", [], {}], "test"],
  [["test", ["-a", "123"], {}], "test -a 123"],
  [["test", ["-a", '"123"'], {}], "test -a '\"123\"'"],
  [["test", ["-a", '"123"'], { TEST: "test", QUOTE: '"QUOTE"' }], "TEST=test QUOTE='\"QUOTE\"' test -a '\"123\"'"],
  [["test", ["-a", '"123"'], { SPACE: "' SPACE '" }], "SPACE=\"' SPACE '\" test -a '\"123\"'"],
] as const)("test construct env command", ([cmd, parameters, env], expected) => {
  expect(constructCommand(cmd, parameters, env)).toBe(expected);
});
