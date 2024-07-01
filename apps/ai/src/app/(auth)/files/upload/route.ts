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

import { NextRequest, NextResponse } from "next/server";
import { getUserInfo } from "src/server/auth/server";
import { logger } from "src/server/utils/logger";
import { getClusterLoginNode, sshConnect } from "src/server/utils/ssh";
import { pipeline, Readable } from "stream";
import { promisify } from "util";
import { z } from "zod";

const queryZod = z.object({
  clusterId: z.string(),
  path: z.string(),
});

export type UploadQuery = z.infer<typeof queryZod>;


export async function POST(request: NextRequest) {

  const user = await getUserInfo(request);

  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { clusterId, path } = queryZod.parse(Object.fromEntries(new URL(request.url).searchParams));

  const formData = await request.formData();

  const uploadedFile = formData.get("file");

  // // File is only an interface. Blob is class
  if (!uploadedFile || !(uploadedFile instanceof Blob)) {
    return NextResponse.json({ code: "INVALID_FILE" }, { status: 400 });
  }

  const host = getClusterLoginNode(clusterId);

  if (!host) {
    return NextResponse.json({ code: "INVALID_CLUSTER" }, { status: 400 });
  }


  return await sshConnect(host, user.identityId, logger, async (ssh) => {
    const sftp = await ssh.requestSFTP();

    try {
      const writeStream = sftp.createWriteStream(path);

      const pipelineAsync = promisify(pipeline);

      const readableStream = uploadedFile.stream();
      const nodeReadableStream = readableStreamToNodeReadable(readableStream);
      await pipelineAsync(nodeReadableStream, writeStream);

      return NextResponse.json({ message: "success" }, { status: 200 });

    } catch (e: any) {

    }
  });

}


function readableStreamToNodeReadable(readableStream: ReadableStream<Uint8Array>) {
  const nodeReadable = new Readable();
  nodeReadable._read = () => {};

  const reader = readableStream.getReader();

  reader.read().then(function processText({ done, value }) {
    if (done) {
      nodeReadable.push(null);
      return;
    }
    nodeReadable.push(Buffer.from(value));
    reader.read().then(processText);
  });

  return nodeReadable;
}
