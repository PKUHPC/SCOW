"use client";

import { Tabs, type TabsProps } from "antd";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AssetContainer } from "src/components/AssetContainer";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";

import { AppSessionsTable, AppTableStatus } from "./AppSessionsTable";

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.jobs.");
  const searchParams = useSearchParams();

  useDocumentTitle(t(p("jobList.title")));

  const searchParamKey = useMemo(() => {
    const jobType = searchParams?.get("jobType");
    if (jobType === "historyJobs") return "2";
    // 默认和 jobType=unfinishedJobs 时显示未结束
    return "1";
  }, [searchParams]);

  const [activeKey, setActiveKey] = useState(searchParamKey);

  // 跟随地址栏 jobType 变化同步 tab
  useEffect(() => {
    setActiveKey(searchParamKey);
  }, [searchParamKey]);

  const items: TabsProps["items"] = [
    {
      key: "1",
      label: t(p("unfinishedJobs.title")),
      children: (
        <div>
          <AppSessionsTable status={AppTableStatus.UNFINISHED} />
        </div>
      ),
    },
    {
      key: "2",
      label: t(p("historyJobs.title")),
      children: (
        <div>
          <AppSessionsTable status={AppTableStatus.FINISHED} />
        </div>
      ),
    },
  ];

  return (
    <AssetContainer>
      <Tabs activeKey={activeKey} onChange={setActiveKey} items={items} />
    </AssetContainer>
  );
}
