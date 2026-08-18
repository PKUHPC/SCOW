import { getCommonConfig } from "@scow/config/build/common";
import { promises as fsp } from "fs";
import { dump } from "js-yaml";
import { join } from "path";
import prompt from "prompts";
import { init } from "src/cmd/init";
import { logger } from "src/log";
import { ensureDirectoriesTheSame, testBaseFolder } from "tests/utils";

jest.mock("prompts", () => jest.fn());

const promptMock = jest.mocked(prompt);
const TOKEN_PLACEHOLDER = "must-change-this-scow-api-token";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const infoSpy = jest.spyOn(logger, "info").mockImplementation();
const warnSpy = jest.spyOn(logger, "warn").mockImplementation();

const getGeneratedToken = (outputPath: string) => getCommonConfig(join(outputPath, "config")).scowApi.auth.token;

const expectGeneratedToken = (token: string) => {
  expect(token).toMatch(TOKEN_PATTERN);
  expect(token).not.toBe(TOKEN_PLACEHOLDER);
};

const expectCommonConfigMatchesTemplate = async (
  outputPath: string,
  outputFilename: string,
  templatePath: string,
) => {
  const token = getGeneratedToken(outputPath);
  const [output, template] = await Promise.all([
    fsp.readFile(join(outputPath, "config", outputFilename), "utf8"),
    fsp.readFile(templatePath, "utf8"),
  ]);

  expect(output.replace(JSON.stringify(token), TOKEN_PLACEHOLDER)).toBe(template);
};

beforeEach(() => {
  promptMock.mockReset();
  infoSpy.mockClear();
  warnSpy.mockClear();
});

it("extracts init config to output path", async () => {
  await init({
    outputPath: testBaseFolder,
    full: false,
  });

  // testBaseFolder and configPath should be the same
  await ensureDirectoriesTheSame(testBaseFolder, "assets/init", ["config/common.yaml"]);
  const token = getGeneratedToken(testBaseFolder);
  expectGeneratedToken(token);
  await expectCommonConfigMatchesTemplate(testBaseFolder, "common.yaml", "assets/init/config/common.yaml");
  expect(infoSpy).toHaveBeenCalledWith(
    "Generated a new SCOW API token in %s",
    join(process.cwd(), testBaseFolder, "config/common.yaml"),
  );
  expect(infoSpy.mock.calls.flat()).not.toContain(token);
});

it("extracts init full config to output path", async () => {
  await init({
    outputPath: testBaseFolder,
    full: true,
  });

  // testBaseFolder and configPath should be the same
  await ensureDirectoriesTheSame(testBaseFolder, "assets/init-full", ["config/common.yml"]);
  expectGeneratedToken(getGeneratedToken(testBaseFolder));
  await expectCommonConfigMatchesTemplate(testBaseFolder, "common.yml", "assets/init-full/config/common.yml");
});

it("generates different tokens for separate initializations", async () => {
  const firstOutputPath = join(testBaseFolder, "first");
  const secondOutputPath = join(testBaseFolder, "second");
  await Promise.all([
    fsp.mkdir(firstOutputPath),
    fsp.mkdir(secondOutputPath),
  ]);

  await init({ outputPath: firstOutputPath, full: false });
  await init({ outputPath: secondOutputPath, full: false });

  const firstToken = getGeneratedToken(firstOutputPath);
  const secondToken = getGeneratedToken(secondOutputPath);
  expectGeneratedToken(firstToken);
  expectGeneratedToken(secondToken);
  expect(firstToken).not.toBe(secondToken);
});

it("preserves an existing token when overwriting config", async () => {
  await init({ outputPath: testBaseFolder, full: false });
  const existingToken = getGeneratedToken(testBaseFolder);
  promptMock.mockResolvedValue({ continue: true });

  await init({ outputPath: testBaseFolder, full: false });

  expect(getGeneratedToken(testBaseFolder)).toBe(existingToken);
  expect(infoSpy).toHaveBeenCalledWith(
    "Preserved existing SCOW API token from %s in %s",
    join(process.cwd(), testBaseFolder, "config/common.yaml"),
    join(process.cwd(), testBaseFolder, "config/common.yaml"),
  );
  expect(infoSpy.mock.calls.flat()).not.toContain(existingToken);
});

