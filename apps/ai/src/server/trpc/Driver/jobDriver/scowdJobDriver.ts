import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@grpc/grpc-js";
import { IdmapMode } from "@scow/config/build/cluster";
import { getPlaceholderKeys } from "@scow/lib-config/build/parse";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import {
  getClusterIdFromSessionId,
  getEnvVariables,
  isCurrentClusterSession as isCurrentClusterSessionUtil,
} from "@scow/lib-server";
import { AppType } from "@scow/scheduler-adapter-protos/build/app";
import {
  JobInfo,
  JobType as ProtoJobType,
  UserIdmapInfo,
  UserIdmapMode,
} from "@scow/scheduler-adapter-protos/build/job";
import { FileType } from "@scow/scowd-protos/build/storage/file_pb";
import { TRPCError } from "@trpc/server";
import dayjs from "dayjs";
import { join } from "path";
import { quote } from "shell-quote";
import { JobType } from "src/models/Job";
import { aiConfig } from "src/server/config/ai";
import { clusters } from "src/server/config/clusters";
import { config } from "src/server/config/env";
import { CreateDevHostInput, CreateDevHostInputSchema } from "src/server/trpc/route/devHost/devHost";
import {
  AppSession,
  CreateAppInput,
  CreateAppInputSchema,
  SERVER_ENTRY_COMMAND,
  SESSION_METADATA_NAME,
  TOTAL_SESSIONS,
  VNC_ENTRY_COMMAND,
} from "src/server/trpc/route/jobs/apps";
import { InferenceJobInput, InferenceJobInputSchema } from "src/server/trpc/route/jobs/infer";
import { TrainJobInput, TrainJobInputSchema } from "src/server/trpc/route/jobs/jobs";
import { getScowdClient, wrap } from "src/server/trpc/scowd/scowd";
import {
  extractAndValidateWorkDir,
  filterReservedEnvVars,
  genPublicOrPrivateDataJsonString,
  getClusterAppConfigs,
  scowdFetchJobInputParams,
  validateMountPoints,
  validateOptionalHomeScopedPath,
  validateResourceMountTargets,
  validateUniqueMountTargets,
  validateUniquePaths,
} from "src/server/utils/app";
import { getAdapterClient } from "src/server/utils/clusters";
import { allProtoAiJobTypes } from "src/server/utils/getProtoJobType";
import { getAppConnectionInfoFromAdapterForAi } from "src/server/utils/schedulerAdapterUtils";
import { formatTime } from "src/utils/datetime";
import { BASE_PATH } from "src/utils/processEnv";
import { Logger } from "ts-log";
import { z } from "zod";

import {
  ConnectToAppResponse,
  CreateAppExtraParams,
  CreateDevHostExtraParams,
  JobDriver,
  SubmitInferJobExtraParams,
  SubmitTrainJobExtraParams,
} from "./jobDriver";

const ImageSchema = z.object({
  name: z.string(),
  tag: z.string().optional(),
});

const BaseSessionMetadataSchema = z.object({
  sessionId: z.string(),
  jobName: z.string().default(""),
  jobId: z.number(),
  submitTime: z.string(),
  image: ImageSchema,
});

const AppSessionMetadataSchema = BaseSessionMetadataSchema.extend({
  jobType: z.literal(JobType.APP),
  appId: z.string().optional(),
});

const TrainSessionMetadataSchema = BaseSessionMetadataSchema.extend({
  jobType: z.literal(JobType.TRAIN),
});

const DevHostSessionMetadataSchema = BaseSessionMetadataSchema.extend({
  jobType: z.literal(JobType.DEV_HOST),
});

const InferSessionMetadataSchema = BaseSessionMetadataSchema.extend({
  jobType: z.literal(JobType.INFER),
  containerServicePort: z.number(),
});

const TotalSessionMetadataSchema = z.discriminatedUnion("jobType", [
  AppSessionMetadataSchema,
  TrainSessionMetadataSchema,
  DevHostSessionMetadataSchema,
  InferSessionMetadataSchema,
]);

type TotalSessionMetadata = z.infer<typeof TotalSessionMetadataSchema>;

/**
 * 解析镜像URL，提取镜像名称和标签
 * @param imageUrl 完整的镜像URL，可能包含标签
 * @returns 包含name和tag的对象
 */
function parseImageUrl(imageUrl: string): { name: string; tag: string } {
  const lastColonIndex = imageUrl.lastIndexOf(":");
  if (lastColonIndex === -1 || lastColonIndex === imageUrl.indexOf("://")) {
    // 没有找到标签分隔符，或者冒号是协议部分
    return { name: imageUrl, tag: "latest" };
  }

  const name = imageUrl.substring(0, lastColonIndex);
  const tag = imageUrl.substring(lastColonIndex + 1);

  // 检查tag部分是否包含路径分隔符，如果包含则可能不是真正的tag
  if (tag.includes("/")) {
    return { name: imageUrl, tag: "latest" };
  }

  return { name, tag };
}

export const getPublicMountPoints = (clusterId: string) =>
  clusters[clusterId].publicMountPoints ?? aiConfig.publicMountPoints ?? [];

const toAdapterUserIdmapMode = (mode: IdmapMode): UserIdmapMode => {
  switch (mode) {
    case IdmapMode.plain:
      return UserIdmapMode.MODE_PLAIN;
    case IdmapMode.idmap:
      return UserIdmapMode.MODE_IDMAP;
    case IdmapMode.bindfs:
      return UserIdmapMode.MODE_BINDFS;
    case IdmapMode.notSet:
    default:
      return UserIdmapMode.MODE_NOT_SET;
  }
};

export class ScowdJobDriver implements JobDriver {
  private client: ScowdClient;

  constructor(
    private clusterId: string,
    private userId: string,
    private logger: Logger,
  ) {
    this.client = getScowdClient(this.clusterId, this.userId);
  }

  private getTotalSessionsPath(homeDir: string) {
    return join(homeDir, aiConfig.appJobsDir, `${this.clusterId}-${TOTAL_SESSIONS}`);
  }

  // sessionId 以集群 ID 为前缀（如 dev-k8s-c-xxx），匹配到当前集群或无法识别集群时视为当前集群
  private isCurrentClusterSession(sessionId?: string) {
    return isCurrentClusterSessionUtil(sessionId, this.clusterId, clusters);
  }

  private isStrictCurrentClusterSession(sessionId?: string) {
    return getClusterIdFromSessionId(sessionId, clusters) === this.clusterId;
  }

