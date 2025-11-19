"use client";

import { Tabs, type TabsProps } from "antd";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18nTranslateToString } from "src/i18n";

import { AssetContainer } from "../AssetContainer";
import { ImageListTable } from "./ImageListTable";

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.");

  const { publicConfig, currentAssociateClusterIds } = usePublicConfig();

  const items: TabsProps["items"] = [
    {
      key: "1",
      label: t(p("private")),
      children: (
        <div>
          <ImageListTable
            isPublic={false}
            clusters={publicConfig.CLUSTERS}
            currentClusterIds={currentAssociateClusterIds}
          />
        </div>
      ),
    },
    {
      key: "2",
      label: t(p("public")),
      children: (
        <div>
          <ImageListTable
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
