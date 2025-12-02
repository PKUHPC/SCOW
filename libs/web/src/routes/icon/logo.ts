import { existsSync } from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import { join } from "path";
import { sendFile, sendSvgWithCustomColor, validatePayload } from "src/routes/icon/utils";
import { getHost } from "src/utils/getHostname";
import { z } from "zod";

const QuerySchema = z.object({
  type: z.enum(["logo", "banner", "login"]),
  preferDark: z.enum(["true", "false"]).default("false"),
});

const exts = ["svg", "png", "jpg"];

export const serveLogo = async (
  req: NextApiRequest, res: NextApiResponse,
  builtinLogoPath: string, configBasePath: string, primaryColor?: string,
) => {

  const query = validatePayload(QuerySchema, req.query, res);

  if (!query) { return; }

  const configLogoPath = join(configBasePath, "logo");

  const { type, preferDark } = query;

  async function trySend(basePath: string) {

    if (preferDark === "true") {
      for (const ext of exts) {
        const darkFilePath = join(basePath, type + ".dark." + ext);
        if (existsSync(darkFilePath)) {
          await sendFile(res, darkFilePath);
          return true;
        }
      }
    }

    for (const ext of exts) {
      const filePath = join(basePath, type + "." + ext);
      if (existsSync(filePath)) {
        if (ext === "svg" && primaryColor) {
          await sendSvgWithCustomColor(res, filePath, primaryColor);
        } else {
          await sendFile(res, filePath);
        }
        return true;
      }
    }

    return false;
  }

  // find the domain icons
  const domain = getHost(req);

  if (domain) {

    const domainPath = join(configLogoPath, domain);

    if (await trySend(domainPath)) {
      return;
    }
  }

  if (await trySend(configLogoPath)) {
    return;
  }

  if (await trySend(builtinLogoPath)) {
    return;
  }

  res.status(404).send("Image file Not Found");
};

