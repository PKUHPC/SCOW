import { useMutation } from "@connectrpc/connect-query";
import { createCustomMessageType } from "@scow/notification-protos/build/message_type-MessageTypeService_connectquery";
import { message, Modal } from "antd";
import React, { useState } from "react";
import { I18nDicType } from "src/models/i18n";
import { MessageTypeInfo } from "src/models/message-type";

export interface Props {
  open: boolean;
  onClose: () => void;
  data: MessageTypeInfo | undefined;
  lang: I18nDicType;
}

export const PreviewCreateModal: React.FC<Props> = ({ open, onClose, data, lang }) => {
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const compLang = lang.createCustomMessageType.previewCreateModal;

  const { mutateAsync } = useMutation(createCustomMessageType, {
    onError: (err) => message.error(err.message),
    onSuccess: () => {
      message.success(compLang.createSuccess);
      setCreateLoading(false);
      onClose();
    },
    onSettled: () => setCreateLoading(false),
  });

  const submitCustomMessageType = () => {
    setCreateLoading(true);
    if (!data) {
      message.error(compLang.formCantEmpty);
      return;
    }
    mutateAsync({
      ...data,
    });
  };

  return (
    <>
      <Modal
        title={compLang.confirmCreate}
        open={open}
        onOk={submitCustomMessageType}
        onCancel={onClose}
        confirmLoading={createLoading}
        okText={lang.common.confirm}
        cancelText={lang.common.cancel}
      ></Modal>
    </>
  );
};
