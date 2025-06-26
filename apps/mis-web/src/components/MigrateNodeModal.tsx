/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Col, Form, Modal, Row, Select } from "antd";
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
  migratableClusterList: { cluster: string; partitions: string[] }[];
  onClose: () => void;
  onComplete: (destinationCluster: string) => Promise<void>;
  open: boolean;
}

interface FormProps {
  destinationCluster: string;
}
const p = prefix("page.admin.resourceManagement.nodeMigrationModal.");

const MigrateNodeModal: React.FC<Props> = ({ nodeName, clusterId, partitions,
  migratableClusterList, onClose, onComplete, open }) => {

  const tArgs = useI18nTranslate();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);
  const [destinationPartitions, setDestinationPartitionOptions] = useState<string>("");

  const onOK = async () => {
    const { destinationCluster } = await form.validateFields();
    setLoading(true);
    await onComplete(destinationCluster)
      .then(() => {
        form.resetFields();
        setDestinationPartitionOptions("");
        onClose();
      })
      .finally(() => setLoading(false));
  };

  const { publicConfigClusters } = useStore(ClusterInfoStore);
  const languageId = useI18n().currentLanguage.id;

  const migratableClusterListMap = new Map<string, string[]>();

  const clusterOptions = migratableClusterList.map(({ cluster: clusterId, partitions }) => {
    migratableClusterListMap.set(clusterId, partitions);
    return { label:getClusterName(clusterId, languageId, publicConfigClusters), value:clusterId };
  });

  const handleClusterChange = (destinationCluster: string) => {
    setDestinationPartitionOptions(migratableClusterListMap.get(destinationCluster)?.join(", ") || "");
  };

  // 动态列宽度配置
  const labelColSpan = languageId === "zh_cn" ? 6 : 10;
  const valueColSpan = 24 - labelColSpan;

  const onCancel = () => {
    form.resetFields();
    setDestinationPartitionOptions("");
    onClose();
  };

  return (
    <Modal
      title={tArgs(p("title"))}
      open={open}
      onOk={onOK}
      confirmLoading={loading}
      onCancel={onCancel}
    >
      <br></br>
      <Row gutter={16}>
        <Col span={labelColSpan}>
          <p>{tArgs(p("nodeName"))}：</p>
          <p>{tArgs(p("currentCluster"))}：</p>
          <p>{tArgs(p("currentPartitionQueue"))}：</p>
          <p>{tArgs(p("destinationCluster"))}：</p>
          <p>{tArgs(p("destinationPartitionQueue"))}：</p>
        </Col>
        <Col span={valueColSpan}>
          <p>{nodeName}</p>
          <p>{getClusterName(clusterId, languageId, publicConfigClusters)}</p>
          <p><span style={{ minHeight: "1em", display: "inline-block" }}>
            {partitions.map((item) => item).join(", ") }</span></p>
          <Form
            form={form}
            layout="vertical"
            initialValues={undefined}
            preserve={false}
          >
            <Form.Item
              name="destinationCluster"
              style={{ marginBottom: 0, marginTop: "-3px" }}
              rules={[{ required: true }]}
            >
              <Select
                options={clusterOptions}
                onChange={handleClusterChange}
              />
            </Form.Item>
          </Form>
          <p style={{ marginTop: "7px" }}>{destinationPartitions}</p>
        </Col>
      </Row>
    </Modal>
  );
};
export const MigrateNodeModalLink = ModalLink(MigrateNodeModal);
