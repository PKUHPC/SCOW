import { NextApiRequest } from "next";
import { setupWssProxy } from "src/server/setup/proxy";
import { setupShellServer } from "src/server/setup/shell";

let setup = false;

export default async (req: NextApiRequest, res) => {
  if (setup) {
    res.send("Already setup");
    return;
  }

  setupWssProxy(res);
  setupShellServer(res);

  setup = true;
  res.send("Setup complete");
};
