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

import { useMutation, useQuery } from "@connectrpc/connect-query";
import { MessageConfig } from "@scow/notification-protos/build/common_pb";
import {
  listUserSubscriptions,
  modifyUserSubscription,
} from "@scow/notification-protos/build/user_subscription-UserSubscriptionService_connectquery";
import { Form, message, Table } from "antd";
import React, { useContext, useEffect, useState } from "react";
import { NoShadowButton } from "src/components/no-shadow-button";
import { PageTitle } from "src/components/page-title";
import { ScowParamsContext } from "src/components/scow-params-provider";
import { useSubscriptionColumns } from "src/hook/use-subscription-columns";
import { NoticeType } from "src/models/notice-type";
import { getLanguage } from "src/utils/i18n";
import { styled } from "styled-components";

// 定义样式组件
interface StyledTrProps {
  isDark: boolean;
}
// 定义样式组件
const WhiteRow = styled.tr<StyledTrProps>`
  background-color: ${({ isDark }) => isDark ? "#121212" : "#ffffff"};

  &:hover {
    background-color: ${({ isDark }) => isDark ? "#1D262C" : "#E9EDEE"};
  }
`;

const GrayRow = styled.tr<StyledTrProps>`
  background-color: ${({ isDark }) => isDark ? "#1D1D1D" : "#f7f7f7"};

  &:hover {
    background-color: ${({ isDark }) => isDark ? "#1D262C" : "#E9EDEE"};
  }
`;

export interface FormValues {
  noticeConfigs: Record<string, Partial<Record<NoticeType, boolean>>>;
}

const noticeTypeNumbers = Object.values(NoticeType).filter((v): v is NoticeType => typeof v === "number");

const defaultAllTrue = noticeTypeNumbers.reduce((acc, noticeType) => {
  acc[noticeType] = true;
  return acc;
}, {} as Record<NoticeType, boolean>);

const defaultNoticeTypesPartialChecked = noticeTypeNumbers.reduce((acc, noticeType) => {
  acc[noticeType] = false;
  return acc;
}, {} as Record<NoticeType, boolean>);

