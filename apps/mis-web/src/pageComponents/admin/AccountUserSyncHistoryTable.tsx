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
            } else if (r.sessionSyncResult === SyncAccountUserResult.SUCCESS) {
              displayedContent = t(p("syncDetailsContent.allSuccessfulMessage"));
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
                                // 集群内数据同步时发生异常
                                cr.exceptionHappened ? (
                                  <div>
                                    {clusterName}
                                    <span style={{ margin: "0 4px" }}>:</span>
                                    {cr.i18nExceptionMessage}
                                  </div> 
                                ) : (
                                  // 集群内数据完全同步时
                                  cr.totalSyncCount === cr.totalSuccessfulCount ? (
                                    <div>
                                      {clusterName}
                                      <span style={{ margin: "0 4px" }}>:</span>
                                      { cr.totalSyncCount === 0 ? t(p("syncDetailsContent.noSyncData")) : 
                                        t(p("syncDetailsContent.syncTotallySucceed"), [cr.totalSyncCount])}
                                    </div>
                                  ) : (
                                    // 集群内数据未完全同步时
                                    <div>
                                      {clusterName}
                                      <span style={{ margin: "0 4px" }}>:</span>
                                      {t(p("syncDetailsContent.syncCountDetails"), 
                                        [cr.totalSyncCount, cr.totalSuccessfulCount])}
                                      <Button 
                                        type="link" 
                                        style={{ 
                                          margin: 0, 
                                          padding: "0 4px",
                                          textDecoration: "underline",
                                        }}
                                        onClick={() => setPreviewItem(cr)}
                                      >
                                        {t(p("syncDetailsContent.syncFailedCount"), [cr.totalFailedCount])}
                                      </Button>   
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
        title={ previewItem?.clusterId ? 
          `${getClusterName(previewItem?.clusterId, languageId, publicConfigClusters)} `
          + `${t(p("syncDetailsContent.failedDetailDrawerTitle"))}`
          : ""
        }
      />
    </>
  );
};
