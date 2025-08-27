import { GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";

export const QuantumConfigSchema = Type.Object({
  db: Type.Object({
    host: Type.String({ description: "数据库地址" }),
    port: Type.Integer({ description: "数据库端口" }),
    user: Type.String({ description: "数据库用户名" }),
    password: Type.Optional(Type.String({ description: "数据库密码" })),
    dbName: Type.String({ description: "数据库数据库名" }),
    debug: Type.Boolean({ description: "打开ORM的debug模式", default: false }),
  }),
  backend: Type.Object({
    apiBase: Type.String({
      description: "量子云API的基础URL，不要带后缀斜杠",
      default: "http://qobody:8088",
    }),
  }, { default: {} }),
  jupyter: Type.Object({
    cluster: Type.String({ description: "带有量子计算库的jupyter的交互式应用所在的集群" }),
    appId: Type.String({ description: "带量子计算库的jupyter的交互式应用的appId" }),
  }),
  device: Type.Object({
    recommend: Type.Array(Type.String(), { description: "展示在仪表盘推荐使用的设备" }),
  }),
  billing: Type.Object({
    defaultBitSecondPrice: Type.Number({
      description: "量子作业按该比特秒计价，如设置为0.35即每比特秒0.35元",
      default: 0.35,
    }),
  }),
  taskChargeComment: Type.String({
    description: "给量子作业扣费时，扣费项的备注。可以使用{{ 属性名 }}使用作业信息中的属性。",
    default: "量子作业ID：{{ id }}",
  }),
  taskChargeType: Type.String({ description: "对量子作业计费时，计费费用的付款类型，请和管理系统的quantumJobChargeType保持一致",
    default: "量子作业费用" }),
});

const QUANTUM_CONFIG_NAME = "quantum/config";

export type QuantumConfigSchema = Static<typeof QuantumConfigSchema>;

export const getQuantumConfig: GetConfigFn<QuantumConfigSchema> = (baseConfigPath) => {
  const config =
    getConfigFromFile(QuantumConfigSchema, QUANTUM_CONFIG_NAME, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);

  return config;

};
