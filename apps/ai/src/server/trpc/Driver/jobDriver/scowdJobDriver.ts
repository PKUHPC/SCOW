import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@grpc/grpc-js";
import { JobInfo } from "@scow/ai-scheduler-adapter-protos/build/protos/job";
import { getPlaceholderKeys } from "@scow/lib-config/build/parse";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { getEnvVariables } from "@scow/lib-server";
import { TRPCError } from "@trpc/server";
import dayjs from "dayjs";
import { join } from "path";
import { quote } from "shell-quote";
import { JobType } from "src/models/Job";
import { aiConfig } from "src/server/config/ai";
import { AppSession, CreateAppInput, CreateAppInputSchema, SERVER_ENTRY_COMMAND, SERVER_SESSION_INFO,
  SESSION_METADATA_NAME,SessionMetadata, TENSORBOARD_ENTRY_COMMAND,
  VNC_ENTRY_COMMAND } from "src/server/trpc/route/jobs/apps";
import { InferenceJobInput,InferenceJobInputSchema,SessionMetadata as InferSessionMetadata }
  from "src/server/trpc/route/jobs/infer";
import { TrainJobInput, TrainJobInputSchema } from "src/server/trpc/route/jobs/jobs";
import { getScowdClient, wrap } from "src/server/trpc/scowd/scowd";
import { genPublicOrPrivateDataJsonString, getClusterAppConfigs, scowdFetchJobInputParams,
  validateUniquePaths } from "src/server/utils/app";
import { getAdapterClient } from "src/server/utils/clusters";
import { getAppConnectionInfoFromAdapterForAi } from "src/server/utils/schedulerAdapterUtils";
import { formatTime } from "src/utils/datetime";
import { isParentOrSameFolder } from "src/utils/file";
import { BASE_PATH } from "src/utils/processEnv";
import { Logger } from "ts-log";

import { ConnectToAppResponse, CreateAppExtraParams, JobDriver,
  SubmitInferJobExtraParams, SubmitTrainJobExtraParams } from "./jobDriver";

export class ScowdJobDriver implements JobDriver {

  private client: ScowdClient;

  constructor(
    private clusterId: string,
    private userId: string,
    private logger: Logger,
  ) {
    this.client = getScowdClient(this.clusterId);
  }

  async createApp(inputParams: CreateAppInput, extraParams: CreateAppExtraParams): Promise<number> {
    const { workingDirectory,mountPoints = [],clusterId,appId,customAttributes,
      startCommand,appJobName,account,partition,coreCount,nodeCount,gpuCount,memory,maxTime,
      remoteImageUrl,gpuType,qos,envVariables = [],
    } = inputParams;
    const { isAlgorithmPrivates,isDatasetPrivates,isModelPrivates, algorithmVersions, datasetVersions,
      modelVersions,app,proxyBasePath,existImage } = extraParams;

    const { path:homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    // 工作目录和挂载点必须在用户的homeDir下
    if ((workingDirectory && !isParentOrSameFolder(homeDir, workingDirectory))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "workingDirectory and mountPoint should be in homeDir",
      });
    }

