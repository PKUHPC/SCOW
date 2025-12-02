import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { Static } from "@sinclair/typebox";
import { Button, Table } from "antd";
import { useState } from "react";
import { useStore } from "simstate";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { SyncAccountUserResult, SyncAccountUserStatus } from "src/models/synchronization";
import { type GetSyncAccountUserHistorySchema,
  SyncAccountUserHistory } from "src/pages/api/admin/synchronize/getSyncAccountUserHistory";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName } from "src/utils/cluster";
import { DisplayedSyncDetail, getSyncDetails } from "src/utils/syncAccountUser";

import { ClusterSyncResultDrawer } from "./ClusterSyncResultDrawer";

interface Pagination {
  current: number;
  pageSize: number | undefined;
  defaultPageSize: number;
  showSizeChanger: boolean;
  total: number | undefined;
  onChange: (page: number, pageSize: number) => void;
}

interface Props {
  data: Static<typeof GetSyncAccountUserHistorySchema["responses"]["200"]> | undefined;
  isLoading: boolean;
  pagination: Pagination;
}
const p = prefix("page.admin.systemDebug.syncClusterAccountUser.");

export const AccountUserSyncHistoryTable: React.FC<Props> = ({ data, isLoading, pagination }) => {

  const { publicConfigClusters, clusterSortedIdList } = useStore(ClusterInfoStore);
  const [previewItem, setPreviewItem] = useState<DisplayedSyncDetail | undefined>(undefined);

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const getSyncResultI18nTexts =
    (syncStatus: SyncAccountUserStatus, syncResult?: SyncAccountUserResult): string => {

      if (syncStatus === SyncAccountUserStatus.RUNNING) {
        return t(p("syncStatusRunning"));
      }

      if (syncStatus === SyncAccountUserStatus.UNEXECUTED || (syncResult &&
      syncResult === SyncAccountUserResult.FAILED)) {
        return t(p("syncStatusFailed"));
      }

      if (syncStatus === SyncAccountUserStatus.COMPLETED &&
        syncResult &&
        syncResult === SyncAccountUserResult.SUCCESS) {
        return t(p("syncStatusSuccess"));
      }

      return t(p("syncStatusUnknown"));
    };

  return (
    <>
      <Table
        dataSource={data?.syncHistory}
        loading={isLoading}
        pagination={pagination}
        rowKey="sessionId"
        scroll={{ x: 800, y: 500 }}
        tableLayout="fixed"
      >
        <Table.Column<SyncAccountUserHistory>
          dataIndex="sessionId"
          width="4%"
          title={t(p("historyTable.index"))}
          ellipsis
        />
        <Table.Column<SyncAccountUserHistory>
          dataIndex="operatorId"
          width="15%"
          title={t(p("historyTable.operatorId"))}
          render={(_, r) => {
            return r.operatorId ? `${r.operatorName}（ID: ${r.operatorId}）` : t(p("historyTable.systemOperator"));
          }}
        />
        <Table.Column<SyncAccountUserHistory>
          dataIndex="startTime"
          width="10%"
          title={t(p("historyTable.startTime"))}
          render={(_, r) => r.startTime ? formatDateTime(r.startTime) : ""}
        />
        <Table.Column<SyncAccountUserHistory>
          dataIndex="endTime"
          width="10%"
          title={t(p("historyTable.endTime"))}
          render={(_, r) => r.endTime ? formatDateTime(r.endTime) : ""}
        />
        <Table.Column<SyncAccountUserHistory>
          dataIndex="sessionSyncStatus"
          width="6%"
          title={t(p("historyTable.syncResult"))}
          render={(_, r) => {
            return getSyncResultI18nTexts(r.sessionSyncStatus, r.sessionSyncResult);
          }}
        />
        <Table.Column<SyncAccountUserHistory>
          dataIndex="displayedFailureMessage"
          width="30%"
          title={t(p("historyTable.syncDetails"))}
          render={(_, r) => {
            let displayedContent: string | undefined = undefined;
            let syncResult: DisplayedSyncDetail[] | undefined = undefined;

            if (r.sessionSyncStatus === SyncAccountUserStatus.RUNNING) {
              displayedContent = t(p("historyTable.isRunning"));
            } else if (r.sessionSyncStatus === SyncAccountUserStatus.UNEXECUTED) {
              displayedContent = t(p("syncDetailsContent.hasExceptionMessage"));
            } else {
              displayedContent = undefined;
              syncResult = r.sessionSyncDetails ?
                getSyncDetails(
                  t,
                  r.sessionSyncDetails,
                  clusterSortedIdList) :
                undefined;
            }

            return (
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "pre-wrap",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  wordWrap: "break-word",
                }}
              >
                { displayedContent ? displayedContent : (
                  <>
                    {
                      Array.isArray(syncResult) ? (
                        <>
                          {
                            syncResult.map((cr) => {
                              const clusterName = getClusterName(cr.clusterId, languageId, publicConfigClusters);
                              return (
                                // 1.集群内数据同步时发生异常的情况
                                cr.exceptionHappened ? (
                                  <div>
                                    {/* 显示集群名 */}
                                    {clusterName}
                                    <span style={{ margin: "0 4px" }}>:</span>
                                    {/*  显示异常总信息提示: 如 "数据部分同步（同步超时）" */}
                                    {cr.i18nExceptionMessage}
                                    {/* （1）已同步数据成功失败展示: "已同步数据成功 xx 条，失败 xx 条" */}
                                    {
                                      cr.totalSuccessfulCount > 0 || cr.totalFailedCount > 0 ?
                                        (
                                          <>
                                            <SyncDetailButton onClick={() => setPreviewItem(cr)}>
                                              {t(p("syncDetailsContent.hasSyncDataWhenException"))}
                                              {t(p("syncDetailsContent.syncCountDetailsSucceed"),
                                                [cr.totalSuccessfulCount])}
                                              {t(p("syncDetailsContent.syncFailedCount"), [cr.totalFailedCount])}
                                            </SyncDetailButton>
                                          </>
                                        ) : (
                                          // （2）异常且未发生同步时："已处理部分没有需要同步的数据"
                                          <>
                                            {t(p("syncDetailsContent.noSyncDataWhenException"))}
                                          </>
                                        )
                                    }
                                  </div>
                                ) : (
                                  // 2.集群内数据完全同步时
                                  cr.totalSyncCount === cr.totalSuccessfulCount ? (
                                    <div>
                                      {clusterName}
                                      <span style={{ margin: "0 4px" }}>:</span>
                                      { cr.totalSyncCount === 0
                                        // (1) "{集群}：数据一致，无需同步"
                                        ? t(p("syncDetailsContent.noSyncData"))
                                        : (
                                        // (2) 数据同步全部成功: "{集群}：数据已完全同步，共完成 xx 条差异数据同步"
                                          <>
                                            {t(p("syncDetailsContent.syncTotallySucceed"))}
                                            <SyncDetailButton onClick={() => setPreviewItem(cr)}>
                                              {t(p("syncDetailsContent.syncTotallySucceedCount"),
                                                [cr.totalSyncCount])}
                                            </SyncDetailButton>
                                          </>
                                        )
                                      }
                                    </div>
                                  ) : (
                                    // 3. 集群内数据未完全同步时
                                    // "{集群}：共有 xx 条差异数据需要同步，成功 xx 条，失败 xx 条"
                                    <div>
                                      {clusterName}
                                      <span style={{ margin: "0 4px" }}>:</span>
                                      {t(p("syncDetailsContent.syncCountDetailsTotal"), [cr.totalSyncCount])}
                                      <SyncDetailButton onClick={() => setPreviewItem(cr)}>
                                        {t(p("syncDetailsContent.syncCountDetailsSucceed"),
                                          [cr.totalSuccessfulCount])}
                                        {t(p("syncDetailsContent.syncFailedCount"), [cr.totalFailedCount])}
                                      </SyncDetailButton>
                                    </div>
                                  )
                                )
                              );
                            })
                          }
                        </>
                      // 未获取到集群同步详情时的兜底
                      ) : t(p("syncDetailsContent.noSyncDetailsException"))
                    }
                  </>
                )}
              </div>
            );
          }}
        />
      </Table>
      <ClusterSyncResultDrawer
        open={previewItem !== undefined}
        onClose={() => setPreviewItem(undefined)}
        item={previewItem}
        t={t}
        title={ previewItem?.clusterId ?
          `${getClusterName(previewItem?.clusterId, languageId, publicConfigClusters)} `
          + `${t(p("syncDetailsContent.drawerTitle"))}`
          : ""
        }
      />
    </>
  );
};

interface SyncDetailButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

const SyncDetailButton: React.FC<SyncDetailButtonProps> = ({ onClick, children }) => (
  <Button
    type="link"
    style={{
      margin: 0,
      padding: "0 4px",
      textDecoration: "underline",
      fontSize: "13px",
      height: "auto",
    }}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
  >
    {children}
  </Button>
);
