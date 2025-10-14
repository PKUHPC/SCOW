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

import { UiExtensionConfigSchema } from "@scow/config/build/uiExtensions";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { ExtensionManifestsSchema, fetchExtensionManifests } from "src/extensions/manifests";

export const fetchManifestsWithErrorHandling =
(url: string, name?: string): Promise<ExtensionManifestWithUrl | undefined> =>
  fetchExtensionManifests(url)
    .then((x) => ({ url, manifests: x, name }))
    .catch((e) => { console.error(`Error fetching extension manifests. ${e}`); return undefined; });

export interface ExtensionManifestWithUrl {
  url: string;
  manifests: ExtensionManifestsSchema;
  name?: string;
}

export const UiExtensionStore = (uiExtensionConfig?: UiExtensionConfigSchema) => {

  const { data, isLoading } = useAsync({
    promiseFn: useCallback(async (): Promise<UiExtensionStoreData> => {

      if (!uiExtensionConfig) { return undefined; }

      if (Array.isArray(uiExtensionConfig)) {
        return (await Promise.all(uiExtensionConfig.map(async (config) => {
          return await fetchManifestsWithErrorHandling(config.url, config.name);
        }).filter((x) => x))) as (ExtensionManifestWithUrl & { name: string })[];
      } else {
        return await fetchManifestsWithErrorHandling(uiExtensionConfig.url);
      }
    }, []),
  });

  return { data, isLoading };
};

export type UiExtensionStoreData = ExtensionManifestWithUrl | ExtensionManifestWithUrl[] | undefined;
