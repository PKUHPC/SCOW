import { existsSync } from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import { join } from "path";
import { sendFile, validatePayload } from "src/routes/icon/utils";
import { getHost } from "src/utils/getHostname";
import { z } from "zod";

const filenameMap = {
  favicon: "favicon.ico",
  "192": "192.png",
  "512": "512.png",
} as const;

const QuerySchema = z.object({
  type: z.enum(["favicon", "192", "512"]),
});

export const serveIcon = async (
  req: NextApiRequest,
  res: NextApiResponse,
  builtinIconPath: string,
  configBasePath: string,
) => {
  const query = validatePayload(QuerySchema, req.query, res);

  const configIconPath = join(configBasePath, "icons");

  if (!query) {
    return;
  }

  // find the domain icons
  const domain = getHost(req);

  if (domain) {
    const domainIconPath = join(configIconPath, domain, filenameMap[query.type]);
    // serve the domain icon if it exists
    if (existsSync(domainIconPath)) {
      await sendFile(res, domainIconPath);
      return;
    }
  }

  // find the default icons
  const defaultIconPath = join(configIconPath, filenameMap[query.type]);
  if (existsSync(defaultIconPath)) {
    await sendFile(res, defaultIconPath);
    return;
  }

  // find the default icons
  const builtinIconFilePath = join(builtinIconPath, filenameMap[query.type]);
  await sendFile(res, builtinIconFilePath);
};
