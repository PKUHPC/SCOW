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

import { PlusOutlined } from "@ant-design/icons";
import { App, Button, DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs from "dayjs";
import React, { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface FormProps {
  accountName: string;
  comment: string;
  expirationTime: dayjs.Dayjs
}

interface ModalProps {
  open: boolean;
  close: () => void;
  refresh: () => void;
}

const p = prefix("pageComp.tenant.addWhitelistedAccountButton.");
const pCommon = prefix("common.");

// 过期时间选择组件的interface
interface PickExpDateProps {
  id?: string;
  value?: dayjs.Dayjs;
  onChange?: (value: dayjs.Dayjs) => void;
}

// 过期时间选择组件
const PickExpDate: React.FC<PickExpDateProps> = (props) => {
  const { id, onChange } = props;


  const t = useI18nTranslateToString();

  // 添加状态来跟踪选择的选项
  const [selectedOption, setSelectedOption] = useState<string>("custom");


  // 定义 Select 选项数组，使用国际化函数 t() 翻译每个选项的 label
  const options = [
    { value: "custom", label: t(p("custom")) },
    { value: "oneWeek", label: t(p("oneWeek")) },
    { value: "oneMonth", label: t(p("oneMonth")) },
    { value: "oneYear", label: t(p("oneYear")) },
    { value: "permanent", label: t(p("permanent")) },
  ];

  // 定义规范时间
  const dateFormat = "YYYY-MM-DD";

  // dateRange的时间
  const [expirationTime, setExpirationTime] = useState<dayjs.Dayjs>(dayjs().add(1, "day").endOf("day"));

  // 对dateRange时间根据options选项进行处理
  React.useEffect(() => {
    let newDate: dayjs.Dayjs | string;
    switch (selectedOption) {

    // 一周
    case "oneWeek":
      newDate = dayjs().add(1, "week").endOf("day");
      break;

      // 一个礼拜
    case "oneMonth":
      newDate = dayjs().add(1, "month").endOf("day");
      break;

    // 一年
    case "oneYear":
      newDate = dayjs().add(1, "year").endOf("day");
      break;

      // 永久生效
    case "permanent":
      newDate = dayjs("2099-12-31").endOf("day");
      break;

      // 自定义时间
    case "custom":
      newDate = expirationTime ?? dayjs().add(1, "day").endOf("day");
      break;

    default:
      newDate = dayjs().add(1, "day").endOf("day");
      break;
    }
    // 传递值
    onChange?.(newDate);
    // 更新组件状态
    setExpirationTime(newDate);
  }, [selectedOption]);

  return (
    <div id={id}>
      <Select
        defaultValue={options[0].value}
        options={options}
        onChange={(value) => setSelectedOption(value)} // 更新选择
        style={{ width: "35%", marginRight:"5%" }}
      />
      {/*  根据选项禁用或启用 DatePicker */}
      <DatePicker
        disabled={selectedOption !== "custom"}
        minDate={dayjs(dayjs().add(1, "day").format(dateFormat))}
        value={ expirationTime }
        style={{ width: "60%" }}
        onChange={(date) =>
        {
          setExpirationTime(date);
          onChange?.(date);
        }
        } // 更新状态
      />
    </div>
  );
};


const NewAccountModal: React.FC<ModalProps> = ({
  open, close, refresh,
}) => {

  const t = useI18nTranslateToString();

  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<FormProps>();


  const onOk = async () => {
    const { accountName, expirationTime, comment } = await form.validateFields();
    await api.whitelistAccount({ body: { accountName: accountName.trim(), comment,
      expirationTime:expirationTime.toISOString() } })
      .httpError(404, () => {
        message.error(t(p("notExist")));
      })
      .then(() => {
        message.success(t(p("addSuccess")));
        refresh();
        close();
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Modal
      title={t(p("addWhiteList"))}
      open={open}
      onCancel={close}
      onOk={onOk}
      confirmLoading={loading}
    >
      <Form form={form}>
        <Form.Item name="accountName" rules={[{ required: true }]} label={t(pCommon("accountName"))}>
          <Input />
        </Form.Item>
        {/* 日期选择 */}
        <Form.Item name="expirationTime" label={t(pCommon("expirationTime"))} rules={[{ required: true }]}>
          <PickExpDate
            id="expirationTime"
            value={form.getFieldValue("expirationTime")}
            onChange={(date) => form.setFieldsValue({ expirationTime: date })}
          />
        </Form.Item>
        <Form.Item name="comment" rules={[{ required: true }]} label={t(pCommon("comment"))}>
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface Props {
  refresh: () => void;
}



export const AddWhitelistedAccountButton: React.FC<Props> = ({ refresh }) => {

  const [modalShow, setModalShow] = useState(false);

  const t = useI18nTranslateToString();



  return (
    <>
      <NewAccountModal close={() => setModalShow(false)} open={modalShow} refresh={refresh} />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalShow(true)}>
        {t(p("addWhiteList"))}
      </Button>
    </>
  );
};
