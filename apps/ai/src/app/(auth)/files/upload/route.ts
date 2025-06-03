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
import { withFileDriver } from "src/server/trpc/Driver/fileDriver/fileDriver";
import { logger } from "src/server/utils/logger";
import { getClusterLoginNode } from "src/server/utils/ssh";
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


  return await withFileDriver(
    { clusterId, user:user.identityId },
    async (driver) => {
      try {
        return await driver.upload(path, uploadedFile);
      } catch (error) {
        logger.error("Upload file error", error);
        throw error;
      }
    },
    logger,
  );
}