  private async getCurrentUserIdmapInfo(): Promise<UserIdmapInfo | undefined> {
    const idmapConfig = clusters[this.clusterId]?.ai.idmap;
    if (!idmapConfig?.enabled) {
      return undefined;
    }

    this.logger.debug("Fetching user idmap info %s with mode %s", this.userId, idmapConfig.mode);

    try {
      const { uid, gid } = await wrap(this.client.system.getUserIdentityInfo({ userId: this.userId }), this.logger);

      return {
        mode: toAdapterUserIdmapMode(idmapConfig.mode),
        uid,
        gid,
      };
    } catch {
      this.logger.error("Failed to fetch idmap identity for user %s on cluster %s", this.userId, this.clusterId);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Can not fetch user identity of user ${this.userId} for current cluster idmap mode ${idmapConfig.mode}.`,
      });
    }
  }

  // 只有当这个 jobId 也有匹配当前集群的记录时，才要求 sessionId 必须严格匹配当前集群；否则不过滤
  private filterSessionsByJobIdClusterPreference(sessions: TotalSessionMetadata[]): TotalSessionMetadata[] {
    const jobIdsWithCurrentCluster = new Set<number>();
    sessions.forEach((session) => {
      if (this.isStrictCurrentClusterSession(session.sessionId)) {
        jobIdsWithCurrentCluster.add(session.jobId);
      }
    });

    if (jobIdsWithCurrentCluster.size === 0) {
      return sessions;
    }
    // 如果某个 jobId 没有严格匹配当前集群的记录（不在集合里），就全部保留（避免误删无法识别集群的旧数据）。
    // 如果某个 jobId 有严格匹配当前集群的记录（在集合里），就只保留这些严格匹配的记录。
    return sessions.filter(
      (session) =>
        !jobIdsWithCurrentCluster.has(session.jobId) || this.isStrictCurrentClusterSession(session.sessionId),
    );
  }

  // 去重同一集群下的 session 记录，后写覆盖先写
  private dedupeSessions(sessions: TotalSessionMetadata[]): TotalSessionMetadata[] {
    const sessionMap = new Map<string, TotalSessionMetadata>();
    sessions.forEach((session) => {
      if (this.isCurrentClusterSession(session?.sessionId)) {
        sessionMap.set(session.sessionId, session);
      }
    });

    return Array.from(sessionMap.values());
  }

  private parseTotalSessionMetadata(raw: unknown, logger: Logger, source: string): TotalSessionMetadata | null {
    const parsed = TotalSessionMetadataSchema.safeParse(raw);

    if (!parsed.success) {
      logger.error("Invalid session metadata from %s: %s", source, parsed.error.message);
      return null;
    }

    return parsed.data;
  }

  /**
   * 由于 grpc-proto 的 4M 限制（大约估计可以支持 30000 多条session数据）
   * 根据文件大小判断使用直接读取还是流式传输
   * 如果文件小于 2M 使用直接读取的 readFile 接口
   * 如果文件大于 2M 使用流式传输的 download 接口
   */
  private async readTotalSessionsFile(homeDir: string): Promise<TotalSessionMetadata[] | null> {
    const totalSessionsPath = this.getTotalSessionsPath(homeDir);
    const subLogger = this.logger.child({ homeDir, totalSessionsPath });
    try {
      // 不存在或空文件直接返回 null，让调用方决定是否重建
      const totalSessionsFileExists = await wrap(
        this.client.file.exists({
          userId: this.userId,
          path: totalSessionsPath,
        }),
        subLogger,
      );

      if (!totalSessionsFileExists.exists) {
        return null;
      }

      const fileMeta = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath: totalSessionsPath,
        }),
        subLogger,
      );

      let contentStr = "";
      const fileSize = Number(fileMeta.sizeByte);

      // 小文件直接 readFile，大文件用 download 流式读取
      if (fileSize <= 2 * 1024 * 1024) {
        subLogger.trace("total sessions file size %d bytes, using readFile", fileSize);
        const totalSessionsContent = await wrap(
          this.client.file.readFile({
            userId: this.userId,
            filePath: totalSessionsPath,
          }),
          subLogger,
        );
        contentStr = totalSessionsContent.content.toString();
      } else {
        subLogger.trace("total sessions file size %d bytes, using download stream", fileSize);
        const buffers: Buffer[] = [];
        const abortController = new AbortController();
        try {
          const stream = this.client.file.download(
            {
              userId: this.userId,
              path: totalSessionsPath,
              chunkSizeByte: config.DOWNLOAD_CHUNK_SIZE,
            },
            {
              signal: abortController.signal,
            },
          );

          for await (const { chunk } of stream) {
            if (chunk) {
              buffers.push(Buffer.from(chunk));
            }
          }

          contentStr = Buffer.concat(buffers).toString();
        } catch (err) {
          abortController.abort();
          subLogger.error("Failed to download total sessions file %s: %s", totalSessionsPath, err);
          return null;
        }
      }

      const trimmedContent = contentStr.trim();
      if (!trimmedContent) {
        return null;
      }

      const sessions: TotalSessionMetadata[] = [];

      try {
        const parsedContent = JSON.parse(trimmedContent);
        if (Array.isArray(parsedContent)) {
          parsedContent.forEach((item, index) => {
            const parsed = this.parseTotalSessionMetadata(item, subLogger, `${totalSessionsPath}[${index}]`);
            if (parsed) {
              sessions.push(parsed);
            }
          });
        } else if (parsedContent && typeof parsedContent === "object") {
          const parsed = this.parseTotalSessionMetadata(parsedContent, subLogger, totalSessionsPath);
          if (parsed) {
            sessions.push(parsed);
          }
        } else {
          subLogger.error("Unexpected total sessions data type in %s: %s", totalSessionsPath, typeof parsedContent);
        }
      } catch (parseErr) {
        // fallback 到 NDJSON 逐行解析
        subLogger.debug?.("Total sessions is not array json, fallback to NDJSON parse: %s", parseErr);
        contentStr.split(/\r?\n/).forEach((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return;
          }
          try {
            const parsedLine = JSON.parse(trimmed);
            const parsed = this.parseTotalSessionMetadata(parsedLine, subLogger, `${totalSessionsPath}:${index + 1}`);
            if (parsed) {
              sessions.push(parsed);
            }
          } catch (err) {
            subLogger.error("Failed to parse session line in %s: %s", totalSessionsPath, err);
          }
        });
      }

      const deduped = this.dedupeSessions(sessions);
      return deduped.length > 0 ? deduped : null;
    } catch (err) {
      subLogger.error("Failed to read total sessions file %s: %s", totalSessionsPath, err);
      return null;
    }
  }

  private async writeTotalSessionsFile(
    homeDir: string,
    sessions: TotalSessionMetadata[],
    options?: { append?: boolean },
  ) {
    const totalSessionsPath = this.getTotalSessionsPath(homeDir);
    const append = options?.append ?? false;
    // 只写当前集群的记录，避免污染其他集群数据
    const filteredSessions = sessions.filter((session) => this.isCurrentClusterSession(session.sessionId));

    if (filteredSessions.length === 0) {
      return;
    }

    let content = filteredSessions.map((session) => JSON.stringify(session)).join("\n");
    if (content) {
      content += "\n";
    }

    try {
      await wrap(
        this.client.file.writeFile({
          userId: this.userId,
          filePath: totalSessionsPath,
          content,
          append,
        }),
        this.logger,
      );
    } catch (err) {
      this.logger.error("Failed to write total sessions file %s: %s", totalSessionsPath, err);
    }
  }

  private async upsertTotalSessionsFile(homeDir: string, metadata: TotalSessionMetadata) {
    if (!this.isCurrentClusterSession(metadata.sessionId)) {
      return;
    }

    const totalSessions = await this.readTotalSessionsFile(homeDir);

    if (!totalSessions || totalSessions.length === 0) {
      // 文件缺失/空：先扫描原有 session.json 重建，再写入新记录，避免丢失历史数据
      const existingSessions = await this.readSessionsFromDirectories(homeDir);
      const dedupedSessions = this.dedupeSessions([...existingSessions, metadata]);
      await this.writeTotalSessionsFile(homeDir, dedupedSessions, { append: false });
      return;
    }

    const index = totalSessions.findIndex((item) => item.sessionId === metadata.sessionId);

    if (index !== -1) {
      totalSessions[index] = metadata;
      const dedupedSessions = this.dedupeSessions(totalSessions);
      await this.writeTotalSessionsFile(homeDir, dedupedSessions, { append: false });
      return;
    }

    await this.writeTotalSessionsFile(homeDir, [metadata], { append: true });
  }

  private async readSessionsFromDirectories(homeDir: string): Promise<TotalSessionMetadata[]> {
    const appJobsDirectory = join(homeDir, aiConfig.appJobsDir);
    const subLogger = this.logger.child({ appJobsDirectory });

    const appJobsDirectoryResp = await wrap(
      this.client.file.readDirectory({
        userId: this.userId,
        dirPath: appJobsDirectory,
      }),
      subLogger,
    );

    const sessionMetadatas = [] as TotalSessionMetadata[];

    await Promise.all(
      appJobsDirectoryResp.filesInfo.map(async ({ name: filename, fileType }) => {
        // 跳过是文件的目录
        if (fileType === FileType.FILE) {
          return;
        }

        const metadataPath = join(appJobsDirectory, filename, SESSION_METADATA_NAME);

        const metadataPathExists = await wrap(
          this.client.file.exists({
            userId: this.userId,
            path: metadataPath,
          }),
          subLogger,
        );

        if (!metadataPathExists.exists) {
          subLogger.error("metadataPath %s not exists", metadataPath);
          return;
        }

        const contentRes = await wrap(
          this.client.file.readFile({
            userId: this.userId,
            filePath: metadataPath,
          }),
          subLogger,
        );

        try {
          const parsedContent = JSON.parse(contentRes.content.toString());
          const sessionMetadata = this.parseTotalSessionMetadata(parsedContent, subLogger, metadataPath);
          if (sessionMetadata && this.isCurrentClusterSession(sessionMetadata.sessionId)) {
            sessionMetadatas.push(sessionMetadata);
          }
        } catch (err) {
          subLogger.error("Failed to parse session metadata %s: %s", metadataPath, err);
        }
      }),
    );

    return sessionMetadatas;
  }

  async createApp(inputParams: CreateAppInput, extraParams: CreateAppExtraParams): Promise<number> {
    const {
      mountPoints = [],
      clusterId,
      appId,
      customAttributes,
      startCommand,
      appJobName,
      account,
      partition,
      coreCount,
      nodeCount,
      gpuCount,
      memory,
      maxTime,
      remoteImageUrl,
      gpuType,
      qos,
      envVariables = [],
      privateImageRepositoryCredentials,
    } = inputParams;
    const {
      isAlgorithmPrivates,
      isDatasetPrivates,
      isModelPrivates,
      algorithmVersions,
      datasetVersions,
      modelVersions,
      app,
      proxyBasePath,
      existImage,
    } = extraParams;

    const normalizedMountPoints = mountPoints.filter((item): item is { path: string; target: string } =>
      Boolean(item?.path && item?.target),
    );
    const mountPathList = normalizedMountPoints.map((item) => item.path);

    const { path: homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    const workingDirectory = extractAndValidateWorkDir(envVariables, homeDir);
    // 确保去除 XDL_IP 与 VC_GPU_NUM
    const filteredEnvVars = filterReservedEnvVars(envVariables);

    validateMountPoints(normalizedMountPoints, homeDir);
    validateResourceMountTargets([...algorithmVersions, ...datasetVersions, ...modelVersions]);
    validateUniqueMountTargets([
      ...algorithmVersions.map(({ target }) => target),
      ...datasetVersions.map(({ target }) => target),
      ...modelVersions.map(({ target }) => target),
      ...normalizedMountPoints.map(({ target }) => target),
    ]);

    // 检查挂载点是否为目录，不能是软链接
    for (const { path } of normalizedMountPoints) {
      const { isSymlink } = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath: path,
        }),
        this.logger,
      );

      if (isSymlink) {
        throw new TRPCError({ code: "FORBIDDEN", message: `${path} is a symbolic link, not a directory` });
      }
    }

    const scowWorkDirectoryName = `${clusterId}-${appId}-${dayjs().format("YYYYMMDD-HHmmss")}`;

    const appJobsDirectory = join(aiConfig.appJobsDir, scowWorkDirectoryName);

    // 确保所有映射到容器的路径都不重复
    validateUniquePaths([
      workingDirectory,
      ...isAlgorithmPrivates.map((isAlgorithmPrivate, idx) =>
        isAlgorithmPrivate ? algorithmVersions[idx].privatePath : algorithmVersions[idx].path,
      ),
      ...isDatasetPrivates.map((isDatasetPrivate, idx) =>
        isDatasetPrivate ? datasetVersions[idx].privatePath : datasetVersions[idx].path,
      ),
      ...isModelPrivates.map((isModelPrivate, idx) =>
        isModelPrivate ? modelVersions[idx].privatePath : modelVersions[idx].path,
      ),
      ...mountPathList,
    ]);

    // make sure appJobsDirectory exists.
    await wrap(
      this.client.file.makeDirectory({
        userId: this.userId,
        dirPath: join(homeDir, appJobsDirectory),
      }),
      this.logger,
    );

    const remoteEntryPath = join(homeDir, appJobsDirectory, "entry.sh");
    const serverSessionInfoPath = join(homeDir, appJobsDirectory, "server_session_info.json");

    const attributesConfig = app.attributes;
    let customAttributesExport: string = "";
    for (const key in customAttributes) {
      let quotedAttribute = "";

      // select类型的属性值是管理员配置的，无需处理特殊字符，可以让配置的特殊字符(如 $)生效
      if (attributesConfig?.find((attribute) => attribute.name === key && attribute.type === "select")) {
        quotedAttribute = customAttributes[key]?.toString() ?? "";
      } else {
        quotedAttribute = quote([customAttributes[key]?.toString() ?? ""]);
      }

      const envItem = `export ${key}=${quotedAttribute}`;

      customAttributesExport = customAttributesExport + envItem + "\n";
    }

    // SVCPORT 是k8s集群中service的端口, 由适配器提供
    let customForm = String.raw`\"HOST\":\"$HOST\",\"PORT\":\"$SVCPORT\"`;
    if (app.type === "web") {
      for (const key in app.web!.connect.formData) {
        const texts = getPlaceholderKeys(app.web!.connect.formData[key]);
        for (const i of texts) {
          customForm += `,\\"${i}\\":\\"$${i}\\"`;
        }
      }
    }
    const sessionInfo = `echo -e "{${customForm}}" >$SERVER_SESSION_INFO\n`;

    let entryScript = "";
    if (app.type === "web") {
      const runtimeVariables = getEnvVariables({
        PROXY_BASE_PATH: join(proxyBasePath, app.web!.proxyType),
        SERVER_SESSION_INFO: serverSessionInfoPath,
      });
      const beforeScript = runtimeVariables + customAttributesExport + app.web!.beforeScript + sessionInfo;
      // 用户如果传了自定义的启动命令，则根据配置文件去替换默认的启动命令
      const webScript = startCommand ? app.web!.script.replace(app.web!.startCommand, startCommand) : app.web!.script;
      entryScript = SERVER_ENTRY_COMMAND + beforeScript + webScript;
    } else if (app.type === "vnc") {
      const runtimeVariables = getEnvVariables({
        SERVER_SESSION_INFO: serverSessionInfoPath,
      });
      // 对于vnc 的自定义镜像应用，用户需要传对应的运行镜像中启动脚本的命令
      const xstartupScript = startCommand || app.vnc!.xstartup;
      const beforeScript = app.vnc!.beforeScript || "";

      entryScript =
        VNC_ENTRY_COMMAND + runtimeVariables + customAttributesExport + beforeScript + sessionInfo + xstartupScript;
    } else {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Unknown app type ${app.type as string} of app id ${appId}`,
      });
    }

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: remoteEntryPath,
        content: entryScript,
      }),
      this.logger,
    );

    const userIdmapInfo = await this.getCurrentUserIdmapInfo();
    const client = getAdapterClient(clusterId);
    const reply = await asyncClientCall(client.job, "submitJob", {
      userId: this.userId,
      jobName: appJobName,
      account,
      partition: partition!,
      qos,
      coreCount,
      nodeCount,
      gpuCount: gpuCount ?? 0,
      memoryMb: memory,
      timeLimitMinutes: maxTime,
      // 用户指定应用工作目录
      workingDirectory,
      script: remoteEntryPath,
      envVariables: filteredEnvVars,
      privateImageRepositoryCredentials,
      userIdmapInfo,
      // 对于AI模块，需要传递的额外参数
      // 第一个参数确定是创建应用or训练任务，
      // 第二个参数为创建应用时的appId
      // 第三个参数为镜像地址
      // 第四个参数为算法版本地址
      // 第五个参数为数据集版本地址
      // 第六个参数为模型版本地址
      // 第七个参数为多挂载点地址，以逗号分隔 (此挂载点是可读可写的)
      // 第八个参数为gpuType, 表示训练时硬件卡的类型，由getClusterConfig接口获取
      // 第九个参数为多挂载点地址，以逗号分隔 (此挂载点是只读的)
      extraOptions: [
        JobType.APP,
        app.type,
        // 优先用户填写的远程镜像地址
        remoteImageUrl ?? existImage?.path ?? (app.image ? `${app.image.name}:${app.image.tag || "latest"}` : ""),
        JSON.stringify(
          algorithmVersions.map((algorithmVersion, idx) =>
            isAlgorithmPrivates[idx]
              ? genPublicOrPrivateDataJsonString(algorithmVersion.privatePath, false, algorithmVersion.target)
              : genPublicOrPrivateDataJsonString(algorithmVersion.path, true, algorithmVersion.target),
          ),
        ),

        JSON.stringify(
          datasetVersions.map((datasetVersion, idx) =>
            isDatasetPrivates[idx]
              ? genPublicOrPrivateDataJsonString(datasetVersion.privatePath, false, datasetVersion.target)
              : genPublicOrPrivateDataJsonString(datasetVersion.path, true, datasetVersion.target),
          ),
        ),

        JSON.stringify(
          modelVersions.map((modelVersion, idx) =>
            isModelPrivates[idx]
              ? genPublicOrPrivateDataJsonString(modelVersion.privatePath, false, modelVersion.target)
              : genPublicOrPrivateDataJsonString(modelVersion.path, true, modelVersion.target),
          ),
        ),
        JSON.stringify(normalizedMountPoints),
        gpuType || "",
        getPublicMountPoints(clusterId).join(","),
      ],
    }).catch((e) => {
      const ex = e as ServiceError;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `submit job failed, ${ex.details}`,
      });
    });

    const metadata: TotalSessionMetadata = {
      jobId: reply.jobId,
      jobName: appJobName,
      sessionId: scowWorkDirectoryName,
      submitTime: new Date().toISOString(),
      appId,
      image: existImage ? { name: existImage.name, tag: existImage.tag } : (app.image ?? { name: "default" }),
      jobType: JobType.APP,
    };

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: join(homeDir, appJobsDirectory, SESSION_METADATA_NAME),
        content: JSON.stringify(metadata),
      }),
      this.logger,
    );
    await this.upsertTotalSessionsFile(homeDir, metadata);

    return reply.jobId;
  }
  async getAppParams(sessionId: string, jobId: number): Promise<CreateAppInput> {
    const { path: homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

    // 读取作业信息
    const metadataPath = join(homeDir, jobsDirectory, SESSION_METADATA_NAME);

    const metadataPathExists = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: metadataPath,
      }),
      this.logger,
    );

    if (!metadataPathExists.exists) {
      this.logger.error("metadataPath %s not exists", metadataPath);
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `metadataPath ${metadataPath} not exists`,
      });
    }

    const contentRes = await wrap(
      this.client.file.readFile({
        userId: this.userId,
        filePath: metadataPath,
      }),
      this.logger,
    );

    const sessionMetadata = this.parseTotalSessionMetadata(
      JSON.parse(contentRes.content.toString()),
      this.logger,
      metadataPath,
    );
    if (!sessionMetadata) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Invalid session metadata from ${metadataPath}` });
    }

