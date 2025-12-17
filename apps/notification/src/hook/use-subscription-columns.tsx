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

import { useQuery } from "@connectrpc/connect-query";
import { MessageConfig } from "@scow/notification-protos/build/common_pb";
import { listNoticeTypes } from "@scow/notification-protos/build/notice_type-NoticeTypeService_connectquery";
import { Checkbox, Form, FormInstance, TableColumnsType, Tooltip } from "antd";
import { CheckboxChangeEvent, CheckboxProps } from "antd/es/checkbox";
import { Dispatch, ReactNode, useContext, useEffect, useState } from "react";
import { CheckAllSpecifiedNoticeType } from "src/components/check-all-specified-notice-type";
import { ScowParamsContext } from "src/components/scow-params-provider";
import { I18nDicType } from "src/models/i18n";
import { NoticeType } from "src/models/notice-type";
import { FormValues } from "src/page-components/message-config/message-config-table";

export interface SelectAllProps {
  e: CheckboxChangeEvent;
  checkedNoticeType: NoticeType
}

interface Props {
  form: FormInstance<FormValues>;
  messageConfigs: MessageConfig[] | undefined;
  checkAllDisabled: Partial<Record<NoticeType, boolean>>;
  noticeTypeAllChecked: Partial<Record<NoticeType, boolean>>;
  setNoticeTypeAllChecked: Dispatch<React.SetStateAction<Partial<Record<NoticeType, boolean>>>>;
  setHasChange: Dispatch<React.SetStateAction<boolean>>;
  lang: I18nDicType;
}

interface TooltipCheckboxProps extends CheckboxProps {
  tooltipTitle: ReactNode;
}

const TooltipCheckbox: React.FC<TooltipCheckboxProps> = ({ tooltipTitle, ...restProps }) => (
  <Tooltip title={tooltipTitle}>
    <Checkbox {...restProps} />
  </Tooltip>
);


export function useSubscriptionColumns({
  form, messageConfigs, checkAllDisabled, noticeTypeAllChecked, setNoticeTypeAllChecked, setHasChange, lang,
}: Props) {

  const { data: noticeTypesData } = useQuery(listNoticeTypes);
  const [columns, setColumns] = useState<TableColumnsType<MessageConfig>>([]);
  const compLang = lang.subscription.useSubscriptionColumns;

  const { scowLangId } = useContext(ScowParamsContext);

  const handleCheckChange = ({ e, checkedNoticeType }: SelectAllProps) => {
    if (!messageConfigs) return;

    const values = form.getFieldsValue();
    setHasChange(true);
    const defaultCheckValue = e.target.checked;

    for (const messageType of Object.keys(values.noticeConfigs)) {
      const noticeConfig = Object.keys(values.noticeConfigs[messageType]).find((noticeType) => {
        const enumNoticeType = Number(noticeType) as unknown as NoticeType;
        return enumNoticeType === checkedNoticeType;
      });
      const canUserModify = messageConfigs.find((config) =>
        config.messageType === messageType && !!config.noticeConfigs.find((noticeConfig) =>
          noticeConfig.noticeType === checkedNoticeType && noticeConfig.canUserModify));

      if (noticeConfig && canUserModify && values.noticeConfigs[messageType][noticeConfig] !== defaultCheckValue) {
        setNoticeTypeAllChecked({
          ...noticeTypeAllChecked,
          [checkedNoticeType]: false,
        });
        return;
      }
    };
    setNoticeTypeAllChecked({
      ...noticeTypeAllChecked,
      [checkedNoticeType]: defaultCheckValue,
    });
  };


  const handleCheckAll = ({ e, checkedNoticeType }: SelectAllProps) => {
    if (!messageConfigs) return;

    const values = form.getFieldsValue();
    setHasChange(true);

    setNoticeTypeAllChecked({
      ...noticeTypeAllChecked,
      [checkedNoticeType]: e.target.checked,
    });

    const parsedValues = {
      noticeConfigs: Object.keys(values.noticeConfigs).reduce((acc, messageType) => {
        const noticeConfigs = Object.keys(values.noticeConfigs[messageType]).reduce((innerAcc, noticeType) => {
          const enumNoticeType = Number(noticeType) as unknown as NoticeType;
          const canUserModify = messageConfigs.find((config) =>
            config.messageType === messageType && !!config.noticeConfigs.find((noticeConfig) =>
              noticeConfig.noticeType === checkedNoticeType && noticeConfig.canUserModify));

          return {
            ...innerAcc,
            [enumNoticeType]: checkedNoticeType === enumNoticeType && canUserModify
              ? e.target.checked
              : values.noticeConfigs[messageType][noticeType],
          };
        }, {} as Partial<Record<NoticeType, boolean>>);

        return {
          ...acc,
          [messageType]: noticeConfigs,
        };
      }, {} as Record<string, Partial<Record<NoticeType, boolean>>>),
    };

    form.setFieldsValue(parsedValues);
  };

  useEffect(() => {
    if (!noticeTypesData) return;

    const columns: TableColumnsType<MessageConfig> = [
      {
        title: lang.common.serialNumber,
        dataIndex: "index",
        key: "index",
        fixed: "left",
        width: 100,
        render: (_, record, index) => index + 1,
      },
      {
        title: compLang.messageType,
        dataIndex: "messageType",
        key: "messageType",
        width: 150,
        fixed: "left",
        render: (_, record) => {
          const template = record.titleTemplate;
          return template?.[scowLangId] || template?.default;
        },
      },
      {
        title: compLang.category,
        dataIndex: "category",
        key: "category",
        render: (_, record) => {
          const template = record.categoryTemplate;
          return template?.[scowLangId] || template?.default;
        },
      },
      {
        title: compLang.noticeType,
        children: noticeTypesData?.noticeTypes.map((type) => ({
          title: (
            <CheckAllSpecifiedNoticeType
              disabled={checkAllDisabled[type] ?? true}
              checked={noticeTypeAllChecked[type] ?? false}
              type={type}
              handleCheckAll={handleCheckAll}
            />
          ),
          dataIndex: type,
          key: type,
          render: (_, record) => {
            const noticeTypeConfig = record.noticeConfigs.find((config) => config.noticeType === type);
            const checkboxDisabled = !noticeTypeConfig?.canUserModify;
            const checked = noticeTypeConfig?.enabled;

            const title = checkboxDisabled ?
              (checked ? compLang.unableToCancelPrompt : compLang.unableToOpenPrompt) : "";

            return (
              <Form.Item
                name={["noticeConfigs", record.messageType, type]}
                valuePropName="checked"
                noStyle
              >
                <TooltipCheckbox
                  tooltipTitle={title}
                  disabled={checkboxDisabled}
                  onChange={(e) => handleCheckChange({ e, checkedNoticeType: type })}
                />
              </Form.Item>
            );
          },
        })),
      },
    ];

    setColumns(columns);
  }, [noticeTypesData, checkAllDisabled, ...Object.values(noticeTypeAllChecked)]);

  return columns;
}