it.each([
  ["a colon and comment marker", "token: value # not a comment with enough length"],
  ["line breaks", "first line\nsecond line with enough length"],
  ["quotes and backslashes", 'a "quoted" token\\with\\slashes and enough length'],
])("safely preserves an existing token containing %s", async (_, existingToken) => {
  await init({ outputPath: testBaseFolder, full: false });
  const commonConfigPath = join(testBaseFolder, "config/common.yaml");
  const commonConfig = getCommonConfig(join(testBaseFolder, "config"));
  commonConfig.scowApi.auth.token = existingToken;
  await fsp.writeFile(commonConfigPath, dump(commonConfig));
  promptMock.mockResolvedValue({ continue: true });

  await init({ outputPath: testBaseFolder, full: false });

  expect(getGeneratedToken(testBaseFolder)).toBe(existingToken);
  expect(infoSpy.mock.calls.flat()).not.toContain(existingToken);
});

it("preserves the active token when switching from minimal to full config", async () => {
  await init({ outputPath: testBaseFolder, full: false });
  const existingToken = getGeneratedToken(testBaseFolder);
  promptMock.mockResolvedValue({ continue: true });

  await init({ outputPath: testBaseFolder, full: true });

  expect(getGeneratedToken(testBaseFolder)).toBe(existingToken);
});

it("does not use a token from a lower-priority common config", async () => {
  await init({ outputPath: testBaseFolder, full: false });
  const lowerPriorityToken = getGeneratedToken(testBaseFolder);
  await fsp.writeFile(join(testBaseFolder, "config/common.yml"), "scowApi:\n  auth:\n    token: \n");
  promptMock.mockResolvedValue({ continue: true });

  await init({ outputPath: testBaseFolder, full: true });

  const generatedToken = getGeneratedToken(testBaseFolder);
  expectGeneratedToken(generatedToken);
  expect(generatedToken).not.toBe(lowerPriorityToken);
});

it("preserves a token from an existing common.json", async () => {
  await init({ outputPath: testBaseFolder, full: false });
  const existingToken = getGeneratedToken(testBaseFolder);
  const configDir = join(testBaseFolder, "config");
  await fsp.rm(join(configDir, "common.yaml"));
  await fsp.writeFile(join(configDir, "common.json"), JSON.stringify({ scowApi: { auth: { token: existingToken } } }));
  promptMock.mockResolvedValue({ continue: true });

  await init({ outputPath: testBaseFolder, full: true });

  expect(getGeneratedToken(testBaseFolder)).toBe(existingToken);
});

it.each([
  ["an empty token", ""],
  ["a token shorter than 32 characters", "short-token"],
  ["a missing token", undefined],
  ["the placeholder token", TOKEN_PLACEHOLDER],
])("regenerates %s when overwriting config", async (_, invalidToken) => {
  await init({ outputPath: testBaseFolder, full: false });
  const commonConfigPath = join(testBaseFolder, "config/common.yaml");
  const originalToken = getGeneratedToken(testBaseFolder);
  let content = await fsp.readFile(commonConfigPath, "utf8");

  if (invalidToken === undefined) {
    content = content.replace(/^\s*token:.*\n/m, "");
  } else {
    content = content.replace(originalToken, invalidToken);
  }
  await fsp.writeFile(commonConfigPath, content);
  promptMock.mockResolvedValue({ continue: true });

  await init({ outputPath: testBaseFolder, full: false });

  const regeneratedToken = getGeneratedToken(testBaseFolder);
  expectGeneratedToken(regeneratedToken);
  expect(regeneratedToken).not.toBe(originalToken);
  expect(warnSpy).toHaveBeenCalledWith(
    "Existing common config %s does not contain a valid SCOW API token. A new token will be generated.",
    join(process.cwd(), commonConfigPath),
  );
  expect(warnSpy.mock.calls.flat()).not.toContain(originalToken);
});

it("does not modify an existing token when overwrite is declined", async () => {
  await init({ outputPath: testBaseFolder, full: false });
  const commonConfigPath = join(testBaseFolder, "config/common.yaml");
  const originalContent = await fsp.readFile(commonConfigPath, "utf8");
  promptMock.mockResolvedValue({ continue: false });
  infoSpy.mockClear();
  warnSpy.mockClear();

  await init({ outputPath: testBaseFolder, full: false });

  expect(await fsp.readFile(commonConfigPath, "utf8")).toBe(originalContent);
  const tokenLogWasWritten = [...infoSpy.mock.calls, ...warnSpy.mock.calls]
    .some(([message]) => String(message).includes("SCOW API token"));
  expect(tokenLogWasWritten).toBe(false);
});
