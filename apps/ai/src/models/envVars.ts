// 所有的内置环境变量名定义
export const PREDEFINED_ENV_VAR = {
  WORK_DIR: "WORK_DIR",
  XDL_IP: "XDL_IP",
  VC_GPU_NUM: "VC_GPU_NUM",
  SCOW_AI_MODEL_PATH: "SCOW_AI_MODEL_PATH",
  SCOW_AI_DATASET_PATH: "SCOW_AI_DATASET_PATH",
  SCOW_AI_ALGORITHM_PATH: "SCOW_AI_ALGORITHM_PATH",
} as const;

export type PreEnvVarKey = (typeof PREDEFINED_ENV_VAR)[keyof typeof PREDEFINED_ENV_VAR];

// 默认所有作业页面都注入的环境变量值
// 这些 Key 由系统自动填充，不允许用户在界面上自定义或修改
export const RESERVED_ENV_KEYS: string[] = [
  PREDEFINED_ENV_VAR.WORK_DIR,
  PREDEFINED_ENV_VAR.XDL_IP,
  PREDEFINED_ENV_VAR.VC_GPU_NUM,
];

/**
 * AI 相关环境变量 Key
 */
export const RESOURCE_ENV_KEYS: string[] = [
  PREDEFINED_ENV_VAR.SCOW_AI_MODEL_PATH,
  PREDEFINED_ENV_VAR.SCOW_AI_DATASET_PATH,
  PREDEFINED_ENV_VAR.SCOW_AI_ALGORITHM_PATH,
];

/**
 * 在提交给后端的 Payload 中需要忽略的 Key
 * 这两个值由后端/调度器动态生成，无需前端上传
 */
export const OMITTED_FROM_PAYLOAD_ENV_KEYS: string[] = [PREDEFINED_ENV_VAR.XDL_IP, PREDEFINED_ENV_VAR.VC_GPU_NUM];

/**
 * 判断指定的环境变量 Key 是否应该从提交数据中移除
 */
export const shouldOmitEnvFromPayload = (key?: string) => !!key && OMITTED_FROM_PAYLOAD_ENV_KEYS.includes(key);

/**
 * 获取默认的内置环境变量列表
 * @param homeDir 用户的主目录，用于初始化 WORK_DIR
 * @returns 包含 Key 和初始 Value 的对象数组
 */
export const getDefaultBuiltinEnvs = (homeDir?: string): { key: string; value?: string }[] => [
  { key: PREDEFINED_ENV_VAR.WORK_DIR, value: homeDir || undefined },
  { key: PREDEFINED_ENV_VAR.XDL_IP, value: undefined },
  { key: PREDEFINED_ENV_VAR.VC_GPU_NUM, value: undefined },
];