    mountPoints.forEach((mountPoint) => {
      if (mountPoint && !isParentOrSameFolder(homeDir, mountPoint)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "mountPoint should be in homeDir",
        });
      }
    });

    // 检查挂载点是否为目录，不能是软链接
    for (const path of mountPoints) {
      const { isSymlink } = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath:path,
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
      workingDirectory ?? join(homeDir, appJobsDirectory),
      ...isAlgorithmPrivates.map((isAlgorithmPrivate,idx) =>
        isAlgorithmPrivate ? algorithmVersions[idx].privatePath : algorithmVersions[idx].path)
      ,
      ...isDatasetPrivates.map((isDatasetPrivate,idx) =>
        isDatasetPrivate ? datasetVersions[idx].privatePath : datasetVersions[idx].path)
      ,
      ...isModelPrivates.map((isModelPrivate,idx) =>
        isModelPrivate ? modelVersions[idx].privatePath : modelVersions[idx].path)
      ,
      ...mountPoints,
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

    const attributesConfig = app.attributes;
    let customAttributesExport: string = "";
    for (const key in customAttributes) {

      let quotedAttribute = "";

      // select类型的属性值是管理员配置的，无需处理特殊字符，可以让配置的特殊字符(如 $)生效
      if (
        attributesConfig?.find((attribute) =>
          attribute.name === key && attribute.type === "select",
        )
      ) {
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
        SERVER_SESSION_INFO,
      });
      const beforeScript = runtimeVariables + customAttributesExport + app.web!.beforeScript + sessionInfo;
      // 用户如果传了自定义的启动命令，则根据配置文件去替换默认的启动命令
      const webScript = startCommand ? app.web!.script.replace(app.web!.startCommand, startCommand) : app.web!.script;
      entryScript = SERVER_ENTRY_COMMAND + beforeScript + webScript;
    } else if (app.type === "vnc") {
      const runtimeVariables = getEnvVariables({
        SERVER_SESSION_INFO,
      });
      // 对于vnc 的自定义镜像应用，用户需要传对应的运行镜像中启动脚本的命令
      const xstartupScript = startCommand || app.vnc!.xstartup;
      const beforeScript = app.vnc!.beforeScript || "";

      entryScript = VNC_ENTRY_COMMAND + runtimeVariables + customAttributesExport + beforeScript
                + sessionInfo + xstartupScript;

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

    const client = getAdapterClient(clusterId);
    const reply = await asyncClientCall(client.job, "submitJob", {
      userId:this.userId,
      jobName: appJobName,
      account,
      partition: partition!,
      qos,
      coreCount,
      nodeCount,
      gpuCount: gpuCount ?? 0,
      memoryMb: memory,
      timeLimitMinutes: maxTime,
      // 用户指定应用工作目录，如果不存在，则默认为用户的appJobsDirectory
      workingDirectory: workingDirectory ?? join(homeDir, appJobsDirectory),
      script: remoteEntryPath,
      envVariables,
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
        remoteImageUrl
          ?? (existImage?.path
          ?? (app.image ? `${app.image.name}:${app.image.tag || "latest"}` : "")),
        JSON.stringify(
          algorithmVersions.map((algorithmVersion,idx) => isAlgorithmPrivates[idx]
            ? genPublicOrPrivateDataJsonString(algorithmVersion.privatePath,false)
            : genPublicOrPrivateDataJsonString(algorithmVersion.path,true),
          ))
        ,

        JSON.stringify(
          datasetVersions.map((datasetVersion,idx) => isDatasetPrivates[idx]
            ? genPublicOrPrivateDataJsonString(datasetVersion.privatePath,false)
            : genPublicOrPrivateDataJsonString(datasetVersion.path,true),
          ))
        ,

        JSON.stringify(
          modelVersions.map((modelVersion,idx) => isModelPrivates[idx]
            ? genPublicOrPrivateDataJsonString(modelVersion.privatePath,false)
            : genPublicOrPrivateDataJsonString(modelVersion.path,true),
          ))
        ,
        mountPoints.join(","),
        gpuType || "",
        aiConfig.publicMountPoints ? aiConfig.publicMountPoints.join(",") : "",
      ],
    }).catch((e) => {
      const ex = e as ServiceError;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `submit job failed, ${ex.details}`,
      });
    });

    const metadata: SessionMetadata = {
      jobId: reply.jobId,
      jobName: appJobName,
      sessionId: scowWorkDirectoryName,
      submitTime: new Date().toISOString(),
      appId,
      image: existImage ? { name: existImage.name, tag: existImage.tag } : app.image ?? { name: "default" },
      jobType: JobType.APP,
    };

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: join(homeDir,appJobsDirectory, SESSION_METADATA_NAME),
        content: JSON.stringify(metadata),
      }),
      this.logger,
    );

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: join(homeDir,appJobsDirectory, `${reply.jobId}-input.json`),
        content: JSON.stringify(inputParams),
      }),
      this.logger,
    );

    return reply.jobId;
  }
  async getAppParams(sessionId: string, jobId: number): Promise<CreateAppInput> {
    const { path:homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

    // 读取作业信息
    const metadataPath = join(homeDir,jobsDirectory, SESSION_METADATA_NAME);

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
        code:"NOT_FOUND",
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

    const sessionMetadata = JSON.parse(contentRes.content.toString()) as SessionMetadata;

    if (sessionMetadata.jobType !== JobType.APP) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Job type of job ${jobId} is not APP`,
      });
    }

    const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

    return await scowdFetchJobInputParams<CreateAppInput>(
      this.userId,inputParamsPath, this.client, CreateAppInputSchema, this.logger,
    );
  }

  async getAiJobs(clusterId: string, isRunning: boolean): Promise<AppSession[]> {
    const apps = getClusterAppConfigs(clusterId);
    const terminatedStates = ["BOOT_FAIL", "COMPLETED", "DEADLINE", "FAILED",
      "NODE_FAIL", "PREEMPTED", "SPECIAL_EXIT", "TIMEOUT","CANCELED"];

    const runningStates = ["RUNNING", "PENDING","QUEUED"];

    // If a job is not running, it cannot be ready
    const client = getAdapterClient(clusterId);
    const runningJobsInfo = await asyncClientCall(client.job, "getJobs", {
      fields: ["job_id", "state", "elapsed_seconds", "time_limit_minutes", "reason","partition","gpus_alloc",
        "cpus_alloc","mem_alloc_mb","nodes_alloc","gpus_req", "cpus_req","mem_req_mb","nodes_req",
      ],
      filter: {
        users: [this.userId], accounts: [],
        states: isRunning ? runningStates : terminatedStates,
      },
    }).then((resp) => resp.jobs);

    const runningJobInfoMap = runningJobsInfo.reduce((prev, curr) => {
      prev[curr.jobId] = curr;
      return prev;
    }, {} as Record<number, JobInfo>);

    const { path:homeDir } = await wrap(
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

    const appJobsDirectoryResp = await wrap(
      this.client.file.readDirectory({
        userId: this.userId,
        dirPath: appJobsDirectory,
      }),
      this.logger,
    );
    const list = appJobsDirectoryResp.filesInfo;
    const sessions = [] as AppSession[];


    await Promise.all(list.map(async ({ name:filename }) => {
      const jobDir = join(appJobsDirectory, filename);
      const metadataPath = join(jobDir, SESSION_METADATA_NAME);

      const metadataPathExists = await wrap(
        this.client.file.exists({
          userId: this.userId,
          path: metadataPath,
        }),
        this.logger,
      );

      if (!metadataPathExists.exists) {
        this.logger.error("metadataPath %s not exists", metadataPath);
        return;
      }


      const contentRes = await wrap(
        this.client.file.readFile({
          userId: this.userId,
          filePath: metadataPath,
        }),
        this.logger,
      );
      const sessionMetadata = JSON.parse(contentRes.content.toString()) as SessionMetadata;

      const runningJobInfo: JobInfo | undefined = runningJobInfoMap[sessionMetadata.jobId];

      if (!runningJobInfo) {
        return;
      }

      const statesNeedReason = new Set(["PENDING", "QUEUED",...terminatedStates]);
      const needReason = statesNeedReason.has(runningJobInfo.state);

      sessions.push({
        jobId: sessionMetadata.jobId,
        appId: sessionMetadata.appId,
        appName: sessionMetadata?.appId ? apps[sessionMetadata?.appId]?.name : undefined,
        sessionId: sessionMetadata.sessionId,
        jobName: sessionMetadata.jobName ?? "",
        submitTime: sessionMetadata.submitTime,
        jobType: sessionMetadata.jobType,
        image: sessionMetadata.image,
        state: runningJobInfo.state ?? "ENDED",
        dataPath: jobDir,
        runningTime: runningJobInfo.elapsedSeconds !== undefined
          ? formatTime(runningJobInfo.elapsedSeconds * 1000) : "",
        timeLimit: runningJobInfo.timeLimitMinutes ? formatTime(runningJobInfo.timeLimitMinutes * 60 * 1000) : "",
        reason: needReason ? (runningJobInfo.reason ?? "") : undefined,
        partition:runningJobInfo.partition,
        cpusAlloc:runningJobInfo.cpusAlloc ?? 0,
        gpusAlloc:runningJobInfo.gpusAlloc ?? 0,
        memAlloc:runningJobInfo.memAllocMb ?? 0,
        nodesAlloc:runningJobInfo.nodesAlloc ?? 0,
        cpusReq:runningJobInfo.cpusReq,
        gpusReq:runningJobInfo.gpusReq,
        memReq:runningJobInfo.memReqMb,
        nodesReq:runningJobInfo.nodesReq,
      });
    }));

    const filteredSessions = sessions.filter((session) =>
      isRunning
        ? runningStates.includes(session.state)
        : !runningStates.includes(session.state))
      .sort((a, b) => b.submitTime.localeCompare(a.submitTime));
    return filteredSessions;
  }

  async connectToApp(clusterId: string, sessionId: string): Promise<ConnectToAppResponse> {
    const { path:userHomeDir } = await wrap(
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
    const sessionMetadata = JSON.parse(contentRes.content.toString()) as SessionMetadata;

    if (sessionMetadata.jobType === JobType.APP && sessionMetadata.appId) {
      const client = getAdapterClient(clusterId);
      const connectionInfo = await getAppConnectionInfoFromAdapterForAi(client, sessionMetadata.jobId, this.logger);
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
    const { mountPoints = [],clusterId,command,InferenceJobName,account,partition,coreCount,nodeCount,
      gpuCount,memory,maxTime,remoteImageUrl,gpuType,containerServicePort,qos,envVariables = []} = inputParams;
    const { isModelPrivates,modelVersions,existImage } = extraParams;
    const { path:homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );
    mountPoints.forEach((mountPoint) => {
      if (mountPoint && !isParentOrSameFolder(homeDir, mountPoint)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "mountPoint should be in homeDir",
        });
      }
    });

    const scowWorkDirectoryName = `${clusterId}-job-${dayjs().format("YYYYMMDD-HHmmss")}`;
    const inferJobsDirectory = join(aiConfig.appJobsDir, scowWorkDirectoryName);

    // 确保所有映射到容器的路径都不重复
    validateUniquePaths([
      inferJobsDirectory,
      ...isModelPrivates.map((isModelPrivate,idx) =>
        isModelPrivate ? modelVersions[idx].privatePath : modelVersions[idx].path)
      ,
      ...mountPoints,
    ]);

    // 检查挂载点是否为目录，不能是软链接
    for (const path of mountPoints) {
      const { isSymlink } = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath:path,
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

    const client = getAdapterClient(clusterId);
    const reply = await asyncClientCall(client.job, "submitInferJob", {
      userId:this.userId,
      jobName: InferenceJobName,
      account,
      partition: partition!,
      qos,
      coreCount,
      nodeCount,
      gpuCount: gpuCount ?? 0,
      memoryMb: Number(memory),
      timeLimitMinutes: maxTime,
      workingDirectory: join(homeDir, inferJobsDirectory),
      script: remoteEntryPath,
      envVariables,
      // 对于AI模块，需要传递的额外参数
      // 第一个参数为镜像地址
      // 第二个参数为模型版本地址
      // 第三个参数为多挂载点地址，以逗号分隔
      // 第四个参数为gpuType, 表示训练时硬件卡的类型，由getClusterConfig接口获取
      // 第五个参数为多挂载点地址，以逗号分隔 (此挂载点是只读的)
      extraOptions: [
        remoteImageUrl || existImage?.path || "",
        JSON.stringify(
          modelVersions.map((modelVersion,idx) => isModelPrivates[idx]
            ? genPublicOrPrivateDataJsonString(modelVersion.privatePath,false)
            : genPublicOrPrivateDataJsonString(modelVersion.path,true),
          ))
        ,
        mountPoints.join(","),
        gpuType || "",
        aiConfig.publicMountPoints ? aiConfig.publicMountPoints.join(",") : "",
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
    const metadata: InferSessionMetadata = {
      jobId: reply.jobId,
      jobName:InferenceJobName,
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
        filePath: join(homeDir,inferJobsDirectory, SESSION_METADATA_NAME),
        content: JSON.stringify(metadata),
      }),
      this.logger,
    );

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: join(homeDir,inferJobsDirectory, `${reply.jobId}-input.json`),
        content: JSON.stringify(inputParams),
      }),
      this.logger,
    );

    return reply.jobId;
  }
  async getInferParams(sessionId: string, jobId: number): Promise<InferenceJobInput> {
    const { path:homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );
    const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

    // 读取作业信息
    const metadataPath = join(homeDir,jobsDirectory, SESSION_METADATA_NAME);

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
        code:"NOT_FOUND",
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

    const sessionMetadata = JSON.parse(contentRes.content.toString()) as SessionMetadata;
    if (sessionMetadata.jobType !== JobType.INFER) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Job type of job ${jobId} is not Infer`,
      });
    }

    const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

    return await scowdFetchJobInputParams<InferenceJobInput>(
      this.userId,inputParamsPath, this.client, InferenceJobInputSchema, this.logger,
    );
  }

  async submitTrainJob(inputParams: TrainJobInput, extraParams: SubmitTrainJobExtraParams): Promise<number> {
    const { mountPoints = [],clusterId,account,partition,coreCount,nodeCount,gpuCount,memory,maxTime,
      remoteImageUrl,gpuType,command,trainJobName,framework,psNodes,workerNodes,qos,envVariables = [],
      tensorBoardDataPath,
    } = inputParams;
    const { isAlgorithmPrivates,isDatasetPrivates,isModelPrivates, algorithmVersions, datasetVersions,
      modelVersions,existImage } = extraParams;

    const { path:homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );

    mountPoints.forEach((mountPoint) => {
      if (mountPoint && !isParentOrSameFolder(homeDir, mountPoint)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "mountPoint should be in homeDir",
        });
      }
    });

    const scowWorkDirectoryName = `${clusterId}-job-${dayjs().format("YYYYMMDD-HHmmss")}`;
    const trainJobsDirectory = join(aiConfig.appJobsDir, scowWorkDirectoryName);

    // 确保所有映射到容器的路径都不重复
    validateUniquePaths([
      trainJobsDirectory,
      ...isAlgorithmPrivates.map((isAlgorithmPrivate,idx) =>
        isAlgorithmPrivate ? algorithmVersions[idx].privatePath : algorithmVersions[idx].path)
      ,
      ...isDatasetPrivates.map((isDatasetPrivate,idx) =>
        isDatasetPrivate ? datasetVersions[idx].privatePath : datasetVersions[idx].path)
      ,
      ...isModelPrivates.map((isModelPrivate,idx) =>
        isModelPrivate ? modelVersions[idx].privatePath : modelVersions[idx].path)
      ,
      ...mountPoints,
    ]);

    // 检查挂载点是否为目录，不能是软链接
    for (const path of mountPoints) {
      const { isSymlink } = await wrap(
        this.client.file.getFileMetadata({
          userId: this.userId,
          filePath:path,
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

    // TensorBoard的命令
    const remoteTensorBoardEntryPath = join(homeDir, trainJobsDirectory, "tensorBoard_entry.sh");
    const tensorBoardPathPrefix = join(BASE_PATH,`/api/proxy/${clusterId}/absolute/\${HOST}/\${PORT}/`);
    const tensorBoardScript = "tensorboard --logdir /output/training_logs --host 0.0.0.0 " +
    `--path_prefix ${tensorBoardPathPrefix}`;
    const tensorBoardEntryScript = TENSORBOARD_ENTRY_COMMAND + tensorBoardScript;

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: remoteTensorBoardEntryPath,
        content: tensorBoardEntryScript,
      }),
      this.logger,
    );

    const client = getAdapterClient(clusterId);
    const reply = await asyncClientCall(client.job, "submitJob", {
      userId:this.userId,
      jobName: trainJobName,
      account,
      partition: partition!,
      qos,
      coreCount,
      nodeCount,
      gpuCount: gpuCount ?? 0,
      memoryMb: Number(memory),
      timeLimitMinutes: maxTime,
      workingDirectory: join(homeDir, trainJobsDirectory),
      script: remoteEntryPath,
      envVariables,
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
          algorithmVersions.map((algorithmVersion,idx) => isAlgorithmPrivates[idx]
            ? genPublicOrPrivateDataJsonString(algorithmVersion.privatePath,false)
            : genPublicOrPrivateDataJsonString(algorithmVersion.path,true),
          ))
        ,
        JSON.stringify(
          datasetVersions.map((datasetVersion,idx) => isDatasetPrivates[idx]
            ? genPublicOrPrivateDataJsonString(datasetVersion.privatePath,false)
            : genPublicOrPrivateDataJsonString(datasetVersion.path,true),
          ))
        ,
        JSON.stringify(
          modelVersions.map((modelVersion,idx) => isModelPrivates[idx]
            ? genPublicOrPrivateDataJsonString(modelVersion.privatePath,false)
            : genPublicOrPrivateDataJsonString(modelVersion.path,true),
          ))
        ,
        mountPoints.join(","),
        gpuType || "",
        // 如果是单机训练,则训练框架为空，表明为普通训练，华为的卡单机训练也要传框架
        // 如果nodeCount不为1但同时选定镜像又没有框架标签，该接口会报错
        (nodeCount === 1 && !gpuType?.startsWith("huawei.com")) ? "" : framework || "",
        aiConfig.publicMountPoints ? aiConfig.publicMountPoints.join(",") : "",
      ],
      psNodeCount:psNodes,
      workerNodeCount:workerNodes,
      tensorBoardDataPath,
    }).catch((e) => {
      const ex = e as ServiceError;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Submit train job failed, ${ex.details}`,
      });
    });

    // Save session metadata
    const metadata: SessionMetadata = {
      jobId: reply.jobId,
      jobName:trainJobName,
      sessionId: scowWorkDirectoryName,
      submitTime: new Date().toISOString(),
      image: {
        name: remoteImageUrl || existImage!.name,
        tag: existImage?.tag || "latest",
      },
      jobType: JobType.TRAIN,
    };

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: join(homeDir,trainJobsDirectory, SESSION_METADATA_NAME),
        content: JSON.stringify(metadata),
      }),
      this.logger,
    );

    await wrap(
      this.client.file.writeFile({
        userId: this.userId,
        filePath: join(homeDir,trainJobsDirectory, `${reply.jobId}-input.json`),
        content: JSON.stringify(inputParams),
      }),
      this.logger,
    );

    return reply.jobId;
  }

  async getTrainParams(sessionId: string, jobId: number): Promise<TrainJobInput> {
    const { path:homeDir } = await wrap(
      this.client.file.getHomeDirectory({
        userId: this.userId,
      }),
      this.logger,
    );
    const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

    // 读取作业信息
    const metadataPath = join(homeDir,jobsDirectory, SESSION_METADATA_NAME);

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
        code:"NOT_FOUND",
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
    const sessionMetadata = JSON.parse(contentRes.content.toString()) as SessionMetadata;
    if (sessionMetadata.jobType !== JobType.TRAIN) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Job type of job ${jobId} is not Train`,
      });
    }
    const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

    return await scowdFetchJobInputParams<TrainJobInput>(
      this.userId,inputParamsPath, this.client, TrainJobInputSchema, this.logger,
    );
  }
}