export const UserSubscriptionTable: React.FC = () => {

  const { scowLangId, scowDark } = useContext(ScowParamsContext);
  const language = getLanguage(scowLangId);
  const compLang = language.subscription.subscriptionTable;

  const [form] = Form.useForm<FormValues>();

  const [noticeTypeAllChecked, setNoticeTypeAllChecked]
      = useState<Partial<Record<NoticeType, boolean>>>(defaultAllTrue);
  const [noticeTypePartialChecked, setNoticeTypePartialChecked]
      = useState<Partial<Record<NoticeType, boolean>>>(defaultNoticeTypesPartialChecked);
  const [checkAllDisabled, setCheckAllDisabled] = useState(defaultAllTrue);
  const [hasChange, setHasChange] = useState(false);

  const { data, isLoading, refetch } = useQuery(listUserSubscriptions);
  const { mutateAsync, isPending } = useMutation(modifyUserSubscription, {
    onError: (err) => message.error(err.message),
    onSuccess: () => {
      setHasChange(false);
      message.success(compLang.saveSuccess);
      refetch();
    },
  });

  const columns = useSubscriptionColumns({
    form, messageConfigs: data?.configs, checkAllDisabled,
    noticeTypeAllChecked, setNoticeTypeAllChecked,
    noticeTypePartialChecked, setNoticeTypePartialChecked,
    setHasChange, lang: language,
  });

  const initFormFromData = (configs: MessageConfig[]) => {
    const noticeConfigs: Record<string, Partial<Record<NoticeType, boolean>>> = {};
    // 统计每个 NoticeType 的用户可操作项数量和已勾选数量
    const stats: Record<number, { modifiable: number; checked: number }> = {};
    const newCheckAllDisabled = { ...defaultAllTrue };

    configs.forEach((item) => {
      noticeConfigs[item.messageType] = {};
      item.noticeConfigs.forEach((config) => {
        if (config.noticeType === undefined) return;
        const noticeType = config.noticeType as number;
        noticeConfigs[item.messageType][noticeType] = config.enabled;
        if (config.canUserModify === true) {
          newCheckAllDisabled[noticeType] = false;
          if (!stats[noticeType]) stats[noticeType] = { modifiable: 0, checked: 0 };
          stats[noticeType].modifiable++;
          if (config.enabled) stats[noticeType].checked++;
        }
      });
    });

    const newAllChecked = { ...defaultAllTrue };
    const newPartialChecked = { ...defaultNoticeTypesPartialChecked };

    Object.entries(stats).forEach(([noticeTypeStr, { modifiable, checked }]) => {
      const noticeType = Number(noticeTypeStr) as NoticeType;
      if (checked === modifiable) {
        newAllChecked[noticeType] = true;
        newPartialChecked[noticeType] = false;
      } else if (checked > 0) {
        newAllChecked[noticeType] = false;
        newPartialChecked[noticeType] = true;
      } else {
        newAllChecked[noticeType] = false;
        newPartialChecked[noticeType] = false;
      }
    });

    setCheckAllDisabled(newCheckAllDisabled);
    setNoticeTypeAllChecked(newAllChecked);
    setNoticeTypePartialChecked(newPartialChecked);
    form.setFieldsValue({ noticeConfigs });
  };

  const handleCancel = () => {
    if (!data) return;
    initFormFromData(data.configs);
    setHasChange(false);
  };

  const handleSave = async () => {
    if (!data) return;
    try {
      const values = form.getFieldsValue();

      const parsedValues = Object.keys(values.noticeConfigs).map((messageType) => {

        const messageConfig = data?.configs.find((config) => config.messageType === messageType);

        if (!messageConfig) {
          message.error(compLang.formError);
          throw Error("Unable to find the corresponding MessageConfig");
        };

        const noticeConfigs = Object.keys(values.noticeConfigs[messageType])
          .filter((noticeType) => values.noticeConfigs[messageType][noticeType] !== undefined)
          .map((noticeType) => {
            const enumNoticeType = Number(noticeType) as unknown as NoticeType;

            const originalNoticeConfig = messageConfig?.noticeConfigs.find(
              (config) => config.noticeType === enumNoticeType);

            if (!originalNoticeConfig) {
              message.error(compLang.formError);
              throw Error("Unable to find the corresponding NoticeType");
            };

            return {
              noticeType: enumNoticeType,
              canUseModify: originalNoticeConfig.canUserModify,
              enabled: values.noticeConfigs[messageType][noticeType]!,
            };
          });

        return {
          ...messageConfig,
          noticeConfigs,
        };
      });

      await mutateAsync({ configs: parsedValues.map((x) => ({
        ...x,
        $typeName: "notification.MessageConfig",
        noticeConfigs: x.noticeConfigs.map((nc) => ({ ...nc, $typeName: "notification.MessageNoticeTypeConfig" })),
      })) });

    } catch {
      message.error(compLang.saveError);
    }
  };

  useEffect(() => {
    if (data) {
      initFormFromData(data.configs);
    }
  }, [data]);

  return (
    <div>
      <PageTitle titleText={language.subscription.pageTitle}>
        <div style={{ textAlign: "right", marginBottom: "10px", visibility: hasChange ? "visible" : "hidden" }}>
          <NoShadowButton
            onClick={handleCancel}
            style={{ marginRight: "10px" }}
          >
            {language.common.cancel}
          </NoShadowButton>
          <NoShadowButton
            loading={isPending}
            type="primary"
            onClick={handleSave}
          >
            {language.common.save}
          </NoShadowButton>
        </div>
      </PageTitle>
      <Form form={form} name="message-config">
        <Table
          bordered
          pagination={false}
          rowKey="messageType"
          loading={isLoading || isPending}
          columns={columns}
          dataSource={data?.configs ?? []}
          rowClassName={(_, index) => (index % 2 === 0 ? "white-row" : "gray-row")}
          components={{
            body: {
              row: (props) => {
                const { className, ...restProps } = props;
                if (className.includes("white-row")) {
                  return <WhiteRow isDark={scowDark} {...restProps} />;
                }
                return <GrayRow isDark={scowDark} {...restProps} />;
              },
            },
          }}
        />
      </Form>
    </div>
  );
};
