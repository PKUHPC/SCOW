import { NextApiRequest } from "next";
import { setupJobShellServer } from "src/server/setup/jobShell";
import { setupWssProxy } from "src/server/setup/proxy";
import { setupShellServer } from "src/server/setup/shell";
import { startDeleteMissingHarborImages } from "src/server/task/deleteMissingHarborImages";

let setup = false;

export default async (req: NextApiRequest, res: any) => {
  if (setup) {
    res.send("Already setup");
    return;
  }

  setupWssProxy(res);
  setupJobShellServer(res);
  setupShellServer(res);
  startDeleteMissingHarborImages();

  setup = true;
  res.send("Setup complete");
};
