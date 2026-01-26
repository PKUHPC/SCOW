import { ClusterConfigSchema, LoginNodeConfigSchema } from "@scow/config/build/cluster";
import { I18nObject_I18n, I18nStringType } from "@scow/config/build/i18n";
import { ClusterConfigSchemaProto,
  ClusterConfigSchemaProto_LoginNodesProtoType } from "@scow/protos/build/common/config";
import { I18nStringProtoType } from "@scow/protos/build/common/i18n";
import { camelToUnderscore } from "@scow/utils/build/i18n";

// protobuf中定义的grpc返回值的类型映射到前端I18nStringType
export const getI18nTypeFormat = (i18nProtoType: I18nStringProtoType | undefined): I18nStringType => {

  if (!i18nProtoType?.value) return "";

  if (i18nProtoType.value.$case === "directString") {
    return i18nProtoType.value.directString;
  }

  const i18nObj = i18nProtoType.value.i18nObject.i18n;
  if (!i18nObj) return "";

  return {
    i18n: {
      ...Object.entries(i18nObj).reduce((acc, [key, value]) => {
        acc[camelToUnderscore(key)] = value;
        return acc;
      }, {} as I18nObject_I18n),
    },
  };
};

// protobuf中定义的grpc返回值的loginNodes类型映射到前端loginNode
export const getLoginNodesTypeFormat = (
  protoType: ClusterConfigSchemaProto_LoginNodesProtoType | undefined): LoginNodeConfigSchema[] => {

  if (!protoType?.value) return [];
  if (protoType.value.$case === "loginNodeAddresses") {
    return protoType.value.loginNodeAddresses.loginNodeAddressesValue.map((item) => ({
      name: item,
      address: item,
      scowd: undefined,
    }));
  } else {
    const loginNodeConfigs = protoType.value.loginNodeConfigs;

    return loginNodeConfigs.loginNodeConfigsValue.map((x) => ({
      name: getI18nTypeFormat(x.name),
      address: x.address,
      scowd: x.scowd,
    }));

  }

};

// protobuf中定义的grpc返回值的 ClusterConfigs 类型映射到前端
export const getClusterConfigsTypeFormat = (
  protoType: ClusterConfigSchemaProto[]): Record<string, ClusterConfigSchema> => {

  const modifiedClusters: Record<string, ClusterConfigSchema> = {};
  protoType.forEach((cluster) => {
    const { clusterId, ... rest } = cluster;
    const newCluster = {
      ...rest,
      displayName: getI18nTypeFormat(cluster.displayName),
      loginNodes: getLoginNodesTypeFormat(cluster.loginNodes),
      description: cluster.description ? getI18nTypeFormat(cluster.description) : undefined,
    };
    modifiedClusters[cluster.clusterId] = newCluster as ClusterConfigSchema;
  });

  return modifiedClusters;

};
