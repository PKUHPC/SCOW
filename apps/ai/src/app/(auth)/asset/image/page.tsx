"use client";

import { Tabs, type TabsProps } from "antd";
import { usePublicConfig } from "src/app/(auth)/context";
import { AssetContainer } from "src/components/AssetContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

import { ImageListTable } from "./ImageListTable";

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.");

  const { publicConfig } = usePublicConfig();
  useDocumentTitle(t(p("title")));

  const items: TabsProps["items"] = [
    {
      key: "1",
      label: t(p("private")),
      children: (
        <div>
          <ImageListTable
            isPublic={false}
            clusters={publicConfig.CLUSTERS}
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
