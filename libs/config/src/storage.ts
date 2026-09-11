import { ConfigFileNotExistError, GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";

import { DEFAULT_CONFIG_BASE_PATH } from "./constants";
import { createI18nStringSchema } from "./i18n";

/** OceanStor Pacific 华为存储配置 */
export const OceanStorPacificConfigSchema = Type.Object({
  version: Type.String({ description: "OceanStor Pacific 版本号, 8.2.1+" }),
  namespaceId: Type.String({ description: "挂载目录所属命名空间 ID" }),
  username: Type.String({ description: "管理员用户名" }),
  password: Type.String({ description: "管理员密码" }),
  baseUrl: Type.String({ description: "存储访问 URL" }),
});

/** NFS 存储配置 */
export const NfsConfigSchema = Type.Object({
  version: Type.String({ description: "NFS 版本号, 3.0+" }),
});

/** Lustre 存储配置 */
export const LustreConfigSchema = Type.Object({
  version: Type.String({ description: "Lustre 版本号, 2.0+" }),
});

/** GPFS 存储配置 */
export const GpfsConfigSchema = Type.Object({
  version: Type.String({ description: "GPFS 版本号, 4.0+ / 5.0+" }),
  filesystem: Type.String({ description: "GPFS 文件系统名称，可能与挂载路径不一致" }),
});

/** 支持的文件系统类型 */
export enum StorageFsType {
  oceanStorPacific = "oceanStorPacific",
  nfs = "nfs",
  lfs = "lfs",
  gpfs = "gpfs",
}

/** 文件系统配置，根据 type 字段选择对应的详细配置 */
export const StorageFsSchema = Type.Object({
  type: Type.Enum(StorageFsType, { description: "文件系统类型" }),
  oceanStorPacific: Type.Optional(OceanStorPacificConfigSchema),
  nfs: Type.Optional(NfsConfigSchema),
  lfs: Type.Optional(LustreConfigSchema),
  gpfs: Type.Optional(GpfsConfigSchema),
});

export const StorageItemSchema = Type.Object({
  /** 存储 ID 唯一标识符 */
  storageId: Type.String({ description: "存储 ID, 存储系统的唯一标识符" }),
  /** 存储显示名称，支持国际化，默认使用 storageId */
  displayName: Type.Optional(createI18nStringSchema({ description: "存储显示名称，支持国际化" })),
  /** 是否开启当前存储配额管理 */
  quotaEnabled: Type.Boolean({ description: "是否开启当前存储配额管理", default: false }),
  /** 是否存在备份副本 */
  replicaExist: Type.Boolean({ description: "是否存在备份副本", default: false }),
  /** 文件系统配置 */
  fs: StorageFsSchema,
});

export const StorageConfigFileSchema = Type.Object({
  storages: Type.Array(StorageItemSchema, { description: "存储系统配置" }),
});

export const PublicStorageItemSchema = Type.Pick(StorageItemSchema, [
  "storageId",
  "displayName",
  "quotaEnabled",
  "replicaExist",
]);
export const PublicStorageConfigSchema = Type.Object({
  storages: Type.Array(PublicStorageItemSchema, { description: "存储系统配置" }),
});

export type OceanStorPacificConfigSchema = Static<typeof OceanStorPacificConfigSchema>;
export type NfsConfigSchema = Static<typeof NfsConfigSchema>;
export type LustreConfigSchema = Static<typeof LustreConfigSchema>;
export type GpfsConfigSchema = Static<typeof GpfsConfigSchema>;
export type StorageFsSchema = Static<typeof StorageFsSchema>;
export type StorageItemSchema = Static<typeof StorageItemSchema>;
export type StorageConfigFileSchema = Static<typeof StorageConfigFileSchema>;
export type PublicStorageItem = Static<typeof PublicStorageItemSchema>;
export type PublicStorageConfigSchema = Static<typeof PublicStorageConfigSchema>;

const STORAGE_CONFIG_NAME = "storage";

/** storage.yaml 校验失败时抛出，携带结构化字段供调用方 instanceof 判断 */
export class StorageConfigValidationError extends Error {
  constructor(
    public readonly storageId: string,
    public readonly reason: string,
  ) {
    super(`storage ${storageId}: ${reason}`);
    this.name = "StorageConfigValidationError";
  }
}

// 当前系统要求的各fs最低版本
const FS_MIN_VERSIONS: Record<StorageFsType, string> = {
  [StorageFsType.oceanStorPacific]: "8.2.1",
  [StorageFsType.nfs]: "3.0",
  [StorageFsType.lfs]: "2.0",
  [StorageFsType.gpfs]: "4.0",
};

function compareVersionStrings(version: string, minVersion: string): number | undefined {
  const parse = (value: string) => {
    if (!/^\d+(?:\.\d+)*$/.test(value)) return undefined;
    return value.split(".").map((s) => Number.parseInt(s, 10));
  };
  const current = parse(version);
  const minimum = parse(minVersion);
  if (!current || !minimum) return undefined;

  const length = Math.max(current.length, minimum.length);
  for (let i = 0; i < length; i++) {
    const c = current[i] ?? 0;
    const m = minimum[i] ?? 0;
    if (c !== m) return c > m ? 1 : -1;
  }
  return 0;
}

function validateStorageConfigs(config: StorageConfigFileSchema): void {
  for (const storage of config.storages) {
    const fsType = storage.fs.type as StorageFsType;
    const fsConfig = storage.fs[fsType];
    const minVersion = FS_MIN_VERSIONS[fsType];

    if (!fsConfig) {
      throw new StorageConfigValidationError(
        storage.storageId,
        `fs.type is "${fsType}", but the corresponding "${fsType}" config is missing`,
      );
    }

    const cmp = compareVersionStrings(fsConfig.version, minVersion);
    if (cmp === undefined) {
      throw new StorageConfigValidationError(
        storage.storageId,
        `${fsType} version "${fsConfig.version}" is invalid; expected a numeric version >= ${minVersion}`,
      );
    }
    if (cmp < 0) {
      throw new StorageConfigValidationError(
        storage.storageId,
        `${fsType} version ${fsConfig.version} must be >= ${minVersion}`,
      );
    }
  }
}

/**
 * 读取 storage.yaml，文件不存在时返回 null，其余错误（含校验错误）继续抛出
 */
function loadRawStorageConfig(baseConfigPath?: string): StorageConfigFileSchema | null {
  try {
    return getConfigFromFile(
      StorageConfigFileSchema,
      STORAGE_CONFIG_NAME,
      baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH,
    );
  } catch (e) {
    if (e instanceof ConfigFileNotExistError) return null;
    throw e;
  }
}

// 只给后端使用的文件配置
export const getServerStorageConfig: GetConfigFn<StorageConfigFileSchema> = (baseConfigPath) => {
  const config = loadRawStorageConfig(baseConfigPath);
  if (!config) return { storages: [] };
  if (config.storages.length > 0) {
    validateStorageConfigs(config);
  }
  return config;
};

// 只给前端使用的文件配置
export const getPublicStorageConfig: GetConfigFn<PublicStorageConfigSchema> = (baseConfigPath) => {
  const config = loadRawStorageConfig(baseConfigPath);
  if (!config) return { storages: [] };
  return {
    storages: config.storages.map(({ storageId, displayName, quotaEnabled, replicaExist }) => ({
      storageId,
      displayName: displayName ?? storageId,
      quotaEnabled,
      replicaExist,
    })),
  };
};

/**
 * 根据 storageId 查找存储配置
 * @param storageConfigs 全局存储配置
 * @param storageId 要查找的存储 ID
 * @returns 匹配的存储配置，未找到则返回 undefined
 */
export function findStorageById(
  storageConfigs: StorageConfigFileSchema,
  storageId: string,
): StorageItemSchema | undefined {
  return storageConfigs.storages.find((s) => s.storageId === storageId);
}
