import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncReplyStreamCall } from "@ddadaal/tsgrpc-client";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { Type } from "@sinclair/typebox";
import { randomUUID } from "crypto";
import { contentType } from "mime-types";
import { basename } from "path";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { pipeline } from "src/utils/pipeline";
import { route } from "src/utils/route";

export const CompressAndDownloadFileSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    paths: Type.Array(Type.String()),
  }),

  responses: {
    200: Type.Any(),

    400: Type.Object({ code: Type.Literal("INVALID_CLUSTER") }),

    404: Type.Object({ code: Type.Literal("NOT_EXISTS") }),

    501: Type.Object({ code: Type.Literal("NOT_IMPLEMENTED") }),
  },
});

// if the contentType is one of these, they can be previewed
// return as text/plain
const textFiles = ["application/x-sh"];

function getContentType(filename: string, defaultValue: string) {
  const type = contentType(basename(filename));

  if (!type) {
    return defaultValue;
  }

  if (textFiles.some((x) => type.startsWith(x))) {
    return "text/plain; charset=utf-8";
  }

  return type;
}

const auth = authenticate(() => true);

export default route(CompressAndDownloadFileSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const { cluster, paths } = req.query;

  const client = getClient(FileServiceClient);

  const filename = randomUUID().toString() + ".zip";
  const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

  res.writeHead(200, {
    "Content-Type": getContentType(filename, "application/octet-stream"),
    "Content-Disposition": `attachment; ${dispositionParm}`,
  });

  const stream = asyncReplyStreamCall(client, "compressAndDownload", {
    cluster,
    paths,
    userId: info.identityId,
  });

  const onClose = () => {
    if (!res.writableEnded) {
      console.log("Client disconnected, aborting compressAndDownload stream");
      stream.cancel();
      res.end();
    }
  };

  req.on("close", onClose);

  try {
    await pipeline(
      stream.iter(),
      async (x) => {
        return x.chunk;
      },
      res,
    );
  } catch (error) {
    console.error("Error piping compressAndDownload stream:", error);
    if (!res.writableEnded) {
      stream.cancel();
      res.end();
    }
  } finally {
    req.off("close", onClose);
    if (!res.writableEnded) {
      res.end();
    }
  }
});

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
