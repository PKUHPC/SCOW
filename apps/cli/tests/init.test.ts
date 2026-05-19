import { init } from "src/cmd/init";
import { ensureDirectoriesTheSame, testBaseFolder } from "tests/utils";

it("extracts init config to output path", async () => {
  await init({
    outputPath: testBaseFolder,
    full: false,
  });

  // testBaseFolder and configPath should be the same
  await ensureDirectoriesTheSame(testBaseFolder, "assets/init");
});

it("extracts init full config to output path", async () => {
  await init({
    outputPath: testBaseFolder,
    full: true,
  });

  // testBaseFolder and configPath should be the same
  await ensureDirectoriesTheSame(testBaseFolder, "assets/init-full");
});
