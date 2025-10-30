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

import { Checkbox, Form, Modal, Select } from "antd";
import { useState } from "react";
import { ModalButton } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Encoding } from "src/models/exportFile";

interface Props {
  options?: { label: string, value: string }[];
  onClose: () => void;
  onExport: (encoding: string, columns?: string[]) => Promise<void>;
  open: boolean;
}

interface FormProps {
  columns?: string[];
  encoding: string;
}

const p = prefix("pageComp.commonComponent.exportFileModal.");

const ExportFileModal: React.FC<Props> = ({ options, onClose, onExport, open }) => {
  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const onOK = async () => {
    const { columns, encoding } = await form.validateFields();

    setLoading(true);

    await onExport(encoding, columns).then(() => {
      onClose();
      form.resetFields();
    })
      .finally(() => {
        setLoading(false);
      });
  };


  return (
    <Modal
      title={t(p("title"))}
      open={open}
      onOk={onOK}
      confirmLoading={loading}
      onCancel={onClose}
      destroyOnClose={true}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ columns: options?.map((option) => option.value), encoding: Encoding.GB18030 }}
      >
        {options ? (
          <Form.Item
            rules={[{ required: true, message: t(p("errorMsg")) }]}
            label={t(p("subTitle"))}
            name="columns"
          >
            <Checkbox.Group options={options} />
          </Form.Item>
        ) : ""}
        <Form.Item
          label={t(p("encoding"))}
          name="encoding"
        >
          <Select size="small" style={{ width: "100px" }}>
            <Select.Option value={Encoding.GB18030}>GB18030</Select.Option>
            <Select.Option value={Encoding.UTF8}>UTF-8</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export const ExportFileModaLButton = ModalButton(ExportFileModal, { type: "primary" });
