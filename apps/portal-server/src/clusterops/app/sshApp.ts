import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { AppType, AttributeType } from "@scow/config/build/app";
import { getPlaceholderKeys } from "@scow/lib-config/build/parse";
import { formatTime } from "@scow/lib-scheduler-adapter";
import { errorInfo, getAppConnectionInfoFromAdapter,getEnvVariables } from "@scow/lib-server";
import { getUserHomedir,
  sftpChmod, sftpExists, sftpReaddir, sftpReadFile, sftpRealPath, sftpWriteFile } from "@scow/lib-ssh";
import { DetailedError, ErrorInfo, parseErrorStatus } from "@scow/rich-error-model";
import { JobInfo, SubmitJobRequest } from "@scow/scheduler-adapter-protos/build/job";
import dayjs from "dayjs";
import { join } from "path";
import { quote } from "shell-quote";
import { AppOps, AppSession, SubmissionInfo } from "src/clusterops/api/app";
import { configClusters } from "src/config/clusters";
import { portalConfig } from "src/config/portal";
import { APP_LAST_SUBMISSION_INFO, BIN_BASH_SCRIPT_HEADER, getClusterAppConfigs,
  SERVER_ENTRY_COMMAND,
  SERVER_SESSION_INFO,
  ServerSessionInfoData,
  SESSION_METADATA_NAME,
  SessionMetadata,
  SHADOWDESK_SESSION,
  ShadowDeskSession,
  splitSbatchArgs, VNC_ENTRY_COMMAND, VNC_OUTPUT_FILE, VNC_SESSION_INFO } from "src/utils/app";
import { callOnOne } from "src/utils/clusters";
import { getIpFromProxyGateway } from "src/utils/proxy";
import { sshConnect } from "src/utils/ssh";
import { displayIdToPort, getTurboVNCBinPath, parseDisplayId,
  refreshPassword, refreshPasswordByProxyGateway } from "src/utils/turbovnc";


