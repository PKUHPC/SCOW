import { ScowdClient } from "@scow/lib-scowd/build/client";
import { NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { basename } from "path";
import { config } from "src/server/config/env";
import { Logger } from "ts-log";

import { FileType as scowdFileType } from "../../../../../../libs/protos/scowd/build/storage/file_pb";
import { ListDirectoryOutput } from "../model/file";
import { getScowdClient,mapConnectErrorToTRPCError } from "../scowd/scowd";
import { FileDriver } from "./fileDriver";
import { getContentType, readableStreamToNodeReadable } from "./sshFileDriver";

async function wrap<T>(p: Promise<T>,logger: Logger): Promise<T> {
  try {
    return await p;
  } catch (err) {
    logger.error("Error in file operation, accessing to scowd (mapped to TRPCError)", err);
    throw mapConnectErrorToTRPCError(err);
  }
}

export class ScowdFileDriver implements FileDriver {

  private client: ScowdClient;

  constructor(
    private clusterId: string,
    private userId: string,
    private logger: Logger,
  ) {
    this.client = getScowdClient(this.clusterId);
  }

  async deleteFile(path: string): Promise<void> {
    await wrap(
      this.client.file.deleteFile({
        userId: this.userId,
        filePath: path,
      }),
      this.logger,
    );
  }

  async deleteDir(path: string): Promise<void> {
    await wrap(
      this.client.file.deleteDirectory({
        userId: this.userId,
        dirPath: path,
      }),
      this.logger,
    );
  }

  async getHomeDirectory(): Promise<string> {
    const resp = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    return resp.path;
  }

  async copy(fromPath: string, toPath: string): Promise<void> {
    await wrap(
      this.client.file.copy({
        userId: this.userId,
        fromPath,
        toPath,
      }),
      this.logger,
    );
  }

  async move(fromPath: string, toPath: string): Promise<void> {
    await wrap(
      this.client.file.move({
        userId: this.userId,
        fromPath,
        toPath,
      }),
      this.logger,
    );
  }

  async makeDirectory(path: string): Promise<void> {
    await wrap(
      this.client.file.makeDirectory({
        userId: this.userId,
        dirPath: path,
      }),
      this.logger,
    );
  }
  async createFile(path: string): Promise<void> {
    await wrap(
      this.client.file.createFile({
        userId: this.userId,
        filePath: path,
      }),
      this.logger,
    );
  }

  async readDirectory(path: string): Promise<ListDirectoryOutput[]> {
    const resp = await wrap(
      this.client.file.readDirectory({
        userId: this.userId,
        dirPath: path,
      }),
      this.logger,
    );

    const results = resp.filesInfo.map((info) => {
      return {
        name: info.name,
        type: info.fileType === scowdFileType.DIR ? "DIR" : "FILE",
        mtime: info.modTime,
        mode: info.mode,
        size: Number(info.sizeByte),
      } as ListDirectoryOutput;
    });

    return results;
  }

  async exists(path: string): Promise<boolean> {
    const resp = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path,
      }),
      this.logger,
    );

    return resp.exists;
  }

  async getFileMetadata(path: string) {
    const resp = await wrap(
      this.client.file.getFileMetadata({
        userId: this.userId,
        filePath:path,
      }),
      this.logger,
    );

    return {
      size: Number(resp.sizeByte),
      type: resp.type === scowdFileType.DIR ? "DIR" : "FILE",
    };
  }

  async download(path: string,download: string,res: NextApiResponse<any>) {
    try {
      const meta = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath:path,
        }),
        this.logger,
      );

      const filename = basename(path).replace(/"/g, "\\\"");
      const dispositionParm = "filename* = UTF-8''" + encodeURIComponent(filename);

      const contentType = download === "true" ? getContentType(filename, "application/octet-stream") :
        getContentType(filename, "text/plain; charset=utf-8");
      res.setHeader("Content-Type", contentType);

      res.setHeader("Content-Disposition", `${download === "true" ? "attachment" : "inline"}; ${dispositionParm}`);

      res.setHeader("Content-Length", String(meta.sizeByte));

      const readStream = this.client.file.download({
        userId: this.userId,
        path,
        chunkSizeByte: config.DOWNLOAD_CHUNK_SIZE,
      });

      for await (const { chunk } of readStream) {
        // 如果写入返回 false，表示缓冲区已满，需要等待 `drain` 事件
        if (!res.write(chunk)) {
          await new Promise((resolve) => res.once("drain", resolve));
        }
      }
    } catch (err) {
      throw mapConnectErrorToTRPCError(err);
    } finally {
      res.end();
    }
  }

  async upload(path: string, uploadedFile: File) {
    try {
      const userId = this.userId;

      await this.client.file.upload(
        (async function* () {
        // 初始上传信息：文件路径和用户信息
          yield { message: { case: "info", value: { path, userId } } };

          // 将上传的文件流拆分为块，并逐个发送给 gRPC 服务器
          const readableStream = uploadedFile.stream();
          const nodeReadableStream = readableStreamToNodeReadable(readableStream);

          for await (const chunk of nodeReadableStream) {
          // 逐个块上传，确保每个 chunk 都以 'chunk' 形式上传
            yield { message: { case: "chunk", value: chunk } };
          }
        })(),
      );

      return NextResponse.json({ message: "File uploaded successfully" }, { status: 200 });

    } catch (err) {
      throw mapConnectErrorToTRPCError(err);
    }
  }

  // TODO: implement this function
  async decompressFile(): Promise<void> {
  }

}
