import { Modal, Typography } from "antd";
import React from "react";
import { RenderContent } from "src/utils/rendering-message";

const { Text } = Typography;

export interface Props {
  open: boolean;
  onClose: () => void;
  data: RenderContent | undefined;
}

export const MessageContentModal: React.FC<Props> = ({ open, onClose, data }) => {

  const handleOk = () => {
    onClose();
  };

  return (
    <Modal
      title={<div style={{ paddingRight: "32px" }}>{data?.title}</div>}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      footer={(_, { OkBtn }) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Text type="secondary">{data?.createdAt}</Text>
          <OkBtn />
        </div>
      )}
    >
      {data?.content}
    </Modal>
  );
};
