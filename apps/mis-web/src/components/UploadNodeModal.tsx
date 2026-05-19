import { Col, Modal, Row } from "antd";
import { useState } from "react";
import { useStore } from "simstate";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18n, useI18nTranslate } from "src/i18n";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { getClusterName } from "src/utils/cluster";

interface Props {
  nodeName: string;
  clusterId: string;
  partitions: string[];
  onClose: () => void;
  onComplete: () => Promise<void>;
  open: boolean;
}

const p = prefix("page.admin.resourceManagement.nodeMigrationModal.");

const UploadNodeModal: React.FC<Props> = ({ nodeName, clusterId, partitions, onClose, onComplete, open }) => {
  const tArgs = useI18nTranslate();

  const [loading, setLoading] = useState(false);
  const { publicConfigClusters } = useStore(ClusterInfoStore);
  const languageId = useI18n().currentLanguage.id;

  // 动态列宽配置
  const labelColSpan = languageId === "zh_cn" ? 6 : 9;
  const valueColSpan = 24 - labelColSpan;

  const onOK = async () => {
    setLoading(true);
    await onComplete()
      .then(() => {
        onClose();
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={tArgs(p("title2"))} open={open} onOk={onOK} confirmLoading={loading} onCancel={onClose}>
      <br></br>
      <Row gutter={16}>
        <Col span={labelColSpan}>
          <p>{tArgs(p("nodeName"))}：</p>
          <p>{tArgs(p("currentCluster"))}：</p>
          <p>{tArgs(p("currentPartitionQueue"))}：</p>
        </Col>
        <Col span={valueColSpan}>
          <p>{nodeName}</p>
          <p>{getClusterName(clusterId, languageId, publicConfigClusters)}</p>
          <p>{partitions.join(", ")}</p>
        </Col>
      </Row>
    </Modal>
  );
};
export const UploadNodeModalLink = ModalLink(UploadNodeModal);
