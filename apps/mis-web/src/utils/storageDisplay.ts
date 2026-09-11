import { PublicStorageItem } from "@scow/config/build/storage";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";

/**
 * 将 storageId 转为页面展示用名称。
 * 未配置 displayName 时回退为 storageId，避免出现空白标签。
 */
export const getStorageDisplayName = (
  storageId: string | undefined,
  languageId: string,
  publicStorageConfigs: Record<string, PublicStorageItem>,
) => {
  if (!storageId) {
    return "-";
  }

  const storageConfig = publicStorageConfigs[storageId];

  return getI18nConfigCurrentText(storageConfig?.displayName ?? storageId, languageId) || storageId;
};

/**
 * 操作日志等场景需要兼顾“友好名称”和“稳定标识”时，统一使用这个展示格式。
 */
export const getStorageDisplayWithId = (
  storageId: string | undefined,
  languageId: string,
  publicStorageConfigs: Record<string, PublicStorageItem>,
) => {
  if (!storageId) {
    return "-";
  }

  const displayName = getStorageDisplayName(storageId, languageId, publicStorageConfigs);
  return displayName === storageId ? storageId : `${displayName} (${storageId})`;
};
