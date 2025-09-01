import { UseQueryResult } from "@tanstack/react-query";
import { FormInstance } from "antd";
import { useMemo } from "react";
import { TextsTransType } from "src/models/Algorithm";
import { parseBooleanParam } from "src/utils/parse";

import { AccessibilityType } from "./LaunchAppForm";

interface Option {
  label: string;
  value: number;
  desc?: string;
}

type DataType = "dataset" | "algorithm" | "model";

type QueryHookFunction<TQueryFnData = any, TError = any, TData = any> =
  (args: TQueryFnData, options?: any) => UseQueryResult<TData, TError>;

export function useDataOptions<T>(
  queryHook: QueryHookFunction<any, any, { items: T[] }>,
  clusterId: string,
  mapItemToOption: (item: T) => Option,
): { privateData: T[], privateDataOptions: Option[], publicData: T[], publicDataOptions: Option[],
    isPrivateDataLoading: boolean,isPublicDataLoading: boolean } {
  const { data: privateItems, isLoading: isPrivateDataLoading } = queryHook({
    clusterId,
    isPublic: parseBooleanParam(false),
  });

  const { data: publicItems, isLoading: isPublicDataLoading } = queryHook({
    clusterId,
    isPublic: parseBooleanParam(true),
  });

  const privateData = privateItems?.items;
  const publicData = publicItems?.items;

  const privateDataOptions = useMemo(() => {
    return privateData?.map(mapItemToOption) || [];
  }, [privateData]);

  const publicDataOptions = useMemo(() => {
    return publicData?.map(mapItemToOption) || [];
  }, [publicData]);

  return { privateData: privateData || [], privateDataOptions,
    publicData: publicData || [], publicDataOptions,
    isPrivateDataLoading,isPublicDataLoading };
}

export function useDataVersionOptions<T>(
  privateIds: number [],
  publicIds: number [],
  dataType: DataType,
  queryHook: QueryHookFunction,
  mapItemToOption: (item: T) => Option,
): { privateDataVersions: T[], privateDataVersionOptions: Option[][], isPrivateDataVersionsLoading: boolean,
    publicDataVersions: T[], publicDataVersionOptions: Option[][], isPublicDataVersionsLoading: boolean,
  } {

  const { data: privateVersions, isLoading: isPrivateDataVersionsLoading } = queryHook({
    [`${dataType}Ids`]: privateIds,
  });

  const { data: publicVersions, isLoading: isPublicDataVersionsLoading } = queryHook({
    [`${dataType}Ids`]: publicIds, isPublic:"true",
  });

  const privateDataVersionOptions = useMemo(() => {
    return privateVersions?.map((version: any) => {

      return version.items.map(mapItemToOption);
    });
  }, [privateVersions]);

  const publicDataVersionOptions = useMemo(() => {
    return publicVersions?.map((version: any) => {

      return version.items.map(mapItemToOption);
    });
  }, [publicVersions]);

  return {
    privateDataVersions:privateVersions ? privateVersions.reduce((acc: any, curr: any) => {
      return acc.concat(curr.items);
    }, []) : [],
    privateDataVersionOptions,
    isPrivateDataVersionsLoading,
    publicDataVersions:publicVersions ? publicVersions.reduce((acc: any, curr: any) => {
      return acc.concat(curr.items);
    }, []) : [],
    publicDataVersionOptions,
    isPublicDataVersionsLoading,
  };
}
interface EntityWithVersions {
  id: number;
  name: string;
  versions: {
    id: number,
    path: string
  }[];
}

interface Version {
  id: number;
  versionName: string;
}

export function setEntityInitData<T extends Version, U extends EntityWithVersions>(
  entityType: "algorithmArray" | "datasetArray" | "modelArray",
  index: number,
  privateEntities: U[],
  privateVersions: T[],
  publicEntities: U[],
  publicVersions: T[],
  entityId: number,
  isPrivate: boolean,
  form: FormInstance,
  setShowKey: string,
  t: TextsTransType,
) {
  form.setFieldValue(setShowKey, true);
  form.setFieldValue([entityType, index,"type"], isPrivate ? AccessibilityType.PRIVATE : AccessibilityType.PUBLIC);

  const entities = isPrivate ? privateEntities : publicEntities;
  const versions = isPrivate ? privateVersions : publicVersions;

  const foundEntity = entities.find((entity) =>
    entity.versions.some((version) => version.id === entityId),
  );

  const i18nVersionTag = t("app.jobs.launchAppForm.versionTag");
  if (foundEntity) {
    form.setFieldValue([entityType,index, "name"], foundEntity.id);
    if (versions.length) {
      const hasVersion = versions.some((version) => version.id === entityId);
      if (hasVersion) {
        form.setFieldValue([entityType,index, "version"], entityId);
        const versionName = versions.find((x) => x.id === entityId)?.versionName;
        const selectedNameVersion = `${foundEntity.name}（${i18nVersionTag}：${versionName}）`;
        form.setFieldValue([entityType, index, "selectedNameVersion"], selectedNameVersion);
      }
    }
  }
}


