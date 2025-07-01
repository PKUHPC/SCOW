import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@grpc/grpc-js";
import { JobInfo } from "@scow/ai-scheduler-adapter-protos/build/protos/job";
import { getPlaceholderKeys } from "@scow/lib-config/build/parse";
import { getEnvVariables } from "@scow/lib-server";
import { getUserHomedir, sftpExists, sftpLstat, sftpReaddir, sftpReadFile, sftpRealPath,
  sftpWriteFile } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import dayjs from "dayjs";
import { join } from "path";
import { quote } from "shell-quote";
import { JobType } from "src/models/Job";
import { aiConfig } from "src/server/config/ai";
import { genPublicOrPrivateDataJsonString, getClusterAppConfigs, sshFetchJobInputParams,
  validateUniquePaths } from "src/server/utils/app";
import { getAdapterClient } from "src/server/utils/clusters";
import { logger } from "src/server/utils/logger";
import { getAppConnectionInfoFromAdapterForAi } from "src/server/utils/schedulerAdapterUtils";
import { sshConnect } from "src/server/utils/ssh";
import { formatTime } from "src/utils/datetime";
import { isParentOrSameFolder } from "src/utils/file";
import { Logger } from "ts-log";

import { AppSession,CreateAppInput, CreateAppInputSchema, SERVER_ENTRY_COMMAND, SERVER_SESSION_INFO,
  SESSION_METADATA_NAME,SessionMetadata,VNC_ENTRY_COMMAND } from "../../route/jobs/apps";
import { InferenceJobInput,InferenceJobInputSchema,SessionMetadata as InferSessionMetadata }
  from "../../route/jobs/infer";
import { TrainJobInput, TrainJobInputSchema } from "../../route/jobs/jobs";
import { ConnectToAppResponse, CreateAppExtraParams, JobDriver, SubmitInferJobExtraParams,
  SubmitTrainJobExtraParams } from "./jobDriver";

export class SshJobDriver implements JobDriver {
  constructor(
    private host: string,
    private userId: string,
    private logger: Logger,
  ) {}

