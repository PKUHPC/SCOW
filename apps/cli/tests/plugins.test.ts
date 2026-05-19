import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { readEnabledPlugins } from "src/plugin";
import { format } from "src/utils/formatter";
import { testBaseFolder } from "tests/utils";

const testPluginFolder = join(testBaseFolder, "plugins");

async function createPluginDir(id: string) {
  await mkdir(join(testPluginFolder, id), { recursive: true });
}

async function createPlugins() {
  // make mock plugins
  const plugin1Id = "plugin1";

  await createPluginDir(plugin1Id);

  const plugin2Id = "plugin2";
  await createPluginDir(plugin2Id);
  await writeFile(
    join(testPluginFolder, plugin2Id, "docker-compose.yml"),
    format(
      {
        version: "3",
        services: [],
      },
      "yaml",
    ),
  );
}

beforeEach(async () => {
  await createPlugins();
});

it("should read plugins", async () => {
  const plugins = await readEnabledPlugins({
    plugins: { pluginsDir: testPluginFolder, enabledPlugins: ["plugin1", "plugin2"] },
  });

  expect(plugins).toEqual([
    { id: "plugin1" },
    { id: "plugin2", dockerComposeFilePath: join(testPluginFolder, "plugin2", "docker-compose.yml") },
  ]);
});
