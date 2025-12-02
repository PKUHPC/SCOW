/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import fs from "fs";
import { contentType } from "mime-types";
import { NextApiResponse } from "next";
import path from "path";
import { Readable } from "stream";
import { ZodObject, ZodRawShape } from "zod";

export function validatePayload <TSchema extends ZodRawShape>(
  schema: ZodObject<TSchema>, payload: object, res: NextApiResponse,
) {

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    res.status(400).send("Invalid requeset value");
    return undefined;
  }
  return parsed.data;
}

export async function sendFile(res: NextApiResponse, filePath: string) {

  const stat = await fs.promises.stat(filePath);

  res.writeHead(200, {
    "Content-Type": contentType(path.extname(filePath)) || "application/octet-stream",
    "Content-Length": stat.size,
    // caches image for one day
    "Cache-Control": "public, max-age=86400",
  });

  const readStream = fs.createReadStream(filePath);
  await new Promise<void>(function(resolve) {
    readStream.pipe(res);
    readStream.on("end", resolve);
  });

  res.end();
}


// 动态颜色处理
export async function sendSvgWithCustomColor(res: NextApiResponse, filePath: string, primaryColor: string) {
  const svgContent = await fs.promises.readFile(filePath, "utf-8");
  const transformedSvg = svgContent.replace(/#3470FF/gi, primaryColor);

  const svgStream = Readable.from([transformedSvg]);

  res.writeHead(200, {
    "Content-Type": "image/svg+xml",
    "Content-Length": Buffer.byteLength(transformedSvg, "utf8"),
    "Cache-Control": "public, max-age=86400",
  });

  await new Promise<void>((resolve) => {
    svgStream.pipe(res);
    svgStream.on("end", resolve);
  });

  res.end();
}