  async createApp(inputParams: CreateAppInput, extraParams: CreateAppExtraParams): Promise<number> {

    const { workingDirectory,mountPoints = [],clusterId,appId,customAttributes,
      startCommand,appJobName,account,partition,coreCount,nodeCount,gpuCount,memory,maxTime,
      remoteImageUrl,gpuType,qos,
    } = inputParams;
    const { isAlgorithmPrivates,isDatasetPrivates,isModelPrivates, algorithmVersions, datasetVersions,
      modelVersions,app,proxyBasePath,existImage } = extraParams;

    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const homeDir = await getUserHomedir(ssh, this.userId, logger);
      const sftp = await ssh.requestSFTP();

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
        const lstat = await sftpLstat(sftp)(path).catch((e) => {
          logger.error(e, "lstat %s as %s failed", path, this.userId);
          throw new TRPCError({ code: "FORBIDDEN", message: `${path} is not accessible` });
        });

        if (lstat.isSymbolicLink()) {
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
      await ssh.mkdir(appJobsDirectory);
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

      // 将entry.sh写入后将路径传给适配器后启动容器
      await sftpWriteFile(sftp)(remoteEntryPath, entryScript);

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
          (remoteImageUrl || (existImage ? existImage.path : `${app.image.name}:${app.image.tag || "latest"}`)) || "",
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
        image: existImage ? { name: existImage.name, tag: existImage.tag } : app.image,
        jobType: JobType.APP,
      };
      await sftpWriteFile(sftp)(join(appJobsDirectory, SESSION_METADATA_NAME), JSON.stringify(metadata));

      // 保存提交参数
      await sftpWriteFile(sftp)(join(appJobsDirectory, `${reply.jobId}-input.json`), JSON.stringify(inputParams));

      return reply.jobId;
    });
  }

  async getAppParams(sessionId: string, jobId: number): Promise<CreateAppInput> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const homeDir = await getUserHomedir(ssh, this.userId, logger);
      const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

      const sftp = await ssh.requestSFTP();

      // 读取作业信息
      const metadataPath = join(jobsDirectory, SESSION_METADATA_NAME);

      if (!await sftpExists(sftp, metadataPath)) {
        return {} as CreateAppInput;
      }

      const content = await sftpReadFile(sftp)(metadataPath);
      const sessionMetadata = JSON.parse(content.toString()) as SessionMetadata;

      if (sessionMetadata.jobType !== JobType.APP) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Job type of job ${jobId} is not APP`,
        });
      }

      const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

      return await sshFetchJobInputParams<CreateAppInput>(
        inputParamsPath, sftp, CreateAppInputSchema, logger,
      );
    });
  }

  async getAiJobs(clusterId: string, isRunning: boolean): Promise<AppSession[]> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const apps = getClusterAppConfigs(clusterId);
      const terminatedStates = ["BOOT_FAIL", "COMPLETED", "DEADLINE", "FAILED",
        "NODE_FAIL", "PREEMPTED", "SPECIAL_EXIT", "TIMEOUT","CANCELED"];

      // If a job is not running, it cannot be ready
      const client = getAdapterClient(clusterId);
      const runningJobsInfo = await asyncClientCall(client.job, "getJobs", {
        fields: ["job_id", "state", "elapsed_seconds", "time_limit_minutes", "reason","partition","gpus_alloc",
          "cpus_alloc","mem_alloc_mb","nodes_alloc",
        ],
        filter: {
          users: [this.userId], accounts: [],
          states: isRunning ? ["RUNNING", "PENDING"] : terminatedStates,
        },
      }).then((resp) => resp.jobs);

      const runningJobInfoMap = runningJobsInfo.reduce((prev, curr) => {
        prev[curr.jobId] = curr;
        return prev;
      }, {} as Record<number, JobInfo>);

      const homeDir = await getUserHomedir(ssh, this.userId, logger);
      const appJobsDirectory = join(homeDir, aiConfig.appJobsDir);
      const sftp = await ssh.requestSFTP();

      if (!await sftpExists(sftp, appJobsDirectory)) {
        logger.error("appJobsDirectory %s not exists", appJobsDirectory);
        return [];
      }
      const list = await sftpReaddir(sftp)(appJobsDirectory);
      const sessions = [] as AppSession[];

      await Promise.all(list.map(async ({ filename }) => {
        const jobDir = join(appJobsDirectory, filename);
        const metadataPath = join(jobDir, SESSION_METADATA_NAME);

        if (!await sftpExists(sftp, metadataPath)) {
          return;
        }

        const content = await sftpReadFile(sftp)(metadataPath);
        const sessionMetadata = JSON.parse(content.toString()) as SessionMetadata;

        const runningJobInfo: JobInfo | undefined = runningJobInfoMap[sessionMetadata.jobId];

        if (!runningJobInfo) {
          return;
        }

        const isPendingOrTerminated = runningJobInfo.state === "PENDING"
            || terminatedStates.includes(runningJobInfo.state);

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
          dataPath: await sftpRealPath(sftp)(jobDir),
          runningTime: runningJobInfo.elapsedSeconds !== undefined
            ? formatTime(runningJobInfo.elapsedSeconds * 1000) : "",
          timeLimit: runningJobInfo.timeLimitMinutes ? formatTime(runningJobInfo.timeLimitMinutes * 60 * 1000) : "",
          reason: isPendingOrTerminated ? (runningJobInfo.reason ?? "") : undefined,
          partition:runningJobInfo.partition,
          cpusAlloc:runningJobInfo.cpusAlloc ?? 0,
          gpusAlloc:runningJobInfo.gpusAlloc ?? 0,
          memAlloc:runningJobInfo.memAllocMb ?? 0,
          nodesAlloc:runningJobInfo.nodesAlloc ?? 0,
        });
      }));
      const runningStates = ["RUNNING", "PENDING"];

      const filteredSessions = sessions.filter((session) =>
        isRunning
          ? runningStates.includes(session.state)
          : !runningStates.includes(session.state))
        .sort((a, b) => b.submitTime.localeCompare(a.submitTime));
      return filteredSessions;
    });
  }

  async connectToApp(clusterId: string, sessionId: string): Promise<ConnectToAppResponse> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const userHomeDir = await getUserHomedir(ssh, this.userId, this.logger);
      const jobDir = join(userHomeDir, aiConfig.appJobsDir, sessionId);

      if (!await sftpExists(sftp, jobDir)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `session id ${sessionId} is not found`,
        });
      }

      const metadataPath = join(jobDir, SESSION_METADATA_NAME);
      const content = await sftpReadFile(sftp)(metadataPath);
      const sessionMetadata = JSON.parse(content.toString()) as SessionMetadata;

      if (sessionMetadata.jobType === JobType.APP && sessionMetadata.appId) {
        const client = getAdapterClient(clusterId);
        const connectionInfo = await getAppConnectionInfoFromAdapterForAi(client, sessionMetadata.jobId, logger);
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
    });
  }

  async submitInferJob(inputParams: InferenceJobInput, extraParams: SubmitInferJobExtraParams): Promise<number> {
    const { mountPoints = [],clusterId,command,InferenceJobName,account,partition,coreCount,nodeCount,
      gpuCount,memory,maxTime,remoteImageUrl,gpuType,containerServicePort,qos } = inputParams;
    const { isModelPrivates,modelVersions,existImage } = extraParams;
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {

      const homeDir = await getUserHomedir(ssh, this.userId, logger);
      const sftp = await ssh.requestSFTP();

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
        const lstat = await sftpLstat(sftp)(path).catch((e) => {
          logger.error(e, "lstat %s as %s failed", path, this.userId);
          throw new TRPCError({ code: "FORBIDDEN", message: `${path} is not accessible` });
        });

        if (lstat.isSymbolicLink()) {
          throw new TRPCError({ code: "FORBIDDEN", message: `${path} is a symbolic link, not a directory` });
        }
      }

      // make sure trainJobsDirectory exists.
      await ssh.mkdir(inferJobsDirectory);
      const remoteEntryPath = join(homeDir, inferJobsDirectory, "entry.sh");

      const entryScript = command;
      await sftpWriteFile(sftp)(remoteEntryPath, entryScript);

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
        workingDirectory: inferJobsDirectory,
        script: remoteEntryPath,
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
      await sftpWriteFile(sftp)(join(inferJobsDirectory, SESSION_METADATA_NAME), JSON.stringify(metadata));

      // 保存提交参数
      await sftpWriteFile(sftp)(join(inferJobsDirectory, `${reply.jobId}-input.json`), JSON.stringify(inputParams));

      return reply.jobId;
    });
  }
  async getInferParams(sessionId: string, jobId: number): Promise<InferenceJobInput> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const homeDir = await getUserHomedir(ssh, this.userId, logger);
      const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

      const sftp = await ssh.requestSFTP();

      // 读取作业信息
      const metadataPath = join(jobsDirectory, SESSION_METADATA_NAME);

      if (!await sftpExists(sftp, metadataPath)) {
        return {} as InferenceJobInput;
      }

      const content = await sftpReadFile(sftp)(metadataPath);
      const sessionMetadata = JSON.parse(content.toString()) as SessionMetadata;

      if (sessionMetadata.jobType !== JobType.INFER) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Job type of job ${jobId} is not Infer`,
        });
      }

      const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

      return await sshFetchJobInputParams<InferenceJobInput>(
        inputParamsPath, sftp, InferenceJobInputSchema, logger,
      );
    });
  }

  async submitTrainJob(inputParams: TrainJobInput, extraParams: SubmitTrainJobExtraParams): Promise<number> {
    const { mountPoints = [],clusterId,account,partition,coreCount,nodeCount,gpuCount,memory,maxTime,
      remoteImageUrl,gpuType,command,trainJobName,framework,psNodes,workerNodes,qos,
    } = inputParams;
    const { isAlgorithmPrivates,isDatasetPrivates,isModelPrivates, algorithmVersions, datasetVersions,
      modelVersions,existImage } = extraParams;
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const homeDir = await getUserHomedir(ssh, this.userId, logger);
      const sftp = await ssh.requestSFTP();

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
        const lstat = await sftpLstat(sftp)(path).catch((e) => {
          logger.error(e, "lstat %s as %s failed", path, this.userId);
          throw new TRPCError({ code: "FORBIDDEN", message: `${path} is not accessible` });
        });

        if (lstat.isSymbolicLink()) {
          throw new TRPCError({ code: "FORBIDDEN", message: `${path} is a symbolic link, not a directory` });
        }
      }

      // make sure trainJobsDirectory exists.
      await ssh.mkdir(trainJobsDirectory);
      const remoteEntryPath = join(homeDir, trainJobsDirectory, "entry.sh");

      const entryScript = command;
      await sftpWriteFile(sftp)(remoteEntryPath, entryScript);

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
        workingDirectory: trainJobsDirectory,
        script: remoteEntryPath,
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
      await sftpWriteFile(sftp)(join(trainJobsDirectory, SESSION_METADATA_NAME), JSON.stringify(metadata));

      // 保存提交参数
      await sftpWriteFile(sftp)(join(trainJobsDirectory, `${reply.jobId}-input.json`), JSON.stringify(inputParams));

      return reply.jobId;
    });
  }

  async getTrainParams(sessionId: string, jobId: number): Promise<TrainJobInput> {
    return await sshConnect(this.host, this.userId, this.logger, async (ssh) => {
      const homeDir = await getUserHomedir(ssh, this.userId, logger);
      const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

      const sftp = await ssh.requestSFTP();

      // 读取作业信息
      const metadataPath = join(jobsDirectory, SESSION_METADATA_NAME);

      if (!await sftpExists(sftp, metadataPath)) {
        return {} as TrainJobInput;
      }

      const content = await sftpReadFile(sftp)(metadataPath);
      const sessionMetadata = JSON.parse(content.toString()) as SessionMetadata;

      if (sessionMetadata.jobType !== JobType.TRAIN) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Job type of job ${jobId} is not Train`,
        });
      }

      const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

      return await sshFetchJobInputParams<TrainJobInput>(
        inputParamsPath, sftp, TrainJobInputSchema, logger,
      );
    });
  }
}
