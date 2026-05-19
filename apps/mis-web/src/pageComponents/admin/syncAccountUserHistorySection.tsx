import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import React, { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { Section } from "src/components/Section";
import { useI18nTranslateToString } from "src/i18n";
import { AccountUserSyncHistoryTable } from "src/pageComponents/admin/AccountUserSyncHistoryTable";
import { publicConfig } from "src/utils/config";

interface PageInfo {
  page: number;
  pageSize?: number;
}

interface Props {
  reload: () => void;
}

export const SyncAccountUserHistorySection: React.FC<Props> = ({ reload }) => {
  const [pageInfo, setPageInfo] = useState<PageInfo>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });

  const promiseFn = useCallback(async () => {
    return await api.getSyncAccountUserHistory({
      query: {
        page: pageInfo.page,
        pageSize: pageInfo.pageSize!,
      },
    });
  }, [reload, pageInfo]);

  const { data, isLoading } = useAsync({ promiseFn });
  const t = useI18nTranslateToString();

  return (
    <div style={{ marginTop: "48px" }}>
      <Section
        title={t("page.admin.systemDebug.syncClusterAccountUser.historyTable.title")}
        extra={
          <div>
            {t("page.admin.systemDebug.syncClusterAccountUser.historyTable.explanation", [
              publicConfig.SYNC_HISTORY_DAY_PERIOD,
            ])}
          </div>
        }
      >
        <AccountUserSyncHistoryTable
          data={data}
          isLoading={isLoading}
          pagination={{
            current: pageInfo.page,
            pageSize: pageInfo.pageSize,
            defaultPageSize: DEFAULT_PAGE_SIZE,
            showSizeChanger: true,
            total: data?.totalCount,
            onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
          }}
        />
      </Section>
    </div>
  );
};
