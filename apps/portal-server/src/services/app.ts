import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { AppType, AttributeType } from "@scow/config/build/app";
import { getI18nSeverTypeFormat, libGetUserAvailableClusterApps } from "@scow/lib-server";
import {
  AppCustomAttribute,
  AppCustomAttribute_AttributeType,
  appCustomAttribute_AttributeTypeFromJSON,
  AppServiceServer,
  AppServiceService,
  ConnectToAppResponse,
  FixedValue,
  GetAppMetadataResponse_ReservedAppAttribute,
  getAppMetadataResponse_ReservedAppAttributeNameFromJSON,
  GetAppMetadataResponse_ReservedConfigType,
  WebAppProps_ProxyType,
} from "@scow/protos/build/portal/app";
import { DetailedError, encodeMessage, ErrorInfo } from "@scow/rich-error-model";
import { getClusterOps } from "src/clusterops";
import { commonConfig } from "src/config/common";
import { config } from "src/config/env";
import { camelToSnakeCase, convertAttributesFixedValue,
  convertToOneOfValue, getClusterAppConfigs } from "src/utils/app";
import { checkActivatedClusters } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";
import { logger } from "src/utils/logger";
import { validateSubmitJobInfoUnderMis } from "src/utils/validation";

const errorInfo = (reason: string) =>
  encodeMessage(ErrorInfo, { domain: "", reason: reason, metadata: {} });

