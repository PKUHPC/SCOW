import { NextApiRequest } from "next";
import { initializeJobManager } from "src/server/trpc/route/backend/jobManager";

let setupState: "notsetup" | "inprogress" | "completed" = "notsetup";

export default async (req: NextApiRequest, res: any) => {
  if (setupState === "inprogress") {
    res.status(503).send("Setup in progress, please wait");
    return;
  }

  if (setupState === "completed") {
    res.send("Already setup");
    return;
  }

  setupState = "inprogress";
  await initializeJobManager().finally(() => {
    res.send("Setup complete");
    setupState = "completed";
  });

};
