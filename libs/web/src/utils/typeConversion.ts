/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { ClusterConfigSchema, LoginNodeConfigSchema } from "@scow/config/build/cluster";
import { I18nStringType } from "@scow/config/build/i18n";
import { ClusterConfigSchemaProto, clusterConfigSchemaProto_K8sRuntimeToJSON,
  ClusterConfigSchemaProto_LoginNodesProtoType } from "@scow/protos/build/common/config";
import { I18nStringProtoType } from "@scow/protos/build/common/i18n";

// protobuf中定义的grpc返回值的类型映射到前端I18nStringType
export const getI18nTypeFormat = (i18nProtoType: I18nStringProtoType | undefined): I18nStringType => {

  if (!i18nProtoType?.value) return "";

  if (i18nProtoType.value.$case === "directString") {
    return i18nProtoType.value.directString;
  } else {
    const i18nObj = i18nProtoType.value.i18nObject.i18n;
    if (!i18nObj) return "";
    return {
      i18n: {
        default: i18nObj.default,
        en: i18nObj.en,
        zh_cn: i18nObj.zhCn,
      },
    };
  }

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
      k8s: cluster.k8s ? {
        k8sRuntime: clusterConfigSchemaProto_K8sRuntimeToJSON(cluster.k8s.runtime).toLowerCase(),
        kubeconfig: cluster.k8s.kubeconfig,
      } : undefined,
      description: cluster.description ? getI18nTypeFormat(cluster.description) : undefined,
    };
    modifiedClusters[cluster.clusterId] = newCluster as ClusterConfigSchema;
  });

  return modifiedClusters;

};
