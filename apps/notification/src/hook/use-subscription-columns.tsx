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
  checkedNoticeType: NoticeType;
}

interface Props {
  form: FormInstance<FormValues>;
  messageConfigs: MessageConfig[] | undefined;
  checkAllDisabled: Partial<Record<NoticeType, boolean>>;
  noticeTypeAllChecked: Partial<Record<NoticeType, boolean>>;
  setNoticeTypeAllChecked: Dispatch<React.SetStateAction<Partial<Record<NoticeType, boolean>>>>;
  noticeTypePartialChecked: Partial<Record<NoticeType, boolean>>;
  setNoticeTypePartialChecked: Dispatch<React.SetStateAction<Partial<Record<NoticeType, boolean>>>>;
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
  form,
  messageConfigs,
  checkAllDisabled,
  noticeTypeAllChecked,
  setNoticeTypeAllChecked,
  noticeTypePartialChecked,
  setNoticeTypePartialChecked,
  setHasChange,
  lang,
}: Props) {
  const { data: noticeTypesData } = useQuery(listNoticeTypes);
  const [columns, setColumns] = useState<TableColumnsType<MessageConfig>>([]);
  const compLang = lang.subscription.useSubscriptionColumns;

  const { scowLangId } = useContext(ScowParamsContext);

  const handleCheckChange = (checkedNoticeType: NoticeType) => {
    if (!messageConfigs) return;

    setHasChange(true);

    // form 值在 Form.Item onChange 后已更新，直接读取新值计算状态
    const values = form.getFieldsValue();
    let checkedCount = 0;
    let modifiableCount = 0;

    for (const messageType of Object.keys(values.noticeConfigs)) {
      const canUserModify = messageConfigs.find(
        (config) =>
          config.messageType === messageType &&
          config.noticeConfigs.find((nc) => nc.noticeType === checkedNoticeType && nc.canUserModify),
      );

      if (canUserModify) {
        modifiableCount++;
        if (values.noticeConfigs[messageType][checkedNoticeType]) {
          checkedCount++;
        }
      }
    }

    if (modifiableCount === 0) return;

    if (checkedCount === modifiableCount) {
      setNoticeTypeAllChecked((prev) => ({ ...prev, [checkedNoticeType]: true }));
      setNoticeTypePartialChecked((prev) => ({ ...prev, [checkedNoticeType]: false }));
    } else if (checkedCount === 0) {
      setNoticeTypeAllChecked((prev) => ({ ...prev, [checkedNoticeType]: false }));
      setNoticeTypePartialChecked((prev) => ({ ...prev, [checkedNoticeType]: false }));
    } else {
      setNoticeTypeAllChecked((prev) => ({ ...prev, [checkedNoticeType]: false }));
      setNoticeTypePartialChecked((prev) => ({ ...prev, [checkedNoticeType]: true }));
    }
  };

  const handleCheckAll = ({ e, checkedNoticeType }: SelectAllProps) => {
    if (!messageConfigs) return;

    const values = form.getFieldsValue();
    setHasChange(true);

    setNoticeTypeAllChecked((prev) => ({ ...prev, [checkedNoticeType]: e.target.checked }));
    setNoticeTypePartialChecked((prev) => ({ ...prev, [checkedNoticeType]: false }));

    const parsedValues = {
      noticeConfigs: Object.keys(values.noticeConfigs).reduce(
        (acc, messageType) => {
          const noticeConfigs = Object.keys(values.noticeConfigs[messageType]).reduce(
            (innerAcc, noticeType) => {
              const enumNoticeType = Number(noticeType) as unknown as NoticeType;
              const canUserModify = messageConfigs.find(
                (config) =>
                  config.messageType === messageType &&
                  !!config.noticeConfigs.find(
                    (noticeConfig) => noticeConfig.noticeType === checkedNoticeType && noticeConfig.canUserModify,
                  ),
              );

              return {
                ...innerAcc,
                [enumNoticeType]:
                  checkedNoticeType === enumNoticeType && canUserModify
                    ? e.target.checked
                    : values.noticeConfigs[messageType][noticeType],
              };
            },
            {} as Partial<Record<NoticeType, boolean>>,
          );

          return {
            ...acc,
            [messageType]: noticeConfigs,
          };
        },
        {} as Record<string, Partial<Record<NoticeType, boolean>>>,
      ),
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
      ...(noticeTypesData?.noticeTypes.map((type) => ({
        title: (
          <CheckAllSpecifiedNoticeType
            disabled={checkAllDisabled[type] ?? true}
            checked={noticeTypeAllChecked[type] ?? false}
            indeterminate={noticeTypePartialChecked[type] ?? false}
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

          const title = checkboxDisabled ? (checked ? compLang.unableToCancelPrompt : compLang.unableToOpenPrompt) : "";

          return (
            <Form.Item name={["noticeConfigs", record.messageType, type]} valuePropName="checked" noStyle>
              <TooltipCheckbox
                tooltipTitle={title}
                disabled={checkboxDisabled}
                onChange={() => handleCheckChange(type)}
              />
            </Form.Item>
          );
        },
      })) ?? []),
    ];

    setColumns(columns);
  }, [
    noticeTypesData,
    checkAllDisabled,
    ...Object.values(noticeTypeAllChecked),
    ...Object.values(noticeTypePartialChecked),
  ]);

  return columns;
}
