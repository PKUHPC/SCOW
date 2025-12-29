import { ConnectError } from "@connectrpc/connect";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError as GrpcServiceError } from "@ddadaal/tsgrpc-common";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { AppType, AttributeType } from "@scow/config/build/app";
import { getPlaceholderKeys } from "@scow/lib-config/build/parse";
import { formatTime } from "@scow/lib-scheduler-adapter";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { errorInfo, getAppConnectionInfoFromAdapter,getEnvVariables } from "@scow/lib-server";
import { DetailedError, ErrorInfo, parseErrorStatus } from "@scow/rich-error-model";
import { JobInfo, SubmitJobRequest } from "@scow/scheduler-adapter-protos/build/job";
import { FileInfo, FileType } from "@scow/scowd-protos/build/storage/file_pb";
import dayjs from "dayjs";
import { join } from "path";
import { quote } from "shell-quote";
import { AppOps, AppSession, SubmissionInfo } from "src/clusterops/api/app";
import { portalConfig } from "src/config/portal";
import { APP_LAST_SUBMISSION_INFO, BIN_BASH_SCRIPT_HEADER, ENDED_SESSIONS, getClusterAppConfigs,
  readEndedSessionsFile, SERVER_ENTRY_COMMAND, SERVER_SESSION_INFO, ServerSessionInfoData, SESSION_METADATA_NAME,
  SessionMetadata, SHADOWDESK_SESSION, ShadowDeskSession, splitSbatchArgs, VNC_ENTRY_COMMAND,
  VNC_OUTPUT_FILE, VNC_SESSION_INFO, writeEndedSessionsFileContent,
} from "src/utils/app";
import { callOnOne, getAdapterClient } from "src/utils/clusters";
import { mapConnectRpcStatusToGrpc } from "src/utils/scowd";
import { displayIdToPort, getTurboVNCBinPath, parseDisplayId, parseOtp } from "src/utils/turbovnc";


