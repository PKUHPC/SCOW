import { NextApiRequest } from "next";
import { startDeleteExpiredMessages } from "src/task/delete-expired-messages";

let setup = false;

export default async (req: NextApiRequest, res: any) => {
  if (setup) {
    res.send("Already setup");
    return;
  }

  startDeleteExpiredMessages();

  setup = true;
  res.send("Setup complete");
};
