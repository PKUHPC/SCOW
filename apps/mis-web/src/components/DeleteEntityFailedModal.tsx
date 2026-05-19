import { Modal } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { DeleteFailedReason, EntityType } from "src/models/User";

interface Message {
  type: DeleteFailedReason;
  userId?: string;
  accounts?: string[];
}

interface Props {
  message: Message;
  onClose: () => void;
  open: boolean;
  entityType?: EntityType;
}

const p = prefix("component.deleteModals.");

export const DeleteEntityFailedModal: React.FC<Props> = ({ message, onClose, open, entityType = EntityType.USER }) => {
  const t = useI18nTranslateToString();
  const { userId = "", accounts = [] } = message;

  const renderContent = () => {
    if (message.type === DeleteFailedReason.ACCOUNTS_OWNER) {
      if (entityType === EntityType.USER) {
        return (
          <div
            dangerouslySetInnerHTML={{
              __html: t(p("accountsOwnerPrompt"), [userId, accounts.join(",")]),
            }}
          />
        );
      }
      return null;
    } else if (message.type === DeleteFailedReason.RUNNING_JOBS) {
      return entityType === EntityType.ACCOUNT ? (
        <div>{t(p("accountRunningJobsPrompt"))}</div>
      ) : (
        <div>{t(p("userRunningJobsPrompt"))}</div>
      );
    }
    return null;
  };

  return (
    <Modal
      title={t(p("deleteFailed"))}
      open={open}
      onOk={onClose}
      onCancel={onClose}
      width="620px" // 设置Modal宽度
    >
      {renderContent()}
    </Modal>
  );
};
