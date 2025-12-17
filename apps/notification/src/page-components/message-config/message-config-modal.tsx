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

import { useMutation } from "@connectrpc/connect-query";
import { MessageConfig } from "@scow/notification-protos/build/common_pb";
import {
  modifyMessageConfigs,
} from "@scow/notification-protos/build/message_config-MessageConfigService_connectquery";
import { Checkbox, Form, message, Modal } from "antd";
import React, { useEffect, useState } from "react";
import { I18nDicType } from "src/models/i18n";
import { getNoticeTypeName,NoticeType } from "src/models/notice-type";

interface FormValues {
  userModifyConfigs: NoticeType[];
}

export interface Props {
  open: boolean;
  onClose: () => void;
  // formNoticeConfigs: Record<string, Partial<Record<NoticeType, boolean>>>,
  data: MessageConfig;
  enabledNoticeTypes: NoticeType[];
  lang: I18nDicType;
}

export const MessageConfigModal: React.FC<Props> = ({
  open, onClose, data, enabledNoticeTypes, lang,
}) => {

  const [form] = Form.useForm<FormValues>();
  const compLang = lang.messageConfig.messageConfigModal;

  useEffect(() => {
    if (data) {
      const initialValues = {
        userModifyConfigs: data.noticeConfigs.filter((config) => !config.canUserModify).map((config) => {
          return config.noticeType;
        }).filter((noticeType) => noticeType !== undefined),
      };
      form.setFieldsValue(initialValues);
    }
  },[data]);

  const [userModifyConfigLoading, setUserModifyConfigLoading] = useState<boolean>();

  // const checkBoxCanModify = useMemo(() => {
  //   const noticeMap = new Map<NoticeType, boolean>();
  //   if (!formNoticeConfigs?.[data.messageType]) return noticeMap;

  //   Object.entries(formNoticeConfigs[data.messageType]).forEach(([key, value]) => {
  //     if (value !== undefined) {
  //       noticeMap.set(Number(key) as unknown as NoticeType, value);
  //     }
  //   });
  //   console.log(data.messageType, noticeMap);
  //   return noticeMap;
  // }, [formNoticeConfigs]);

  const { mutateAsync } = useMutation(modifyMessageConfigs, {
    onError: (err) => message.error(err.message),
    onSuccess: () => {
      message.success(compLang.modifySuccess);
      setUserModifyConfigLoading(false);
      onClose();
    },
    onSettled: () => setUserModifyConfigLoading(false),
  });

  const submitUserModifyConfig = () => {
    const { userModifyConfigs } = form.getFieldsValue();
    setUserModifyConfigLoading(true);
    mutateAsync({ configs: [{
      ...data,
      noticeConfigs: data?.noticeConfigs.map((config) => ({
        ...config,
        canUserModify: config.noticeType !== undefined
          ? !userModifyConfigs.includes(config.noticeType) : config.canUserModify,
      })),
    }]});
  };

  return (
    <>
      <Modal
        title={compLang.authorization}
        open={open}
        onOk={submitUserModifyConfig}
        onCancel={onClose}
        confirmLoading={userModifyConfigLoading}
        okText={lang.common.confirm}
        cancelText={lang.common.cancel}
      >
        <Form
          form={form}
          layout="vertical"
          name="authorization_form"
        >
          <Form.Item
            name="userModifyConfigs"
            label={compLang.dontAllowCancel}
          >
            <Checkbox.Group style={{ width: "100%" }}>
              {
                enabledNoticeTypes.map((noticeType) => {
                  const disabled = !data.noticeConfigs.find(
                    (config) => config.noticeType === noticeType,
                  )?.enabled;

                  return (
                    <Checkbox
                      disabled={disabled}
                      value={noticeType}
                    >
                      {getNoticeTypeName(noticeType)}
                    </Checkbox>
                  );
                })
              }
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