export const appServiceServer = plugin((server) => {

  server.addService<AppServiceServer>(AppServiceService, {
    connectToApp: async ({ request, logger }) => {

      const { cluster, sessionId, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const apps = getClusterAppConfigs(cluster);

      const clusterOps = getClusterOps(cluster);

      if (!clusterOps) { throw clusterNotFound(cluster); }

      const reply = await clusterOps.app.connectToApp({
        sessionId, userId,
      }, logger);

      const app = apps[reply.appId];

      if (!app) {
        throw { code: Status.NOT_FOUND, message: `app id ${reply.appId} is not found` } as ServiceError;
      }

      let appProps: ConnectToAppResponse["appProps"];

      switch (app.type) {
        case AppType.vnc:
          appProps = {
            $case: "vnc",
            vnc: {},
          };
          break;
        case AppType.web:
          appProps = {
            $case: "web",
            web: {
              formData: app.web!.connect.formData ?? {},
              query: app.web!.connect.query ?? {},
              method: app.web!.connect.method,
              path: app.web!.connect.path,
              proxyType: app.web!.proxyType === "absolute"
                ? WebAppProps_ProxyType.ABSOLUTE
                : WebAppProps_ProxyType.RELATIVE,
              customFormData: reply.customFormData ?? {},
            },
          };
          break;
        case AppType.shadowDesk:
          appProps = {
            $case: "shadowDesk",
            shadowDesk: {
              formData: app.shadowDesk!.connect.formData ?? {},
              query: app.shadowDesk!.connect.query ?? {},
              method: app.shadowDesk!.connect.method,
              path: app.shadowDesk!.connect.path,
              customFormData: reply.customFormData ?? {},
            },
          };
          break;
        default:
          throw new Error(`Unknown app type ${app.type as string} of app id ${reply.appId}`);
      }

      return [{
        host: reply.host,
        port: reply.port,
        password: reply.password,
        appProps,
      }];
    },

    createAppSession: async ({ request, logger }) => {

      const { account, appId, appJobName, cluster, coreCount, nodeCount, gpuCount, memory, maxTime,
        proxyBasePath, partition, qos, userId, customAttributes } = request;

      // 检查在线集群
      await checkActivatedClusters({ clusterIds: cluster });

      // 检查APP是否存在
      const apps = getClusterAppConfigs(cluster);
      const app = apps[appId];
      if (!app) {
        throw new DetailedError({
          code: Status.NOT_FOUND,
          message: `app id ${appId} is not found`,
          details: [errorInfo("APP_NOT_FOUND")],
        });
      }

      // 管理系统存在时，增加用户账户封锁状态，授权应用，授权集群分区等鉴权
      if (config.MIS_DEPLOYED) {
        await validateSubmitJobInfoUnderMis({
          userId,
          accountName: account,
          clusterId: cluster,
          logger,
          partitionName: partition,
          checkAccountApp: true,
          appId,
        });
      }

      const attributesConfig = app.attributes;
      attributesConfig?.forEach((attribute) => {
        if (attribute.required && !(attribute.name in customAttributes) && attribute.name !== "sbatchOptions") {
          throw new DetailedError({
            code: Status.INVALID_ARGUMENT,
            message: `custom form attribute ${attribute.name} is required but not found`,
            details: [errorInfo("INVALID ARGUMENT")],
          });
        }

        switch (attribute.type) {
          case AttributeType.number:
            if (customAttributes[attribute.name] && Number.isNaN(Number(customAttributes[attribute.name]))) {
              throw new DetailedError({
                code: Status.INVALID_ARGUMENT,
                message: `
                custom form attribute ${attribute.name} should be of type number,
                but of type ${typeof customAttributes[attribute.name]}`,
                details: [errorInfo("INVALID ARGUMENT")],
              });
            }
            break;

          case AttributeType.text:
            break;

          case AttributeType.file:
            break;

          case AttributeType.select:
          // check the option selected by user is in select attributes as the config defined
            if (customAttributes[attribute.name]
            && !(attribute.select!.some((optionItem) => optionItem.value === customAttributes[attribute.name]))) {
              throw new DetailedError({
                code: Status.INVALID_ARGUMENT,
                message: `
                the option value of ${attribute.name} selected by user should be
                one of select attributes as the ${appId} config defined,
                but is ${customAttributes[attribute.name]}`,
                details: [errorInfo("INVALID ARGUMENT")],
              });
            }
            break;

          default:
            throw new Error(`
          the custom form attributes type in ${appId} config should be one of number, text or select,
          but the type of ${attribute.name} is ${attribute.type as string}`);
        }
      });

      const clusterops = getClusterOps(cluster);

      if (!clusterops) { throw clusterNotFound(cluster); }

      const reply = await clusterops.app.createApp({
        appId,
        appJobName,
        userId,
        coreCount,
        nodeCount,
        gpuCount,
        memory,
        account,
        maxTime,
        partition,
        qos,
        customAttributes,
        proxyBasePath,
      }, logger);

      return [{ jobId: reply.jobId, sessionId: reply.sessionId }];

    },

    listAppSessions: async ({ request, logger }) => {

      const { cluster, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const clusterops = getClusterOps(cluster);

      if (!clusterops) { throw clusterNotFound(cluster); }

      const reply = await clusterops.app.listAppSessions({ userId }, logger);

      return [{ sessions: reply.sessions.map((x) => ({ ...x, submitTime: x.submitTime?.toISOString() })) }];
    },

    getAppMetadata: async ({ request }) => {

      const { appId, cluster } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const apps = getClusterAppConfigs(cluster);
      const app = apps[appId];

      if (!app) {
        throw { code: Status.NOT_FOUND, message: `app id ${appId} is not found` } as ServiceError;
      }
      const attributes: AppCustomAttribute[] = [];
      const reservedAppAttributes: GetAppMetadataResponse_ReservedAppAttribute[] = [];

      if (app.reservedAppAttributes) {
        app.reservedAppAttributes.forEach((item) => {
          const attributeName = camelToSnakeCase(item.name);

          const reservedAppAttribute: GetAppMetadataResponse_ReservedAppAttribute = {
            name: getAppMetadataResponse_ReservedAppAttributeNameFromJSON(attributeName),
          };

          switch (item.config.type) {
            case "fixedValue":
              reservedAppAttribute.config = {
                $case: "fixedValueConfig",
                fixedValueConfig: {
                  type: GetAppMetadataResponse_ReservedConfigType.FIXED_VALUE,
                  fixedValue: convertAttributesFixedValue(item.config) as FixedValue,
                },
              };
              break;
            case "select":
              reservedAppAttribute.config = {
                $case: "selectConfig",
                selectConfig: {
                  type: GetAppMetadataResponse_ReservedConfigType.SELECT,
                  defaultInput: item.config.defaultValue ?
                    convertToOneOfValue(item.config.defaultValue) : undefined,
                  options: item.config.select?.map((x) => {
                    return {
                      value: convertToOneOfValue(x.value),
                      label: x.label ? getI18nSeverTypeFormat(x.label) : undefined,
                      requireGpu: x.requireGpu,
                    };
                  }) ?? [],
                },

              };
              break;
            default:
              break;
          }

          reservedAppAttributes.push(reservedAppAttribute);
        });
      }

      if (app.attributes) {
        app.attributes.forEach((item) => {
          const attributeType = item.type.toUpperCase();

          const defaultInput: AppCustomAttribute["defaultInput"] =
            item.defaultValue ? convertToOneOfValue(item.defaultValue) : undefined;

          attributes.push({
            type: appCustomAttribute_AttributeTypeFromJSON(attributeType),
            label: getI18nSeverTypeFormat(item.label),
            name: item.name,
            // 不读取type为select的fixedValue的值
            fixedValue:
              appCustomAttribute_AttributeTypeFromJSON(attributeType) === AppCustomAttribute_AttributeType.SELECT
                ? undefined : convertAttributesFixedValue(item.fixedValue),
            required: item.required,
            defaultInput: defaultInput,
            placeholder: item.placeholder ? getI18nSeverTypeFormat(item.placeholder) : undefined,
            options: item.select?.map((x) => {
              return {
                value: x.value,
                label: getI18nSeverTypeFormat(x.label),
                requireGpu: x.requireGpu,
              };
            }) ?? [],
          });
        });
      }

      const comment = app.appComment ? getI18nSeverTypeFormat(app.appComment) : undefined;

      return [{ appName: app.name, attributes: attributes, appComment: comment, reservedAppAttributes }];
    },

    listAvailableApps: async ({ request }) => {

      const { cluster, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      // 如果开启了管理系统的授权应用功能，仅返回关联账户下可用的交互式应用
      if (config.MIS_DEPLOYED && commonConfig.allowAppAuthorization && userId) {
        const availableApps = await libGetUserAvailableClusterApps(
          logger, cluster, userId, config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);
        return [ availableApps ];
      }

      const apps = getClusterAppConfigs(cluster);

      return [{
        apps: Object.keys(apps)
          .map((x) => ({ id: x, name: apps[x].name, logoPath: apps[x].logoPath })) }];
    },

    getAppLastSubmission: async ({ request, logger }) => {

      const { userId, cluster, appId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const clusterops = getClusterOps(cluster);

      if (!clusterops) { throw clusterNotFound(cluster); }

      const reply = await clusterops.app.getAppLastSubmission({
        userId, appId,
      }, logger);

      return [{
        lastSubmissionInfo: reply.lastSubmissionInfo,
      }];
    },
  });

});
