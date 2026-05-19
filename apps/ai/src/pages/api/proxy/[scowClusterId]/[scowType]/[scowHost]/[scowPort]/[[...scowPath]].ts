import { NextApiRequest, NextApiResponse } from "next";
import { getUserInfo } from "src/server/auth/server";
import { parseProxyTarget, proxy } from "src/server/setup/proxy";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const user = await getUserInfo(req)
    .then((u) => {
      if (!u) {
        res.status(401).send("UNAUTHORIZED");
        return undefined;
      } else {
        return u;
      }
    })
    .catch(() => {
      res.status(500).send("Error when authenticating request");
      return undefined;
    });

  if (!user) {
    return;
  }
  // req.url of next.js removes base path
  const target = parseProxyTarget(req.url!, false);

  if (target instanceof Error) {
    res.status(400).send(target.message);
    return;
  }

  proxy.web(
    req,
    res,
    {
      target,
      ignorePath: true,
      xfwd: true,
    },
    (err) => {
      if (err) {
        console.error(err, "Error when proxing requests");
        res.status(500).send(err);
      }
    },
  );
};

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false,
  },
};
