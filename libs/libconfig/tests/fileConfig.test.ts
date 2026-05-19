import { Static, Type } from "@sinclair/typebox";
import fs, { writeFileSync } from "fs";
import { dump } from "js-yaml";
import path, { dirname, join } from "path";
import { ConfigFileNotExistError, ConfigFileSchemaError, getConfigFromFile, getDirConfig } from "src/fileConfig";

const Schema = Type.Object({
  loaded: Type.String(),
});

const folderPath = path.join(__dirname, "configFileTest" + process.env.JEST_TEST_ID);

const exts = {
  yml: dump,
  yaml: dump,
  json: JSON.stringify,
};

type Ext = keyof typeof exts;

function createConfig(configName: string, ext: Ext) {
  const obj: Static<typeof Schema> = { loaded: configName + "." + ext };

  const content = exts[ext](obj);

  const fullConfigFilePath = path.join(folderPath, configName + "." + ext);

  fs.mkdirSync(dirname(fullConfigFilePath), { recursive: true });

  fs.writeFileSync(fullConfigFilePath, content);
}

beforeEach(() => {
  fs.mkdirSync(folderPath);
});

afterEach(() => {
  fs.rmSync(folderPath, { recursive: true });
});

it.each([
  [["yml"], "yml"],
  [["yaml"], "yaml"],
  [["json"], "json"],
  [["yml", "yaml"], "yml"],
  [["yaml", "json"], "yaml"],
] as const)("creates %o, should load %o", async (createdExts: readonly Ext[], expectedLoaded: Ext) => {
  const configName = "test";

  createdExts.forEach((ext) => createConfig(configName, ext));

  const obj = getConfigFromFile(Schema, configName, folderPath);

  expect(obj.loaded).toBe(configName + "." + expectedLoaded);
});

it("reports error if config not exist", async () => {
  expect(() => getConfigFromFile(Schema, "config", "yml")).toThrow(ConfigFileNotExistError);
});

it("reports file path", async () => {
  const configName = "test";

  fs.writeFileSync(path.join(folderPath, configName + ".yaml"), exts.yaml({ loaded: false }));
  try {
    getConfigFromFile(Schema, configName, folderPath);
    expect("").fail("should throw");
  } catch (e: any) {
    expect(e).toBeInstanceOf(ConfigFileSchemaError);
    expect(e.message).toContain(path.join(folderPath, configName + ".yaml"));
  }
});

it("reads dir config", async () => {
  const configName = "clusters";

  createConfig(join(configName, "a"), "yaml");
  createConfig(join(configName, "b"), "json");
  createConfig(join(configName, "b", "config"), "yaml");
  createConfig(join(configName, "b", "config"), "json");
  // create a invalid file
  writeFileSync(join(folderPath, configName, "c.c"), "invalid");

  const config = getDirConfig(Schema, configName, folderPath);

  expect(config).toEqual({
    a: { loaded: join(configName, "a.yaml") },
    b: { loaded: join(configName, "b", "config.yaml") },
  });
});
