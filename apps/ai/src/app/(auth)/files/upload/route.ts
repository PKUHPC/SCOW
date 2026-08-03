import { NextRequest, NextResponse } from "next/server";
import { PlatformRole } from "src/models/User";
import { getUserInfo } from "src/server/auth/server";
import { withFileDriver } from "src/server/trpc/Driver/fileDriver/fileDriver";
import { shouldPathsSkipPermissionCheck } from "src/server/utils/clusters";
import { logger } from "src/server/utils/logger";
import { z } from "zod";

const queryZod = z.object({
  clusterId: z.string(),
  path: z.string(),
  chunk: z.string(),
  originPath: z.string().optional(),
  chunkIdx: z.string().optional(),
});

export type UploadQuery = z.infer<typeof queryZod>;

export async function POST(request: NextRequest) {
  const user = await getUserInfo(request);

  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { clusterId, path, chunkIdx } = queryZod.parse(Object.fromEntries(new URL(request.url).searchParams));

  const formData = await request.formData();

  const uploadedFile = formData.get("file");

  // // File is only an interface. Blob is class
  if (!uploadedFile || !(uploadedFile instanceof Blob)) {
    return NextResponse.json({ code: "INVALID_FILE" }, { status: 400 });
  }

  return await withFileDriver(
    { clusterId, user: user.identityId },
    async (driver) => {
      try {
        const isPlatformAdmin = user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
        const noCheckPermission = shouldPathsSkipPermissionCheck(clusterId, [path], isPlatformAdmin);
        return await driver.upload(path, uploadedFile, chunkIdx ? Number(chunkIdx) : undefined, noCheckPermission);
      } catch (error: any) {
        const rawMessage = error?.message || "Unknown error";
        const rawCode = error?.code || "UPLOAD_FAILED";

        logger.error(`Upload file error: ${rawMessage}`);

        return NextResponse.json(
          {
            code: rawCode,
            message: rawMessage,
          },
          { status: 500 },
        );
      }
    },
    logger,
  );
}
