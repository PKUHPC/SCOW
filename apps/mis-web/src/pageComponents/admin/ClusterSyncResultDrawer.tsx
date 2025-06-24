import { Descriptions, Drawer } from "antd";
import { DisplayedSyncDetail } from "src/utils/syncAccountUser";

interface Props {
  open: boolean;
  item: DisplayedSyncDetail | undefined;
  onClose: () => void;
  title?: string;
}

export const ClusterSyncResultDrawer: React.FC<Props> = ({
  item, onClose, open, title,
}) => {
  const drawerDetails = item?.i18nSyncDetails;

  return (
    <Drawer
      width={500}
      placement="right"
      onClose={onClose}
      open={open}
      title={title}
    >
      {
        drawerDetails && Object.values(drawerDetails)?.length > 0 ? (
          <Descriptions
            column={1}
            bordered
            size="small"

          >
            {Object.entries(drawerDetails).map(([drawerLabel, drawerValue], index) => (
              <Descriptions.Item 
                key={index} 
                label={drawerLabel}
                labelStyle={{ width: "30%", verticalAlign: "top" }}
              >
                <span style={{ whiteSpace: "pre-line" }}>{drawerValue}</span>
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : undefined }
    </Drawer>
  );
};
