"use client";

import { Tabs, type TabsProps } from "antd";
import { ModalTable } from "src/app/(auth)/asset/model/ModelTable";
import { usePublicConfig } from "src/app/(auth)/context";
import { AssetContainer } from "src/components/AssetContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.model.");

  const { publicConfig } = usePublicConfig();
  useDocumentTitle(t(p("title")));

  const items: TabsProps["items"] = [
    {
      key: "1",
      label: t(p("private")),
      children: (
        <div>
          <ModalTable isPublic={false} clusters={publicConfig.CLUSTERS} />
        </div>
      ),
    },
    {
      key: "2",
      label: t(p("public")),
      children: (
        <div>
          <ModalTable isPublic={true} clusters={publicConfig.CLUSTERS} />
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
