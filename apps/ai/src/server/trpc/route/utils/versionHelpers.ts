export const buildVersionMap = <TVersion>(
  versions: TVersion[],
  getEntityId: (version: TVersion) => number,
): Map<number, TVersion[]> => {
  return versions.reduce((acc, version) => {
    const key = getEntityId(version);
    const existing = acc.get(key);
    if (existing) {
      existing.push(version);
    } else {
      acc.set(key, [version]);
    }
    return acc;
  }, new Map<number, TVersion[]>());
};

/**
 * 将(数据集、算法、模型)实体及其对应版本组装成我的/公共结果列表，并交给调用方自定义最终返回结构。
 */
export const mapAssetEntityGroupsWithVersions = <TEntity, TVersion, TResult>({
  personalEntities,
  publicEntities,
  versionMap,
  getEntityId,
  isVersionShared,
  mapResult,
}: {
  personalEntities: TEntity[];
  publicEntities: TEntity[];
  versionMap: Map<number, TVersion[]>;
  getEntityId: (entity: TEntity) => number;
  isVersionShared: (version: TVersion) => boolean;
  // mapResult 用于将(数据集、算法、模型)实体及其筛选后的版本转换为最终需要的结构
  mapResult: (entity: TEntity, versions: TVersion[]) => TResult;
}): { personal: TResult[]; public: TResult[] } => {
  const mapEntities = (entities: TEntity[], filterShared: boolean) =>
    entities.map((entity) => {
      const entityId = getEntityId(entity);
      const versions = versionMap.get(entityId) ?? [];
      const relevantVersions = filterShared ? versions.filter(isVersionShared) : versions;
      return mapResult(entity, relevantVersions);
    });

  return {
    personal: mapEntities(personalEntities, false),
    public: mapEntities(publicEntities, true),
  };
};