export const sshAppServices = (cluster: string, host: string): AppOps => {

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


      return await sshConnect(host, userId, logger, async (ssh) => {
        const userHomeDir = await getUserHomedir(ssh, userId, logger);
        const workingDirectory = join(userHomeDir,portalConfig.appJobsDir, workDirectoryName);

        const lastSubmissionDirectory = join(userHomeDir,portalConfig.appLastSubmissionDir, appId);

        // make sure workingDirectory exists.
        await ssh.mkdir(workingDirectory);
        // make sure lastSubmissionDirectory exists.
        await ssh.mkdir(lastSubmissionDirectory);

        const sftp = await ssh.requestSFTP();

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

          // write session metadata
          const metadata: SessionMetadata = {
            jobId,
            jobName: appJobName,
            sessionId: workDirectoryName,
            submitTime: new Date().toISOString(),
            appId,
          };

          // entry.sh save the generated script
          await sftpWriteFile(sftp)(remoteEntryPath, reply.generatedScript);

          await sftpWriteFile(sftp)(join(workingDirectory, SESSION_METADATA_NAME), JSON.stringify(metadata));

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

          await sftpWriteFile(sftp)(join(lastSubmissionDirectory, APP_LAST_SUBMISSION_INFO),
            JSON.stringify(lastSubmissionInfo));

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
          await sftpWriteFile(sftp)(join(workingDirectory, "before.sh"), beforeScript);

          const webScript = BIN_BASH_SCRIPT_HEADER + appConfig.web!.script;
          const scriptPath = join(workingDirectory, "script.sh");
          await sftpWriteFile(sftp)(scriptPath, webScript);
          await sftpChmod(sftp)(scriptPath, "755");

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
          await sftpWriteFile(sftp)(join(workingDirectory, "before.sh"), beforeScript);

          const webScript = BIN_BASH_SCRIPT_HEADER + appConfig.shadowDesk!.script;
          const scriptPath = join(workingDirectory, "script.sh");
          await sftpWriteFile(sftp)(scriptPath, webScript);
          await sftpChmod(sftp)(scriptPath, "755");

          const configSlurmOptions: string[] = appConfig.slurm?.options ?? [];

          const extraOptions = configSlurmOptions.concat(userSbatchOptions);

          const envVariables = getEnvVariables({ SERVER_SESSION_INFO });

          return await submitAndWriteMetadata({
            userId, jobName, account, partition: partition!, qos, nodeCount, gpuCount: gpuCount ?? 0, memoryMb,
            coreCount, timeLimitMinutes: maxTime, script: envVariables + SERVER_ENTRY_COMMAND,
            workingDirectory, extraOptions,
            envVariables: [],
          });
        }
        else {
          // vnc app
          const beforeScript = customAttributesExport + (appConfig.vnc!.beforeScript ?? "");
          await sftpWriteFile(sftp)(join(workingDirectory, "before.sh"), beforeScript);

          const xstartupPath = join(workingDirectory, "xstartup");
          const xstartupScript = BIN_BASH_SCRIPT_HEADER + appConfig.vnc!.xstartup;
          await sftpWriteFile(sftp)(xstartupPath, xstartupScript);
          await sftpChmod(sftp)(xstartupPath, "755");

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

      });
    },

    getAppLastSubmission: async (request, logger) => {
      const { userId, appId } = request;

      const file = join(portalConfig.appLastSubmissionDir, appId, APP_LAST_SUBMISSION_INFO);

      return await sshConnect(host, userId, logger, async (ssh) => {

        const sftp = await ssh.requestSFTP();

        if (!await sftpExists(sftp, file)) { return { lastSubmissionInfo: undefined }; }
        const content = await sftpReadFile(sftp)(file);

        try {
          const data = JSON.parse(content.toString()) as SubmissionInfo;
          return { lastSubmissionInfo: data };
        } catch (error) {
          logger.error("Parsing JSON failed, the content is %s,the error is %o",content.toString(), error);
          return { lastSubmissionInfo: undefined };
        }
      });
    },

    listAppSessions: async (request, logger) => {

      const apps = getClusterAppConfigs(cluster);

      const { userId } = request;

      return await sshConnect(host, "root", logger, async (ssh) => {

        // If a job is not running, it cannot be ready
        const runningJobsInfo = await callOnOne(
          cluster,
          logger,
          async (client) => await asyncClientCall(client.job, "getJobs", {
            fields: ["job_id", "state", "elapsed_seconds", "time_limit_minutes", "reason"],
            filter: {
              users: [userId], accounts: [],
              states: ["RUNNING", "PENDING"],
            },
            jobTypes: [],
          }),
        ).then((resp) => resp.jobs);

        const runningJobInfoMap = runningJobsInfo.reduce((prev, curr) => {
          prev[curr.jobId] = curr;
          return prev;
        }, {} as Record<number, JobInfo>);

        const sftp = await ssh.requestSFTP();

        const userHomeDir = await getUserHomedir(ssh, userId, logger);
        const userAppJobDir = join(userHomeDir, portalConfig.appJobsDir);

        if (!await sftpExists(sftp, userAppJobDir)) { return { sessions: []}; }

        // get all job directories
        const list = await sftpReaddir(sftp)(userAppJobDir);
        const sessions = [] as AppSession[];

        await Promise.all(list.map(async ({ filename }) => {
          const jobDir = join(userAppJobDir, filename);
          const metadataPath = join(jobDir, SESSION_METADATA_NAME);

          if (!await sftpExists(sftp, metadataPath)) {
            return;
          }

          const content = await sftpReadFile(sftp)(metadataPath);

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
            await sftpReaddir(sftp)(jobDir);

            if (app.type === AppType.web || app.type === AppType.shadowDesk) {
            // for server apps,
            // try to read the SESSION_INFO file to get port and password
              const infoFilePath = join(jobDir, SERVER_SESSION_INFO);
              if (await sftpExists(sftp, infoFilePath)) {
                const content = await sftpReadFile(sftp)(infoFilePath);
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
                const shadowdeskFilePath = join(jobDir, SHADOWDESK_SESSION);
                if (await sftpExists(sftp, shadowdeskFilePath)) {
                  const content = await sftpReadFile(sftp)(shadowdeskFilePath);
                  const sessionInfo = JSON.parse(content.toString()) as ShadowDeskSession;
                  user = sessionInfo.SHADOWDESK_USER;
                }
              }
            } else {
            // for vnc apps,
            // try to find the output file and try to parse the display number
              const vncSessionInfoPath = join(jobDir, VNC_SESSION_INFO);
              if (await sftpExists(sftp, vncSessionInfoPath)) {
                const outputFilePath = join(jobDir, VNC_OUTPUT_FILE);
                if (await sftpExists(sftp, outputFilePath)) {
                  const content = (await sftpReadFile(sftp)(outputFilePath)).toString();
                  try {
                    const displayId = parseDisplayId(content);
                    port = displayIdToPort(displayId);
                  } catch {
                  // ignored if displayId cannot be parsed
                  }
                }

                host = (await sftpReadFile(sftp)(vncSessionInfoPath)).toString().trim();
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
          }

          const terminatedStates = ["BOOT_FAIL", "COMPLETED", "DEADLINE", "FAILED",
            "NODE_FAIL", "PREEMPTED", "SPECIAL_EXIT", "TIMEOUT"];
          const isPendingOrTerminated = runningJobInfo?.state === "PENDING"
            || terminatedStates.includes(runningJobInfo?.state);

          sessions.push({
            jobId: sessionMetadata.jobId,
            appId: sessionMetadata.appId,
            appName: apps[sessionMetadata.appId]?.name,
            jobName: sessionMetadata.jobName ?? "",
            sessionId: sessionMetadata.sessionId,
            submitTime: new Date(sessionMetadata.submitTime),
            state: runningJobInfo?.state ?? "ENDED",
            dataPath: await sftpRealPath(sftp)(jobDir),
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

        return { sessions };
      });
    },

    connectToApp: async (request, logger) => {
      const apps = getClusterAppConfigs(cluster);

      const { sessionId, userId } = request;

      return await sshConnect(host, "root", logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();

        const userHomeDir = await getUserHomedir(ssh, userId, logger);
        const jobDir = join(userHomeDir, portalConfig.appJobsDir, sessionId);

        if (!await sftpExists(sftp, jobDir)) {
          throw { code: Status.NOT_FOUND, message: `session id ${sessionId} is not found` } as ServiceError;

        }

        const metadataPath = join(jobDir, SESSION_METADATA_NAME);
        const content = await sftpReadFile(sftp)(metadataPath);
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
          if (await sftpExists(sftp, infoFilePath)) {
            const content = await sftpReadFile(sftp)(infoFilePath);
            const serverSessionInfo = JSON.parse(content.toString()) as ServerSessionInfoData;
            const { HOST, PORT, PASSWORD, ...rest } = serverSessionInfo;
            const customFormData = rest as Record<string, string>;
            const ip = await getIpFromProxyGateway(cluster, HOST, logger);

            return {
              appId: sessionMetadata.appId,
              host: ip || HOST,
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
          if (await sftpExists(sftp, vncSessionInfoPath)) {

            const host = (await sftpReadFile(sftp)(vncSessionInfoPath)).toString().trim();

            const outputFilePath = join(jobDir, VNC_OUTPUT_FILE);
            if (await sftpExists(sftp, outputFilePath)) {

              const content = (await sftpReadFile(sftp)(outputFilePath)).toString();

              let displayId: number | undefined = undefined;
              try {
                displayId = parseDisplayId(content);
              } catch {
                // ignored if displayId cannot be parsed
              }

              if (displayId) {
                // the server is run at the compute node

                const clusters = configClusters;
                // if proxyGateway configured, connect to compute node by proxyGateway and get ip of compute node
                const proxyGatewayConfig = clusters?.[cluster]?.proxyGateway;
                if (proxyGatewayConfig) {
                  const url = new URL(proxyGatewayConfig.url);
                  return await sshConnect(url.hostname, "root", logger, async (proxyGatewaySsh) => {
                    logger.info(`Connecting to compute node ${host} via proxy gateway ${url.hostname}`);
                    const { password, ip } =
                      await refreshPasswordByProxyGateway(proxyGatewaySsh, cluster, host, userId, logger, displayId);
                    return {
                      appId: sessionMetadata.appId,
                      host: ip || host,
                      port: displayIdToPort(displayId),
                      password,
                    };
                  });
                }

                // login to the compute node and refresh the password
                // connect as user so that
                // the service node doesn't need to be able to connect to compute nodes with public key
                return await sshConnect(host, userId, logger, async (computeNodeSsh) => {
                  const password = await refreshPassword(computeNodeSsh, cluster, null, logger, displayId);
                  return {
                    appId: sessionMetadata.appId,
                    host,
                    port: displayIdToPort(displayId),
                    password,
                  };
                });
              }
            }
          }
        }

        throw { code: Status.UNAVAILABLE, message: `session id ${sessionId} cannot be connected` } as ServiceError;

      });
    },
  };
};