export const scowdAppServices = (cluster: string, client: ScowdClient): AppOps => {

  return {
    createApp: async (request, logger) => {
      const apps = getClusterAppConfigs(cluster);

      const { appId, userId, account, coreCount, nodeCount, gpuCount, memory, maxTime, proxyBasePath,
        partition, qos, customAttributes, appJobName } = request;

      const jobName = appJobName;

      const memoryMb = memory ? Number(memory.slice(0, -2)) : undefined;

      const userSbatchOptions = customAttributes.sbatchOptions
        ? splitSbatchArgs(customAttributes.sbatchOptions)
        : [];

      // prepare script file
      const appConfig = apps[appId];

      if (!appConfig) {
        throw new DetailedError({
          code: Status.NOT_FOUND,
          message: `app id ${appId} is not found`,
          details: [errorInfo("NOT FOUND")],
        });
      }

      const workDirectoryName = `${cluster}-${appId}-${dayjs().format("YYYYMMDD-HHmmss")}`;

      let workingDirectory = "";
      let lastSubmissionDirectory = "";

      try {
        const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;
        workingDirectory = join(userHomeDir, portalConfig.appJobsDir, workDirectoryName);
        lastSubmissionDirectory = join(userHomeDir, portalConfig.appLastSubmissionDir, appId);

        // make sure workingDirectory exists.
        await client.file.makeDirectory({ userId, dirPath: workingDirectory });
        // make sure lastSubmissionDirectory exists.
        await client.file.makeDirectory({ userId, dirPath: lastSubmissionDirectory });
      } catch (err) {
        if (err instanceof ConnectError) {
          const grpcErr = { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
          if (grpcErr.code !== status.ALREADY_EXISTS) {
            throw grpcErr;
          }
        }
      }

      const submitAndWriteMetadata = async (request: SubmitJobRequest) => {
        const remoteEntryPath = join(workingDirectory, "entry.sh");

        // submit entry.sh
        const reply = await callOnOne(
          cluster,
          logger,
          async (client) => await asyncClientCall(client.job, "submitJob", request),
        ).catch((e) => {
          const ex = e as ServiceError;

          const { findDetails } = parseErrorStatus(ex.metadata);

          const errorInfos = findDetails(ErrorInfo);

          if (errorInfos.find((x) => x.reason === "SBATCH_FAILED")) {
            throw new DetailedError({
              code: Status.INTERNAL,
              message: ex.details,
              details: [errorInfo("SBATCH_FAILED")],
            });
          }
          else {
            throw new DetailedError({
              code: ex.code,
              message: ex.details,
              details: [errorInfo("SBATCH_FAILED")],
            });
          }
        });

        const jobId = reply.jobId;

        const metadata: SessionMetadata = {
          jobId,
          jobName: appJobName,
          sessionId: workDirectoryName,
          submitTime: new Date().toISOString(),
          appId,
        };

        // write a last_submission session
        const lastSubmissionInfo: SubmissionInfo = {
          userId,
          cluster,
          appId,
          appName: apps[appId].name,
          account: request.account,
          partition: request.partition,
          qos: request.qos,
          nodeCount: request.nodeCount,
          coreCount: request.coreCount,
          maxTime: request.timeLimitMinutes!,
          gpuCount: request.gpuCount,
          submitTime: new Date().toISOString(),
          customAttributes: customAttributes,
        };

        try {
          // entry.sh save the generated script
          await client.file.writeFile({ userId, filePath: remoteEntryPath, content: reply.generatedScript });

          // write session metadata
          await client.file.writeFile({
            userId, filePath: join(workingDirectory, SESSION_METADATA_NAME), content: JSON.stringify(metadata) });

          // write a last_submission session
          await client.file.writeFile({
            userId, filePath: join(lastSubmissionDirectory, APP_LAST_SUBMISSION_INFO),
            content: JSON.stringify(lastSubmissionInfo),
          });
        } catch (err) {
          if (err instanceof ConnectError) {
            throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
          }
          throw err;
        }


        return { jobId, sessionId: metadata.sessionId } as const;
      };

      let customAttributesExport: string = "";
      for (const key in customAttributes) {
        let quotedAttribute = "";

        // select类型的属性值是管理员配置的，无需处理特殊字符，可以让配置的特殊字符(如 $)生效
        if (
          appConfig.attributes?.find((attribute) =>
            attribute.name === key && attribute.type === AttributeType.select,
          )
        ) {
          quotedAttribute = customAttributes[key]?.toString() ?? "";
        } else {
          quotedAttribute = quote([customAttributes[key]?.toString() ?? ""]);
        }

        const envItem = `export ${key}=${quotedAttribute}`;
        customAttributesExport = customAttributesExport + envItem + "\n";
      }

      try {
        if (appConfig.type === AppType.web) {
          let customForm = String.raw`\"HOST\":\"$HOST\",\"PORT\":$PORT`;
          for (const key in appConfig.web!.connect.formData) {
            const texts = getPlaceholderKeys(appConfig.web!.connect.formData[key]);
            for (const i of texts) {
              customForm += `,\\"${i}\\":\\"$${i}\\"`;
            }
          }
          const sessionInfo = `echo -e "{${customForm}}" >$SERVER_SESSION_INFO`;

          const runtimeVariables = `export PROXY_BASE_PATH=${quote([join(proxyBasePath, appConfig.web!.proxyType)])}\n`;

          const beforeScript = runtimeVariables + customAttributesExport + appConfig.web!.beforeScript + sessionInfo;
          await client.file.writeFile({ userId, filePath: join(workingDirectory, "before.sh"), content: beforeScript });

          const webScript = BIN_BASH_SCRIPT_HEADER + appConfig.web!.script;
          const scriptPath = join(workingDirectory, "script.sh");
          await client.file.writeFile({ userId, filePath: scriptPath, content: webScript });
          await client.file.changeMode({ userId, path: scriptPath, mode: "0755" });


          const configSlurmOptions: string[] = appConfig.slurm?.options ?? [];

          const extraOptions = configSlurmOptions.concat(userSbatchOptions);

          const envVariables = getEnvVariables({ SERVER_SESSION_INFO });

          return await submitAndWriteMetadata({
            userId, jobName, account, partition: partition!, qos, nodeCount, gpuCount: gpuCount ?? 0, memoryMb,
            coreCount, timeLimitMinutes: maxTime, script: envVariables + SERVER_ENTRY_COMMAND,
            workingDirectory, extraOptions,
            envVariables: [],
          });
        } else if (appConfig.type === AppType.shadowDesk) {
          let customForm = String.raw`\"HOST\":\"$HOST\",\"PORT\":$PORT`;
          for (const key in appConfig.shadowDesk!.connect.formData) {
            const texts = getPlaceholderKeys(appConfig.shadowDesk!.connect.formData[key]);
            for (const i of texts) {
              customForm += `,\\"${i}\\":\\"$${i}\\"`;
            }
          }
          customForm += `,\\"PROXYSERVER\\":\\"${appConfig.shadowDesk!.proxyServer}\\"`;
          const sessionInfo = `echo -e "{${customForm}}" >$SERVER_SESSION_INFO`;

          const runtimeVariables = `export PROXY_BASE_PATH=${quote([join(proxyBasePath)])}\n`;

          const beforeScript = runtimeVariables + customAttributesExport +
            appConfig.shadowDesk!.beforeScript + sessionInfo;
          await client.file.writeFile({ userId, filePath: join(workingDirectory, "before.sh"), content: beforeScript });

          const webScript = BIN_BASH_SCRIPT_HEADER + appConfig.shadowDesk!.script;
          const scriptPath = join(workingDirectory, "script.sh");
          await client.file.writeFile({ userId, filePath: scriptPath, content: webScript });
          await client.file.changeMode({ userId, path: scriptPath, mode: "0755" });


          const configSlurmOptions: string[] = appConfig.slurm?.options ?? [];

          const extraOptions = configSlurmOptions.concat(userSbatchOptions);

          const envVariables = getEnvVariables({ SERVER_SESSION_INFO });

          return await submitAndWriteMetadata({
            userId, jobName, account, partition: partition!, qos, nodeCount, gpuCount: gpuCount ?? 0, memoryMb,
            coreCount, timeLimitMinutes: maxTime, script: envVariables + SERVER_ENTRY_COMMAND,
            workingDirectory, extraOptions,
            envVariables: [],
          });
        } else {
          // vnc app
          const beforeScript = customAttributesExport + (appConfig.vnc!.beforeScript ?? "");
          await client.file.writeFile({ userId, filePath: join(workingDirectory, "before.sh"), content: beforeScript });

          const xstartupPath = join(workingDirectory, "xstartup");
          const xstartupScript = BIN_BASH_SCRIPT_HEADER + appConfig.vnc!.xstartup;
          await client.file.writeFile({ userId, filePath: xstartupPath, content: xstartupScript });
          await client.file.changeMode({ userId, path: xstartupPath, mode: "0755" });


          const configSlurmOptions: string[] = appConfig.slurm?.options ?? [];

          const extraOptions = configSlurmOptions.concat(userSbatchOptions);

          const vncserverBinPath = getTurboVNCBinPath(cluster, "vncserver");

          const envVariables = getEnvVariables({ VNC_SESSION_INFO, VNCSERVER_BIN_PATH: vncserverBinPath });

          return await submitAndWriteMetadata({
            userId, jobName, account, partition: partition!, qos, nodeCount, gpuCount: gpuCount ?? 0, memoryMb,
            coreCount, timeLimitMinutes: maxTime, script: envVariables + VNC_ENTRY_COMMAND,
            workingDirectory, stdout: VNC_OUTPUT_FILE, extraOptions,
            envVariables: [],
          });
        }
      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }
    },

    getAppLastSubmission: async (request, logger) => {
      const { userId, appId } = request;

      try {
        const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;
        const file = join(userHomeDir, portalConfig.appLastSubmissionDir, appId, APP_LAST_SUBMISSION_INFO);

        if (!(await client.file.exists({ userId, path: file })).exists) { return { lastSubmissionInfo: undefined }; }
        const content = (await client.file.readFile({ userId, filePath: file })).content;

        try {
          const data = JSON.parse(content.toString()) as SubmissionInfo;
          return { lastSubmissionInfo: data };
        } catch (error) {
          logger.error("Parsing JSON failed, the content is %s,the error is %o",content.toString(), error);
        }
      } catch (err) {
        logger.error("Reading last submission file failed. It will be recreated after next submission.", err);
      };

      return { lastSubmissionInfo: undefined };

    },

    listAppSessions: async (request, logger) => {

      const apps = getClusterAppConfigs(cluster);

      const { userId } = request;

      // If a job is not running, it cannot be ready
      const runningJobsInfo = await callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.job, "getJobs", {
          fields: ["job_id", "state", "elapsed_seconds", "time_limit_minutes", "reason"],
          jobTypes: [],
          filter: {
            users: [userId], accounts: [],
            states: ["RUNNING", "PENDING"],
          },
        }),
      ).then((resp) => resp.jobs);

      const runningJobInfoMap = runningJobsInfo.reduce((prev, curr) => {
        prev[curr.jobId] = curr;
        return prev;
      }, {} as Record<number, JobInfo>);

      try {
        const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;
        const userAppJobDir = join(userHomeDir, portalConfig.appJobsDir);

        if (!(await client.file.exists({ userId, path: userAppJobDir })).exists) { return { sessions: []}; }

        // get all job directories
        let list: FileInfo[];
        try {
          list = (await client.file.readDirectory({ userId, dirPath: userAppJobDir })).filesInfo;
        } catch (error: any) {
          // 如果用户应用作业目录不存在或不是目录，返回空会话列表
          logger.warn(`Failed to read user app job directory ${userAppJobDir} for user ${userId}: ${error}`);
          return { sessions: []};
        }
        const sessions = [] as AppSession[];

        const endedSessionsFilePath = join(userAppJobDir, ENDED_SESSIONS);
        // 定义用于存储已存在的 endedSessions 的 session 信息
        const existingEndedSessions: SessionMetadata[] = [];
        // 定义用于存储本次需要添加的 endedSessions
        const newEndedSessions: SessionMetadata[] = [];

        const runningJobIds = Object.keys(runningJobInfoMap);

        const existingSessionIds = new Set<string>();

        const runningJobIdsInEndedSessions: number[] = [];

        // 如果ended_sessions.json 已存在，将其中的信息作为已结束的应用的session信息
        if ((await client.file.exists({ userId, path: endedSessionsFilePath })).exists) {

          try {
            const endedSessionLines = await readEndedSessionsFile(client, userId, endedSessionsFilePath, logger);
            existingEndedSessions.push(...endedSessionLines);
          } catch (err) {
            logger.warn("Error occurred in reading endedSessionsFile. The file will be recreated.", err);
          }


          if (existingEndedSessions.length > 0) {
            logger.trace(`Found ${existingEndedSessions.length} ended sessions in ${ENDED_SESSIONS}`);
            for (const endedSession of existingEndedSessions) {

              // 如果出现保存的信息的作业ID与RunningJobs中返回的作业Id一致的情况，认为该作业为延时返回的正在运行的作业的信息
              if (runningJobIds.includes(endedSession.jobId.toString())) {
                runningJobIdsInEndedSessions.push(endedSession.jobId);
                continue;
              }

              const endedJobDir = join(userAppJobDir, endedSession.sessionId);
              sessions.push({
                jobId: endedSession.jobId,
                appId: endedSession.appId,
                appName: apps[endedSession.appId]?.name,
                jobName: endedSession.jobName ?? "",
                sessionId: endedSession.sessionId,
                submitTime: new Date(endedSession.submitTime),
                state: "ENDED",
                dataPath: endedJobDir,
                runningTime: "",
                timeLimit: "",
                appType: apps[endedSession.appId]?.type,
                host: undefined,
                port: undefined,
              });

              // 获取已存在的 endedSessions 的 sessionId，对应session的目录名
              existingSessionIds.add(endedSession.sessionId);
            }
          }
        }

        if (runningJobIdsInEndedSessions.length > 0) {
          logger.trace(`Running jobs ${runningJobIdsInEndedSessions.join(",")} found in the ended_sessions file, `
                  + "possibly written due to delayed returns. They will be ignored in the display of completed jobs.");
        }

        await Promise.all(list.map(async ({ name, fileType }) => {

          // 如果name是已存在的 endedSessions 的 sessionId 或是一个文件则跳过
          if (existingSessionIds.has(name) || fileType === FileType.FILE) {
            return;
          }

          const jobDir = join(userAppJobDir, name);
          const metadataPath = join(jobDir, SESSION_METADATA_NAME);

          try {
            if (!(await client.file.exists({ userId, path: metadataPath })).exists) {
              return;
            }
          } catch (error: any) {
            // 可能由于没有读取权限或 jobDir 本身并不是目录而报错，此时忽略这个条目
            logger.warn(`Failed to check metadata file ${metadataPath} for user ${userId}: ${error}`);
            return;
          }


          const content = (await client.file.readFile({ userId, filePath: metadataPath })).content;

          let sessionMetadata: SessionMetadata | undefined;

          try {
            sessionMetadata = JSON.parse(content.toString()) as SessionMetadata;
          } catch (error) {
            logger.error("Parsing JSON failed, the content is %s,the error is %o",content.toString(),error);
          }

          if (!sessionMetadata) return;

          const runningJobInfo: JobInfo | undefined = runningJobInfoMap[sessionMetadata.jobId];

          const app = apps[sessionMetadata.appId];

          let host: string | undefined = undefined;
          let port: number | undefined = undefined;
          let user: string | undefined = undefined;
          let proxyServer: string | undefined = undefined;
          let connectPath: string | undefined = undefined;

          // judge whether the app is ready
          if (runningJobInfo && runningJobInfo.state === "RUNNING") {
            // 对于k8s这种通过容器运行作业的集群，当把容器中的作业工作目录挂载到宿主机中时，目录中新生成的文件不会马上反映到宿主机中，
            // 具体体现为sftpExists无法找到新生成的SERVER_SESSION_INFO和VNC_SESSION_INFO文件，必须实际读取一次目录，才能识别到它们
            try {
              await client.file.readDirectory({ userId, dirPath: jobDir });
            } catch (error: any) {
              // 如果路径不是目录，跳过此条目
              logger.warn(`Failed to read directory ${jobDir} for user ${userId}: ${error}`);
              return;
            }

            if (app.type === AppType.web || app.type === AppType.shadowDesk) {
              // for server apps,
              // try to read the SESSION_INFO file to get port and password
              const infoFilePath = join(jobDir, SERVER_SESSION_INFO);
              if ((await client.file.exists({ userId, path: infoFilePath })).exists) {
                const content = (await client.file.readFile({ userId, filePath: infoFilePath })).content;
                let serverSessionInfo: ServerSessionInfoData | undefined;

                try {
                  serverSessionInfo = JSON.parse(content.toString()) as ServerSessionInfoData;
                  host = serverSessionInfo.HOST;
                  port = serverSessionInfo.PORT;
                } catch (error) {
                  logger.error("Parsing JSON failed, the content is %s,the error is %o",content.toString(),error);
                }

                if (app.type === AppType.shadowDesk) {
                  if (serverSessionInfo) {
                    proxyServer = serverSessionInfo.PROXYSERVER as string;
                    connectPath = app.shadowDesk!.connect.path;
                  }
                  else {
                    logger.error("Getting serverSessionInfo.PROXYSERVER failed");
                  }
                }
              }
              if (app.type === AppType.shadowDesk) {
                const shadowDeskFilePath = join(jobDir, SHADOWDESK_SESSION);
                if ((await client.file.exists({ userId, path: shadowDeskFilePath })).exists) {
                  const content = (await client.file.readFile({ userId, filePath: shadowDeskFilePath })).content;
                  try {
                    const sessionInfo = JSON.parse(content.toString()) as ShadowDeskSession;
                    user = sessionInfo.SHADOWDESK_USER;
                  } catch (err) {
                    logger.error("Parsing JSON failed, the content is %s,the error is %o", content.toString(), err);
                  }
                }
              }
            } else {
              // for vnc apps,
              // try to find the output file and try to parse the display number
              const vncSessionInfoPath = join(jobDir, VNC_SESSION_INFO);
              if ((await client.file.exists({ userId, path: vncSessionInfoPath })).exists) {
                const outputFilePath = join(jobDir, VNC_OUTPUT_FILE);
                if ((await client.file.exists({ userId, path: outputFilePath })).exists) {
                  const content = (await client.file.readFile({
                    userId, filePath: outputFilePath,
                  })).content.toString();

                  try {
                    const displayId = parseDisplayId(content);
                    port = displayIdToPort(displayId);
                  } catch {
                    // ignored if displayId cannot be parsed
                  }
                }

                host = (await client.file.readFile({
                  userId, filePath: vncSessionInfoPath,
                })).content.toString().trim();
              }
            }

            const connectionInfo = await callOnOne(
              cluster,
              logger,
              async (client) => await getAppConnectionInfoFromAdapter(client, sessionMetadata.jobId, logger),
            );
            if (connectionInfo?.response?.$case === "appConnectionInfo") {
              host = connectionInfo.response.appConnectionInfo.host;
              port = connectionInfo.response.appConnectionInfo.port;
            }
          } else {

            // 如果不是 RUNNING 或 PENDING 的文件， 将文件写入 ended_sessions.json
            if (runningJobInfo && runningJobInfo.state === "PENDING") {
              logger.trace(`Job ${sessionMetadata.jobId} is a pending job,`
                + " skipping in saving to ended_sessions.json");
            } else {
              if (runningJobIdsInEndedSessions.includes(sessionMetadata.jobId)) {
                logger.trace(`Job ${sessionMetadata.jobId} has already been to written into ended_sessions file, `
                  + "possibly due to delayed return, skipping in saving to ended_sessions.json");
              } else {
                logger.trace(`Job ${sessionMetadata.jobId} is not running, saving to ended_sessions file ...`);
                // write app session (except running jobs) to last endedSessions.json
                const endedSessionInfo: SessionMetadata = {
                  jobId: sessionMetadata.jobId,
                  jobName: sessionMetadata.jobName,
                  sessionId: sessionMetadata.sessionId,
                  submitTime: sessionMetadata.submitTime,
                  appId: sessionMetadata.appId,
                };
                newEndedSessions.push(endedSessionInfo);
              }
            }

          }

          const terminatedStates = ["BOOT_FAIL", "COMPLETED", "DEADLINE", "FAILED",
            "NODE_FAIL", "PREEMPTED", "SPECIAL_EXIT", "TIMEOUT"];
          const isPendingOrTerminated = runningJobInfo?.state === "PENDING"
              || terminatedStates.includes(runningJobInfo?.state);

          sessions.push({
            jobId: sessionMetadata.jobId,
            jobName: sessionMetadata.jobName ?? "",
            appId: sessionMetadata.appId,
            appName: apps[sessionMetadata.appId]?.name,
            sessionId: sessionMetadata.sessionId,
            submitTime: new Date(sessionMetadata.submitTime),
            state: runningJobInfo?.state ?? "ENDED",
            dataPath: jobDir,
            runningTime: runningJobInfo?.elapsedSeconds !== undefined
              ? formatTime(runningJobInfo.elapsedSeconds * 1000) : "",
            timeLimit: runningJobInfo?.timeLimitMinutes ? formatTime(runningJobInfo.timeLimitMinutes * 60 * 1000) : "",
            reason: isPendingOrTerminated ? (runningJobInfo?.reason ?? "") : undefined,
            host,
            port,
            user,
            proxyServer,
            connectPath,
            appType: apps[sessionMetadata.appId]?.type,
          });

        }));

        try {
          await writeEndedSessionsFileContent(
            client, userId, endedSessionsFilePath,
            existingEndedSessions, newEndedSessions, logger,
          );
        } catch (err) {
          logger.warn("Error occurred in writing ended sessions. It will be executed again on the next request.", err);
        }

        return { sessions };

      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }
    },

    connectToApp: async (request, logger) => {
      const apps = getClusterAppConfigs(cluster);

      const { sessionId, userId, jobId } = request;

      try {
        const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;
        const jobDir = join(userHomeDir, portalConfig.appJobsDir, sessionId);

        if (!(await client.file.exists({ userId, path: jobDir })).exists) {
          throw new GrpcServiceError({ code: Status.NOT_FOUND, message: `session id ${sessionId} is not found` });
        }

        const metadataPath = join(jobDir, SESSION_METADATA_NAME);
        const content = (await client.file.readFile({ userId, filePath: metadataPath })).content;
        const sessionMetadata = JSON.parse(content.toString()) as SessionMetadata;

        const app = apps[sessionMetadata.appId];

        const connectionInfo = await callOnOne(
          cluster,
          logger,
          async (client) => await getAppConnectionInfoFromAdapter(client, sessionMetadata.jobId, logger),
        );

        if (connectionInfo?.response?.$case === "appConnectionInfo") {
          return {
            appId: sessionMetadata.appId,
            host: connectionInfo.response.appConnectionInfo.host,
            port: connectionInfo.response.appConnectionInfo.port,
            password: connectionInfo.response.appConnectionInfo.password,
          };
        }

        if (app.type === AppType.web || app.type === AppType.shadowDesk) {
          const infoFilePath = join(jobDir, SERVER_SESSION_INFO);
          if ((await client.file.exists({ userId, path: infoFilePath })).exists) {
            const content = (await client.file.readFile({ userId, filePath: infoFilePath })).content;
            const serverSessionInfo = JSON.parse(content.toString()) as ServerSessionInfoData;
            const { HOST, PORT, PASSWORD, ...rest } = serverSessionInfo;
            const customFormData = rest as Record<string, string>;

            return {
              appId: sessionMetadata.appId,
              host: HOST,
              port: +PORT,
              password: PASSWORD,
              customFormData:  customFormData ?? {},
            };
          }
        } else {

          // for vnc apps,
          // try to find the output file and try to parse the display number
          const vncSessionInfoPath = join(jobDir, VNC_SESSION_INFO);

          // try to read the host info
          if ((await client.file.exists({ userId, path: vncSessionInfoPath })).exists) {

            const host = (await client.file.readFile({
              userId, filePath: vncSessionInfoPath,
            })).content.toString().trim();

            const outputFilePath = join(jobDir, VNC_OUTPUT_FILE);
            if ((await client.file.exists({ userId, path: outputFilePath })).exists) {

              const content = (await client.file.readFile({ userId, filePath: outputFilePath })).content.toString();

              let displayId: number | undefined = undefined;
              try {
                displayId = parseDisplayId(content);
              } catch {
                // ignored if displayId cannot be parsed
              }

              if (displayId) {
                // the server is run at the compute node
                // scowd 无需考虑代理网关节点，可以直接 ssh 到计算节点
                const vncPasswdPath = getTurboVNCBinPath(cluster, "vncpasswd");

                const adapterClient = getAdapterClient(cluster);

                let password = "";
                try {
                  const { stdout, stderr } = await asyncClientCall(adapterClient.job, "runCommandOnJobNodes", {
                    jobId, nodes: [host], command: `${vncPasswdPath} -o -display :${displayId}`, timeoutSeconds: 10,
                  });

                  // slurm 适配器 srun 执行刷新密码命令输出到 stderr，但是 crane 输出到 stdout
                  try {
                    password = parseOtp(stderr);
                  } catch {
                    password = parseOtp(stdout);
                  }
                } catch (e) {
                  logger.warn("Refresh vnc password via runCommandOnJobNodes failed, try to use scowd: %s", e);
                  // 保留传统 ssh 刷新方式作为 backup
                  const { password: p } = await client.app.refreshVncPassword({
                    jobId, userId, displayId, host, vncPasswdPath,
                  }).catch((err: ConnectError) => {
                    logger.error(`Refresh vnc password failed ${err.message}`);
                    throw err;
                  });
                  password = p;
                }

                return {
                  appId: sessionMetadata.appId,
                  host,
                  port: displayIdToPort(displayId),
                  password,
                };
              }
            }
          }
        }

        throw new GrpcServiceError({
          code: Status.UNAVAILABLE, message: `session id ${sessionId} cannot be connected`,
        });

      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }
    },
  };
};

