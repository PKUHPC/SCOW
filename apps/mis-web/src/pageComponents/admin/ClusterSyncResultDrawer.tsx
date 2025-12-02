import { Collapse, Descriptions, Drawer } from "antd";
import { TransType } from "src/models/job";
import { DisplayedSyncDetail } from "src/utils/syncAccountUser";

interface Props {
  open: boolean;
  item: DisplayedSyncDetail | undefined;
  onClose: () => void;
  t: TransType;
  title?: string;
}

export const ClusterSyncResultDrawer: React.FC<Props> = ({
  item, onClose, open, t, title,
}) => {
  const succeedNamesDrawerResult = item?.i18nSyncDetails?.i18nSyncSucceedResult;
  const failedNamesDrawerResult = item?.i18nSyncDetails?.i18nSyncFailedResult;
  const failedNamesWithMsgDrawerResult = item?.i18nSyncDetails?.i18nSyncFailedResultWithMsg;

  return (
    <Drawer
      width={500}
      placement="right"
      onClose={onClose}
      open={open}
      title={title}
    >
      <Collapse
        defaultActiveKey={["success", "failed"]}
      >
        {
          succeedNamesDrawerResult && Object.values(succeedNamesDrawerResult)?.length > 0 ? (
            <Collapse.Panel
              header={t("page.admin.systemDebug.syncClusterAccountUser.syncDetailsContent.drawerSucceedTitle")}
              key="success"
            >
              <SyncDetailsDescription data={succeedNamesDrawerResult} />
            </Collapse.Panel>
          ) : undefined }
        {
          failedNamesDrawerResult && Object.values(failedNamesDrawerResult)?.length > 0 ? (
            <Collapse.Panel
              header={t("page.admin.systemDebug.syncClusterAccountUser.syncDetailsContent.drawerFailedTitle")}
              key="failed"
            >
              <SyncDetailsDescription data={failedNamesDrawerResult} />
            </Collapse.Panel>
          ) : undefined }
        {
          failedNamesWithMsgDrawerResult && Object.values(failedNamesWithMsgDrawerResult)?.length > 0 ? (
            <Collapse.Panel
              header={t("page.admin.systemDebug.syncClusterAccountUser.syncDetailsContent.drawerFailedDetailTitle")}
              key="failureMsg"
            >
              <SyncDetailsDescription data={failedNamesWithMsgDrawerResult} />
            </Collapse.Panel>
          ) : undefined }
      </Collapse>
    </Drawer>
  );
};


const SyncDetailsDescription: React.FC<{
  data: Record<string, string>;
}> = ({ data }) => (
  <Descriptions column={1} bordered size="small">
    {Object.entries(data).map(([label, value], index) => (
      <Descriptions.Item
        key={index}
        label={label}
        labelStyle={{ width: "30%", verticalAlign: "top" }}
      >
        <span style={{ whiteSpace: "pre-line" }}>{value}</span>
      </Descriptions.Item>
    ))}
  </Descriptions>
);