    if (sessionMetadata.jobType !== JobType.APP && sessionMetadata.jobType !== JobType.DEV_HOST) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Job type of job ${jobId} is not APP`,
      });
    }

    const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

    return await scowdFetchJobInputParams<CreateAppInput>(
      this.userId,
      inputParamsPath,
      this.client,
      CreateAppInputSchema,
      this.logger,
    );
  }

  async getAiJobs(clusterId: string, isRunning?: boolean, jobTypes?: ProtoJobType[]): Promise<AppSession[]> {
    const apps = getClusterAppConfigs(clusterId);
    const terminatedStates = [
      "BOOT_FAIL",
      "COMPLETED",
      "DEADLINE",
      "FAILED",
      "NODE_FAIL",
      "PREEMPTED",
      "SPECIAL_EXIT",
      "TIMEOUT",
      "CANCELED",
    ];

    const runningStates = ["RUNNING", "PENDING", "QUEUED"];

    // If a job is not running, it cannot be ready
    const client = getAdapterClient(clusterId);
    const jobsInfo = await asyncClientCall(client.job, "getJobs", {
      fields: [
        "job_id",
        "state",
        "elapsed_seconds",
        "time_limit_minutes",
        "reason",
        "partition",
        "gpus_alloc",
        "cpus_alloc",
        "mem_alloc_mb",
        "nodes_alloc",
        "gpus_req",
        "cpus_req",
        "mem_req_mb",
        "nodes_req",
      ],
      filter: {
        users: [this.userId],
        accounts: [],
        // 如果 isRunning 为 undefined，查询所有类型的会话
        states:
          isRunning === undefined
            ? runningStates.concat(terminatedStates)
            : isRunning
              ? runningStates
              : terminatedStates,
      },
      jobTypes: jobTypes?.length ? jobTypes : allProtoAiJobTypes,
    }).then((resp) => resp.jobs);

    const runningJobInfoMap = jobsInfo.reduce(
      (prev, curr) => {
        prev[curr.jobId] = curr;
        return prev;
      },
      {} as Record<number, JobInfo>,
    );

    const { path: homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );
    const appJobsDirectory = join(homeDir, aiConfig.appJobsDir);

    const appJobsDirectoryExists = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: appJobsDirectory,
      }),
      this.logger,
    );

    if (!appJobsDirectoryExists.exists) {
      this.logger.error("appJobsDirectory %s not exists", appJobsDirectory);
      return [];
    }

    let totalSessions = await this.readTotalSessionsFile(homeDir);

    if (!totalSessions || totalSessions.length === 0) {
      totalSessions = await this.readSessionsFromDirectories(homeDir);
      await this.writeTotalSessionsFile(homeDir, totalSessions);
    }

    totalSessions = this.filterSessionsByJobIdClusterPreference(totalSessions);

    const sessions = [] as AppSession[];

    totalSessions.forEach((sessionMetadata) => {
      const runningJobInfo: JobInfo | undefined = runningJobInfoMap[sessionMetadata.jobId];

      if (!runningJobInfo) {
        return;
      }

      const statesNeedReason = new Set(["PENDING", "QUEUED", ...terminatedStates]);
      const needReason = statesNeedReason.has(runningJobInfo.state);
      const jobDir = join(appJobsDirectory, sessionMetadata.sessionId);
      const appId = "appId" in sessionMetadata ? sessionMetadata.appId : undefined;
      const appName = appId ? apps[appId]?.name : undefined;

      sessions.push({
        jobId: sessionMetadata.jobId,
        appId: appId,
        appName,
        sessionId: sessionMetadata.sessionId,
        jobName: sessionMetadata.jobName ?? "",
        submitTime: sessionMetadata.submitTime,
        jobType: sessionMetadata.jobType,
        image: sessionMetadata.image,
        state: runningJobInfo.state ?? "ENDED",
        dataPath: jobDir,
        runningTime:
          runningJobInfo.elapsedSeconds !== undefined ? formatTime(runningJobInfo.elapsedSeconds * 1000) : "",
        timeLimit: runningJobInfo.timeLimitMinutes ? formatTime(runningJobInfo.timeLimitMinutes * 60 * 1000) : "",
        reason: needReason ? (runningJobInfo.reason ?? "") : undefined,
        partition: runningJobInfo.partition,
        cpusAlloc: runningJobInfo.cpusAlloc ?? 0,
        gpusAlloc: runningJobInfo.gpusAlloc ?? 0,
        memAlloc: runningJobInfo.memAllocMb ?? 0,
        nodesAlloc: runningJobInfo.nodesAlloc ?? 0,
        cpusReq: runningJobInfo.cpusReq,
        gpusReq: runningJobInfo.gpusReq,
        memReq: runningJobInfo.memReqMb,
        nodesReq: runningJobInfo.nodesReq,
      });
    });

    // 如果 isRunning 为 undefined，返回所有会话
    let filteredSessions =
      isRunning === undefined
        ? sessions
        : sessions.filter((session) =>
            isRunning ? runningStates.includes(session.state) : !runningStates.includes(session.state),
          );

    // 对于 DevHost 类型的作业，特殊排序：RUNNING 和 PENDING 状态优先，然后按 submitTime 从新到旧排序
    if (jobTypes?.length === 1 && jobTypes[0] === ProtoJobType.JOB_TYPE_DEV_HOST) {
      filteredSessions = filteredSessions.sort((a, b) => {
        const aIsActive = a.state === "RUNNING" || a.state === "PENDING";
        const bIsActive = b.state === "RUNNING" || b.state === "PENDING";

        // 如果一个是活跃状态，另一个不是，活跃状态排在前面
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;

        // 如果都是活跃状态或都不是活跃状态，按 submitTime 从新到旧排序
        return b.submitTime.localeCompare(a.submitTime);
      });
    } else {
      // 其他类型的作业按原有逻辑排序
      filteredSessions = filteredSessions.sort((a, b) => b.submitTime.localeCompare(a.submitTime));
    }

    return filteredSessions;
  }

  async connectToApp(clusterId: string, sessionId: string, appType?: AppType): Promise<ConnectToAppResponse> {
    const { path: userHomeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    const jobDir = join(userHomeDir, aiConfig.appJobsDir, sessionId);
    const metadataPathExists = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: jobDir,
      }),
      this.logger,
    );

    if (!metadataPathExists.exists) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `session id ${sessionId} is not found`,
      });
    }

    const metadataPath = join(jobDir, SESSION_METADATA_NAME);
    const contentRes = await wrap(
      this.client.file.readFile({
        userId: this.userId,
        filePath: metadataPath,
      }),
      this.logger,
    );
    const sessionMetadata = this.parseTotalSessionMetadata(
      JSON.parse(contentRes.content.toString()),
      this.logger,
      metadataPath,
    );
    if (!sessionMetadata) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Invalid session metadata from ${metadataPath}` });
    }

    const client = getAdapterClient(clusterId);

    if (sessionMetadata.jobType === JobType.DEV_HOST) {
      const connectionInfo = await getAppConnectionInfoFromAdapterForAi(
        client,
        sessionMetadata.jobId,
        this.logger,
        appType,
      );
      if (connectionInfo?.response?.$case === "appConnectionInfo") {
        const { host, port, password } = connectionInfo.response.appConnectionInfo;
        return {
          appId: sessionMetadata.jobId.toString(),
          host: host,
          port: port,
          password: password,
        };
      }
    }
    if (sessionMetadata.jobType === JobType.APP && sessionMetadata.appId) {
      const connectionInfo = await getAppConnectionInfoFromAdapterForAi(
        client,
        sessionMetadata.jobId,
        this.logger,
        appType,
      );
      if (connectionInfo?.response?.$case === "appConnectionInfo") {
        const { host, port, password } = connectionInfo.response.appConnectionInfo;
        return {
          appId: sessionMetadata.appId,
          host: host,
          port: port,
          password: password,
        };
      }
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `session id ${sessionId} cannot be connected.`,
    });
  }

  async submitInferJob(inputParams: InferenceJobInput, extraParams: SubmitInferJobExtraParams): Promise<number> {
    const {
      mountPoints = [],
      clusterId,
      command,
      InferenceJobName,
      account,
      partition,
      coreCount,
      nodeCount,
      gpuCount,
      memory,
      maxTime,
      remoteImageUrl,
      gpuType,
      containerServicePort,
      qos,
      envVariables = [],
      privateImageRepositoryCredentials,
    } = inputParams;
    const { isModelPrivates, modelVersions, existImage } = extraParams;

    const normalizedMountPoints = mountPoints.filter((item): item is { path: string; target: string } =>
      Boolean(item?.path && item?.target),
    );
    const mountPathList = normalizedMountPoints.map((item) => item.path);

    const { path: homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    const workingDirectory = extractAndValidateWorkDir(envVariables, homeDir);
    // 确保去除 XDL_IP 与 VC_GPU_NUM
    const filteredEnvVars = filterReservedEnvVars(envVariables);

    validateMountPoints(normalizedMountPoints, homeDir);
    validateResourceMountTargets(modelVersions);
    validateUniqueMountTargets([
      ...modelVersions.map(({ target }) => target),
      ...normalizedMountPoints.map(({ target }) => target),
    ]);

    const scowWorkDirectoryName = `${clusterId}-job-${dayjs().format("YYYYMMDD-HHmmss")}`;
    const inferJobsDirectory = join(aiConfig.appJobsDir, scowWorkDirectoryName);

    // 确保所有映射到容器的路径都不重复
    validateUniquePaths([
      inferJobsDirectory,
      ...isModelPrivates.map((isModelPrivate, idx) =>
        isModelPrivate ? modelVersions[idx].privatePath : modelVersions[idx].path,
      ),
      ...mountPathList,
    ]);

    // 检查挂载点是否为目录，不能是软链接
    for (const { path } of normalizedMountPoints) {
      const { isSymlink } = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath: path,
        }),
        this.logger,
      );

      if (isSymlink) {
        throw new TRPCError({ code: "FORBIDDEN", message: `${path} is a symbolic link, not a directory` });
      }
    }

    // make sure appJobsDirectory exists.
    await wrap(
      this.client.file.makeDirectory({
        userId: this.userId,
        dirPath: join(homeDir, inferJobsDirectory),
      }),
      this.logger,
    );

    const remoteEntryPath = join(homeDir, inferJobsDirectory, "entry.sh");

    const entryScript = command;

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: remoteEntryPath,
        content: entryScript,
      }),
      this.logger,
    );

    const userIdmapInfo = await this.getCurrentUserIdmapInfo();
    const client = getAdapterClient(clusterId);
    const reply = await asyncClientCall(client.job, "submitInferJob", {
      userId: this.userId,
      jobName: InferenceJobName,
      account,
      partition: partition!,
      qos,
      coreCount,
      nodeCount,
      gpuCount: gpuCount ?? 0,
      memoryMb: Number(memory),
      timeLimitMinutes: maxTime,
      workingDirectory,
      // 当运行命令为空时，直接传""，不传脚本路径
      script: entryScript ? remoteEntryPath : "",
      envVariables: filteredEnvVars,
      privateImageRepositoryCredentials,
      userIdmapInfo,
      // 对于AI模块，需要传递的额外参数
      // 第一个参数为镜像地址
      // 第二个参数为模型版本地址
      // 第三个参数为多挂载点地址，以逗号分隔
      // 第四个参数为gpuType, 表示训练时硬件卡的类型，由getClusterConfig接口获取
      // 第五个参数为多挂载点地址，以逗号分隔 (此挂载点是只读的)
      extraOptions: [
        remoteImageUrl || existImage?.path || "",
        JSON.stringify(
          modelVersions.map((modelVersion, idx) =>
            isModelPrivates[idx]
              ? genPublicOrPrivateDataJsonString(modelVersion.privatePath, false, modelVersion.target)
              : genPublicOrPrivateDataJsonString(modelVersion.path, true, modelVersion.target),
          ),
        ),
        JSON.stringify(normalizedMountPoints),
        gpuType || "",
        getPublicMountPoints(clusterId).join(","),
      ],
      containerServicePort,
    }).catch((e) => {
      const ex = e as ServiceError;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Submit infer job failed, ${ex.details}`,
      });
    });

    // Save session metadata
    const metadata: TotalSessionMetadata = {
      jobId: reply.jobId,
      jobName: InferenceJobName,
      sessionId: scowWorkDirectoryName,
      submitTime: new Date().toISOString(),
      image: {
        name: remoteImageUrl || existImage!.name,
        tag: existImage?.tag || "latest",
      },
      jobType: JobType.INFER,
      containerServicePort,
    };

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: join(homeDir, inferJobsDirectory, SESSION_METADATA_NAME),
        content: JSON.stringify(metadata),
      }),
      this.logger,
    );
    await this.upsertTotalSessionsFile(homeDir, metadata);

    return reply.jobId;
  }
  async getInferParams(sessionId: string, jobId: number): Promise<InferenceJobInput> {
    const { path: homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );
    const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

    // 读取作业信息
    const metadataPath = join(homeDir, jobsDirectory, SESSION_METADATA_NAME);

    const metadataPathExists = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: metadataPath,
      }),
      this.logger,
    );

    if (!metadataPathExists.exists) {
      this.logger.error("metadataPath %s not exists", metadataPath);
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `metadataPath ${metadataPath} not exists`,
      });
    }

    const contentRes = await wrap(
      this.client.file.readFile({
        userId: this.userId,
        filePath: metadataPath,
      }),
      this.logger,
    );

    const sessionMetadata = this.parseTotalSessionMetadata(
      JSON.parse(contentRes.content.toString()),
      this.logger,
      metadataPath,
    );
    if (!sessionMetadata) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Invalid session metadata from ${metadataPath}` });
    }
    if (sessionMetadata.jobType !== JobType.INFER) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Job type of job ${jobId} is not Infer`,
      });
    }

    const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

    return await scowdFetchJobInputParams<InferenceJobInput>(
      this.userId,
      inputParamsPath,
      this.client,
      InferenceJobInputSchema,
      this.logger,
    );
  }

  async submitTrainJob(inputParams: TrainJobInput, extraParams: SubmitTrainJobExtraParams): Promise<number> {
    const {
      mountPoints = [],
      clusterId,
      account,
      partition,
      coreCount,
      nodeCount,
      gpuCount,
      memory,
      maxTime,
      remoteImageUrl,
      gpuType,
      command,
      trainJobName,
      framework,
      psNodes,
      workerNodes,
      qos,
      envVariables = [],
      tensorBoardDataPath,
      privateImageRepositoryCredentials,
    } = inputParams;
    const {
      isAlgorithmPrivates,
      isDatasetPrivates,
      isModelPrivates,
      algorithmVersions,
      datasetVersions,
      modelVersions,
      existImage,
    } = extraParams;

    const normalizedMountPoints = mountPoints.filter((item): item is { path: string; target: string } =>
      Boolean(item?.path && item?.target),
    );
    const mountPathList = normalizedMountPoints.map((item) => item.path);

    const { path: homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    const workingDirectory = extractAndValidateWorkDir(envVariables, homeDir);
    // 确保去除 XDL_IP 与 VC_GPU_NUM
    const filteredEnvVars = filterReservedEnvVars(envVariables);

    validateMountPoints(normalizedMountPoints, homeDir);
    validateResourceMountTargets([...algorithmVersions, ...datasetVersions, ...modelVersions]);
    validateUniqueMountTargets([
      ...algorithmVersions.map(({ target }) => target),
      ...datasetVersions.map(({ target }) => target),
      ...modelVersions.map(({ target }) => target),
      ...normalizedMountPoints.map(({ target }) => target),
    ]);
    validateOptionalHomeScopedPath(tensorBoardDataPath, homeDir);

    const scowWorkDirectoryName = `${clusterId}-job-${dayjs().format("YYYYMMDD-HHmmss")}`;
    const trainJobsDirectory = join(aiConfig.appJobsDir, scowWorkDirectoryName);

    // 确保所有映射到容器的路径都不重复
    validateUniquePaths([
      trainJobsDirectory,
      ...isAlgorithmPrivates.map((isAlgorithmPrivate, idx) =>
        isAlgorithmPrivate ? algorithmVersions[idx].privatePath : algorithmVersions[idx].path,
      ),
      ...isDatasetPrivates.map((isDatasetPrivate, idx) =>
        isDatasetPrivate ? datasetVersions[idx].privatePath : datasetVersions[idx].path,
      ),
      ...isModelPrivates.map((isModelPrivate, idx) =>
        isModelPrivate ? modelVersions[idx].privatePath : modelVersions[idx].path,
      ),
      ...mountPathList,
    ]);

    // 检查挂载点是否为目录，不能是软链接
    for (const { path } of normalizedMountPoints) {
      const { isSymlink } = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath: path,
        }),
        this.logger,
      );

      if (isSymlink) {
        throw new TRPCError({ code: "FORBIDDEN", message: `${path} is a symbolic link, not a directory` });
      }
    }

    // make sure appJobsDirectory exists.
    await wrap(
      this.client.file.makeDirectory({
        userId: this.userId,
        dirPath: join(homeDir, trainJobsDirectory),
      }),
      this.logger,
    );

    // 训练任务的命令
    const remoteEntryPath = join(homeDir, trainJobsDirectory, "entry.sh");
    const entryScript = command;

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: remoteEntryPath,
        content: entryScript,
      }),
      this.logger,
    );

    // TensorBoard 运行时 URL 前缀，需要拼接变量 HOST和 PORT
    // 直接传递给适配器，适配器根据是否启动 tensorBoard 容器来判断是否使用
    const tensorBoardPathPrefix = join(BASE_PATH, `/api/proxy/${clusterId}/absolute/`);

    const userIdmapInfo = await this.getCurrentUserIdmapInfo();
    const client = getAdapterClient(clusterId);
    const reply = await asyncClientCall(client.job, "submitJob", {
      userId: this.userId,
      jobName: trainJobName,
      account,
      partition: partition!,
      qos,
      coreCount,
      nodeCount,
      gpuCount: gpuCount ?? 0,
      memoryMb: Number(memory),
      timeLimitMinutes: maxTime,
      workingDirectory,
      // 当运行命令为空时，直接传""，不传脚本路径
      script: entryScript ? remoteEntryPath : "",
      envVariables: filteredEnvVars,
      privateImageRepositoryCredentials,
      userIdmapInfo,
      // 对于AI模块，需要传递的额外参数
      // 第一个参数确定是创建应用or训练任务，
      // 第二个参数为创建应用时的appId
      // 第三个参数为镜像地址
      // 第四个参数为算法版本地址
      // 第五个参数为数据集版本地址
      // 第六个参数为模型版本地址
      // 第七个参数为多挂载点地址，以逗号分隔
      // 第八个参数为gpuType, 表示训练时硬件卡的类型，由getClusterConfig接口获取
      // 第九个参数告知适配器 该镜像对应的AI训练框架 如 tensorflow, pytorch 等
      // 第十个参数为多挂载点地址，以逗号分隔 (此挂载点是只读的)
      extraOptions: [
        JobType.TRAIN,
        "",
        remoteImageUrl || existImage?.path || "",
        JSON.stringify(
          algorithmVersions.map((algorithmVersion, idx) =>
            isAlgorithmPrivates[idx]
              ? genPublicOrPrivateDataJsonString(algorithmVersion.privatePath, false, algorithmVersion.target)
              : genPublicOrPrivateDataJsonString(algorithmVersion.path, true, algorithmVersion.target),
          ),
        ),
        JSON.stringify(
          datasetVersions.map((datasetVersion, idx) =>
            isDatasetPrivates[idx]
              ? genPublicOrPrivateDataJsonString(datasetVersion.privatePath, false, datasetVersion.target)
              : genPublicOrPrivateDataJsonString(datasetVersion.path, true, datasetVersion.target),
          ),
        ),
        JSON.stringify(
          modelVersions.map((modelVersion, idx) =>
            isModelPrivates[idx]
              ? genPublicOrPrivateDataJsonString(modelVersion.privatePath, false, modelVersion.target)
              : genPublicOrPrivateDataJsonString(modelVersion.path, true, modelVersion.target),
          ),
        ),
        JSON.stringify(normalizedMountPoints),
        gpuType || "",
        // 如果是单机训练,则训练框架为空，表明为普通训练，华为的卡单机训练也要传框架
        nodeCount === 1 && !gpuType?.startsWith("huawei.com") ? "" : framework || "",
        getPublicMountPoints(clusterId).join(","),
      ],
      psNodeCount: psNodes,
      workerNodeCount: workerNodes,
      tensorBoardDataPath,
      tensorboardProxyPathPrefix: tensorBoardPathPrefix,
    }).catch((e) => {
      const ex = e as ServiceError;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Submit train job failed, ${ex.details}`,
      });
    });

    // Save session metadata
    const imageInfo = remoteImageUrl
      ? parseImageUrl(remoteImageUrl)
      : { name: existImage!.name, tag: existImage?.tag || "latest" };

    const metadata: TotalSessionMetadata = {
      jobId: reply.jobId,
      jobName: trainJobName,
      sessionId: scowWorkDirectoryName,
      submitTime: new Date().toISOString(),
      image: imageInfo,
      jobType: JobType.TRAIN,
    };

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: join(homeDir, trainJobsDirectory, SESSION_METADATA_NAME),
        content: JSON.stringify(metadata),
      }),
      this.logger,
    );
    await this.upsertTotalSessionsFile(homeDir, metadata);

    return reply.jobId;
  }

  async getTrainParams(sessionId: string, jobId: number): Promise<TrainJobInput> {
    const { path: homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );
    const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

    // 读取作业信息
    const metadataPath = join(homeDir, jobsDirectory, SESSION_METADATA_NAME);

    const metadataPathExists = await wrap(
      this.client.file.exists({
        userId: this.userId,
        path: metadataPath,
      }),
      this.logger,
    );

    if (!metadataPathExists.exists) {
      this.logger.error("metadataPath %s not exists", metadataPath);
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `metadataPath ${metadataPath} not exists`,
      });
    }

    const contentRes = await wrap(
      this.client.file.readFile({
        userId: this.userId,
        filePath: metadataPath,
      }),
      this.logger,
    );
    const sessionMetadata = this.parseTotalSessionMetadata(
      JSON.parse(contentRes.content.toString()),
      this.logger,
      metadataPath,
    );
    if (!sessionMetadata) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Invalid session metadata from ${metadataPath}` });
    }
    if (sessionMetadata.jobType !== JobType.TRAIN) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Job type of job ${jobId} is not Train`,
      });
    }
    const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

    return await scowdFetchJobInputParams<TrainJobInput>(
      this.userId,
      inputParamsPath,
      this.client,
      TrainJobInputSchema,
      this.logger,
    );
  }

  async createDevHost(inputParams: CreateDevHostInput, extraParams: CreateDevHostExtraParams): Promise<number> {
    const {
      mountPoints = [],
      clusterId,
      devHostName,
      account,
      partition,
      coreCount,
      gpuCount,
      memory,
      maxTimeMinutes,
      remoteImageUrl,
      qos,
      privateImageRepositoryCredentials,
      envVariables = [],
    } = inputParams;

    const normalizedMountPoints = mountPoints.filter((item): item is { path: string; target: string } =>
      Boolean(item?.path && item?.target),
    );
    const mountPathList = normalizedMountPoints.map((item) => item.path);

    const devHostConfig = clusters[clusterId]?.ai.devHost;
    if (!devHostConfig) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "devHost is not configured",
      });
    }

    const { existImage } = extraParams;
    const { path: homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    const workingDirectory = extractAndValidateWorkDir(envVariables, homeDir);
    // 确保去除 XDL_IP 与 VC_GPU_NUM
    const filteredEnvVars = filterReservedEnvVars(envVariables);

    validateMountPoints(normalizedMountPoints, homeDir);
    validateUniqueMountTargets(normalizedMountPoints.map(({ target }) => target));

    const scowWorkDirectoryName = `${clusterId}-devHost-${dayjs().format("YYYYMMDD-HHmmss")}`;
    const devHostDir = join(aiConfig.appJobsDir, scowWorkDirectoryName);

    // 确保所有映射到容器的路径都不重复
    validateUniquePaths([devHostDir, ...mountPathList]);

    // 检查挂载点是否为目录，不能是软链接
    for (const { path } of normalizedMountPoints) {
      const { isSymlink } = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath: path,
        }),
        this.logger,
      );

      if (isSymlink) {
        throw new TRPCError({ code: "FORBIDDEN", message: `${path} is a symbolic link, not a directory` });
      }
    }

    // make sure appJobsDirectory exists.
    await wrap(
      this.client.file.makeDirectory({
        userId: this.userId,
        dirPath: join(homeDir, devHostDir),
      }),
      this.logger,
    );

    const userIdmapInfo = await this.getCurrentUserIdmapInfo();
    const client = getAdapterClient(clusterId);
    const reply = await asyncClientCall(client.job, "createDevHost", {
      userId: this.userId,
      jobName: devHostName,
      account,
      partition,
      qos,
      coreCount,
      gpuCount: gpuCount ?? 0,
      memoryMb: Number(memory),
      timeLimitMinutes: maxTimeMinutes,
      workingDirectory,
      image: remoteImageUrl || existImage?.path || "",
      privateImageRepositoryCredentials,
      userIdmapInfo,
      mounts: normalizedMountPoints,
      publicMounts: getPublicMountPoints(clusterId),
      vscodeInfo: {
        vscodeBinPath: devHostConfig.vscodeInfo.binPath,
      },
      jupyterLabInfo: {
        proxyBasePath: join(BASE_PATH, "api/proxy", clusterId, "absolute"),
      },
      envVariables: filteredEnvVars,
    }).catch((e) => {
      const ex = e as ServiceError;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Create dev host failed, ${ex.details}`,
      });
    });

    // Save session metadata
    const imageInfo = remoteImageUrl
      ? parseImageUrl(remoteImageUrl)
      : { name: existImage!.name, tag: existImage?.tag || "latest" };

    const metadata: TotalSessionMetadata = {
      jobId: reply.jobId,
      jobName: devHostName,
      sessionId: scowWorkDirectoryName,
      submitTime: new Date().toISOString(),
      image: imageInfo,
      jobType: JobType.DEV_HOST,
    };

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: join(homeDir, devHostDir, SESSION_METADATA_NAME),
        content: JSON.stringify(metadata),
      }),
      this.logger,
    );
    await this.upsertTotalSessionsFile(homeDir, metadata);

    return reply.jobId;
  }

  async getDevHostParams(sessionId: string, jobId: number): Promise<CreateDevHostInput> {
    const { path: homeDir } = await wrap(this.client.file.getHomeDirectory({ userId: this.userId }), this.logger);
    const jobsDirectory = join(aiConfig.appJobsDir, sessionId);
    const metadataPath = join(homeDir, jobsDirectory, SESSION_METADATA_NAME);

    const metadataPathExists = await wrap(
      this.client.file.exists({ userId: this.userId, path: metadataPath }),
      this.logger,
    );

    if (!metadataPathExists.exists) {
      this.logger.error("metadataPath %s not exists", metadataPath);
      throw new TRPCError({ code: "NOT_FOUND", message: `metadataPath ${metadataPath} not exists` });
    }

    const contentRes = await wrap(
      this.client.file.readFile({ userId: this.userId, filePath: metadataPath }),
      this.logger,
    );

    const sessionMetadata = this.parseTotalSessionMetadata(
      JSON.parse(contentRes.content.toString()),
      this.logger,
      metadataPath,
    );
    if (!sessionMetadata) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Invalid session metadata from ${metadataPath}` });
    }
    if (sessionMetadata.jobType !== JobType.DEV_HOST) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Job type of job ${jobId} is not DevHost` });
    }

    const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);
    return await scowdFetchJobInputParams<CreateDevHostInput>(
      this.userId,
      inputParamsPath,
      this.client,
      CreateDevHostInputSchema,
      this.logger,
    );
  }
}
