"use client";

import { Tabs, type TabsProps } from "antd";
import { usePublicConfig } from "src/app/(auth)/context";
import { useI18nTranslateToString } from "src/i18n";

import { AssetContainer } from "../AssetContainer";
import { DatasetListTable } from "./DatasetListTable";

export default function Page() {
  const t = useI18nTranslateToString();

  const { publicConfig, currentAssociateClusterIds } = usePublicConfig();

  const items: TabsProps["items"] = [
    {
      key: "1",
      label: t("app.dataset.private"),
      children: (
        <div>
          <DatasetListTable
            isPublic={false}
            clusters={publicConfig.CLUSTERS}
            currentClusterIds={currentAssociateClusterIds}
          />
        </div>
      ),
    },
    {
      key: "2",
      label: t("app.dataset.public"),
      children: (
        <div>
          <DatasetListTable
            isPublic={true}
            clusters={publicConfig.CLUSTERS}
            currentClusterIds={currentAssociateClusterIds}
          />
        </div>
      ),
    },
  ];

  return (
    <AssetContainer>
      <Tabs defaultActiveKey="1" items={items} />
    </AssetContainer>
  );
}
