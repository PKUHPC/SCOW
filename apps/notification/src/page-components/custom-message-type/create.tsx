import { QuestionCircleOutlined } from "@ant-design/icons";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { Form, Tooltip } from "antd";
import TextArea from "antd/es/input/TextArea";
import React, { useState } from "react";
import { ModalButton } from "src/components/modal-button";
import { I18nDicType } from "src/models/i18n";
import { MessageTypeInfo, Template } from "src/models/message-type";
import { validateChinese, validateEnglish } from "src/utils/validate-language";

import { PreviewCreateModal } from "./preview-create-modal";
import { SubTitle } from "./sub-title";

export interface FormValues {
  messageType: string;
  messageTitleTemp: Template;
  messageCategory: string;
  messageCategoryTemp: Template;
  messageContentTemp: Template;
}

interface Props {
  lang: I18nDicType;
}

export const CreateMessageTypeForm: React.FC<Props> = ({ lang }) => {

  const [createData, setCreateData] = useState<MessageTypeInfo>();
  const [form] = Form.useForm<FormValues>();

  const compLang = lang.createCustomMessageType.create;

  const onFinish = (values: FormValues) => {
    const result = {
      type: values.messageType,
      titleTemplate: {
        default: values.messageTitleTemp.default,
        en: values.messageTitleTemp.en,
        zh_cn: values.messageTitleTemp.zhCn,
      },
      category: values.messageCategory,
      categoryTemplate: {
        default: values.messageCategoryTemp.default,
        en: values.messageCategoryTemp.en,
        zhCn: values.messageCategoryTemp.zhCn,
      },
      contentTemplate: {
        default: values.messageContentTemp.default,
        en: values.messageContentTemp.en,
        zhCn: values.messageContentTemp.zhCn,
      },
    };

    setCreateData(result);
  };

  return (
    <Form
      form={form}
      onFinish={onFinish}
      labelCol={{ span: 2 }}
    >

      <Form.Item
        name="messageType"
        label={compLang.messageType}
        rules={[
          { required: true, message: compLang.messageTypePlaceholder },
          { validator: (rule, value) => validateEnglish(rule, value, true) },
        ]}
      >
        <Input style={{ maxWidth: "700px" }} placeholder={compLang.messageTypePlaceholder} />
      </Form.Item>

      <Form.Item
        name="messageCategory"
        label={compLang.messageCategory}
        rules={[
          { required: true, message: compLang.messageCategoryPlaceholder },
          { validator: (rule, value) => validateEnglish(rule, value) },
        ]}
      >
        <Input style={{ maxWidth: "700px" }} placeholder={compLang.messageCategoryPlaceholder} />
      </Form.Item>

      <SubTitle title={compLang.messageTitle}>
        <Tooltip title={compLang.messageTitleTip}>
          <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
        </Tooltip>
      </SubTitle>

      <Form.List name="messageTitleTemp">
        {() => (
          <>
            <Form.Item
              name={"default"}
              label={lang.common.default}
              rules={[{ required: true, message: compLang.defaultMessageTitleRule }]}
            >
              <div style={{ display: "flex" }}>
                <Input style={{ maxWidth: "700px" }} placeholder={compLang.defaultMessageTitlePlaceholder} />
                <Tooltip title={compLang.defaultMessageTitleTip}>
                  <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                </Tooltip>
              </div>
            </Form.Item>
            <Form.Item
              name={"zhCn"}
              label={lang.common.zhCn}
              rules={[
                { message: compLang.zhCnMessageTitleRule },
                { validator: (rule, value) => validateChinese(rule, value, true) },
              ]}
            >
              <Input style={{ maxWidth: "700px" }} />
            </Form.Item>
            <Form.Item
              name={"en"}
              label={lang.common.en}
              rules={[
                { message: compLang.enMessageTitleRule },
                { validator: (rule, value) => validateEnglish(rule, value, true) },
              ]}
            >
              <Input style={{ maxWidth: "700px" }} />
            </Form.Item>
          </>
        )}
      </Form.List>

      <SubTitle title={compLang.messageCategory}>
        <Tooltip title={compLang.messageCategoryTip}>
          <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
        </Tooltip>
      </SubTitle>

      <Form.List name="messageCategoryTemp">
        {() => (
          <>
            <Form.Item
              name={"default"}
              label={lang.common.default}
              rules={[{ required: true, message: compLang.defaultMessageCategoryRule }]}
            >
              <div style={{ display: "flex" }}>
                <Input style={{ maxWidth: "700px" }} placeholder={compLang.defaultMessageCategoryPlaceholder} />
                <Tooltip title={compLang.defaultMessageCategoryTip}>
                  <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                </Tooltip>
              </div>
            </Form.Item>
            <Form.Item
              name={"zhCn"}
              label={lang.common.zhCn}
              rules={[
                { message: compLang.zhCnMessageCategoryRule },
                { validator: (rule, value) => validateChinese(rule, value, true) },
              ]}
            >
              <Input style={{ maxWidth: "700px" }} />
            </Form.Item>
            <Form.Item
              name={"en"}
              label={lang.common.en}
              rules={[
                { message: compLang.enMessageCategoryRule },
                { validator: (rule, value) => validateEnglish(rule, value, true) },
              ]}
            >
              <Input style={{ maxWidth: "700px" }} />
            </Form.Item>
          </>
        )}
      </Form.List>

      <SubTitle title={compLang.messageContentTemp}>
        <Tooltip title={compLang.messageContentTempTip}>
          <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
        </Tooltip>
      </SubTitle>

      <Form.List name="messageContentTemp">
        {() => (
          <>
            <Form.Item
              name={"default"}
              label={lang.common.default}
              rules={[{ required: true, message: compLang.defaultMessageContentTempRule }]}
            >
              <div style={{ display: "flex" }}>
                <TextArea
                  style={{ maxWidth: "700px" }}
                  placeholder={compLang.defaultMessageContentTempPlaceholder}
                />
                <Tooltip title={compLang.defaultMessageContentTempTip}>
                  <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                </Tooltip>
              </div>
            </Form.Item>
            <Form.Item
              name={"zhCn"}
              label={lang.common.zhCn}
              rules={[
                { message: compLang.zhCnMessageContentTempRule },
                { validator: (rule, value) => validateChinese(rule, value, true) },
              ]}
            >
              <TextArea style={{ maxWidth: "700px" }} />
            </Form.Item>
            <Form.Item
              name={"en"}
              label={lang.common.en}
              rules={[
                { message: compLang.enMessageContentTempRule },
                { validator: (rule, value) => validateEnglish(rule, value, true) },
              ]}
            >
              <TextArea style={{ maxWidth: "700px" }} />
            </Form.Item>
          </>
        )}
      </Form.List>

      <Form.Item>
        <PreviewCreateModalButton data={createData} lang={lang}>
          {lang.common.submit}
        </PreviewCreateModalButton>
      </Form.Item>
    </Form>
  );
};

const PreviewCreateModalButton = ModalButton(PreviewCreateModal, {
  htmlType: "submit", type: "primary", size: "middle" });
