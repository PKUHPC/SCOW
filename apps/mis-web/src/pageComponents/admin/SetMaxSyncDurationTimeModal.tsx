import { App, Form, InputNumber, Modal } from "antd";
import { api } from "src/apis";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { publicConfig } from "src/utils/config";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  setFetching: React.Dispatch<React.SetStateAction<boolean>>;
}

interface FormFields {
  maxSyncDurationMinutes: number;
}

const p = prefix("page.admin.systemDebug.syncClusterAccountUser.");

export const SetMaxSyncDurationTimeModal: React.FC<Props> = ({
  onClose, reload, open, setFetching,
}) => {

  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const onOk = async () => {
    await form.validateFields();
    onClose();
    setFetching(true);
    api.syncAccountUserInfo({
      body: { maxSyncDurationMinutes: form.getFieldValue("maxSyncDurationMinutes") },
    })
      .httpError(409, () => {
        message.error(t(p("syncAlreadyStarted")));
      })
      .then(() => {
        reload();
      })
      .finally(() => {
        setFetching(false);
      });
  };

  return (
    <Modal
      title={`${t("page.admin.systemDebug.syncClusterAccountUser.syncUserAccount")}`}
      open={open}
      onCancel={onClose}
      onOk={onOk}
      okText={t(p("syncSchedulerUserAccountNow"))}
      cancelButtonProps={{ style: { display: "none" } }}
    >
      <Form
        form={form}
        initialValues={{ maxSyncDurationMinutes: publicConfig.MAX_SYNC_DURATION_MINUTES }}
        layout="vertical"
      >
        <Form.Item
          name="maxSyncDurationMinutes"
          label={t(p("maxSyncDurationMinutesModalLabel"))}
          required
        >
          <InputNumber
            min={1}
            step={1}
            precision={0}
            addonAfter={t(p("minuteUnit"))}
          />
        </Form.Item>
      </Form>

    </Modal>

  );
};

export const SetMaxSyncDurationTimeLink = ModalLink(SetMaxSyncDurationTimeModal);
