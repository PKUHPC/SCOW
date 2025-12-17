import { QuestionCircleOutlined } from "@ant-design/icons";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { useMutation, useQuery } from "@connectrpc/connect-query";
import { TargetType } from "@scow/notification-protos/build/common_pb";
import { adminSendMessage } from "@scow/notification-protos/build/message-MessageService_connectquery";
import { listNoticeTypes } from "@scow/notification-protos/build/notice_type-NoticeTypeService_connectquery";
import { App, Button, Checkbox, DatePicker, Form, Input, Popover } from "antd";
import dayjs, { Dayjs } from "dayjs";
import React from "react";
import { I18nDicType } from "src/models/i18n";
import { AdminMessageType } from "src/models/message-type";
import { getNoticeTypeName, NoticeType } from "src/models/notice-type";

interface FormValues {
  title: string;
  content: string;
  noticeTypes: NoticeType[];
  expirationTime: Dayjs;
}

interface Props {
  lang: I18nDicType;
  onSendSuccess: () => void;
}

export const MessageForm: React.FC<Props> = ({ lang, onSendSuccess }) => {
  const { message } = App.useApp();

  const compLang = lang.sendMessage.messageForm;
  const [form] = Form.useForm<FormValues>();
  const { data } = useQuery(listNoticeTypes);
  const { mutateAsync, isPending } = useMutation(adminSendMessage, {
    onError: () => {
      message.error(compLang.sendErrorInfo);
    },
    onSuccess: () => {
      message.success(compLang.sendSuccessInfo);
      onSendSuccess();
    },
  });

  const onFinish = async (values: FormValues) => {
    const { title, content, noticeTypes, expirationTime } = values;

    mutateAsync({
      title, content, noticeTypes,
      messageType: AdminMessageType.SystemNotification,
      targetType: TargetType.FULL_SITE,
      expiredAt: timestampFromDate(expirationTime.toDate()),
    });
  };

  const validateCheckboxGroup = (_, value) => {
    if (value && value.length > 0) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(compLang.checkboxSelectInfo));
  };

  // 获取当前时间
  const currentDateTime = dayjs();

  // 禁用当前时间之前的日期
  const disabledDate = (current: Dayjs) => {
    return current && current < dayjs().startOf("day"); // 禁选当前日期之前的日期
  };

  // 禁用当前时间之前的时、分、秒
  const disabledTime = (current: Dayjs) => {
    if (current.isBefore(currentDateTime, "minute")) {
      return {
        disabledHours: () => {
          const disabledHours: number[] = [];
          for (let i = 0; i < currentDateTime.hour(); i++) {
            disabledHours.push(i);
          }
          return disabledHours;
        },
        disabledMinutes: () => {
          const disabledMinutes: number[] = [];
          if (current.hour() === currentDateTime.hour()) {
            for (let i = 0; i < currentDateTime.minute(); i++) {
              disabledMinutes.push(i);
            }
          }
          return disabledMinutes;
        },
        disabledSeconds: () => {
          const disabledSeconds: number[] = [];
          if (current.hour() === currentDateTime.hour() && current.minute() === currentDateTime.minute()) {
            for (let i = 0; i < currentDateTime.second(); i++) {
              disabledSeconds.push(i);
            }
          }
          return disabledSeconds;
        },
      };
    }
    return {};
  };

  return (
    <Form
      form={form}
      name="messageForm"
      onFinish={onFinish}
      // labelCol={{ span: 4 }}
      // wrapperCol={{ span: 14 }}
      initialValues={{ noticeTypes: [NoticeType.SITE_MESSAGE]}}
    >
      <Form.Item
        label={lang.common.title}
        name="title"
        rules={[{
          required: true,
          message: compLang.inputTitle,
        }, {
          type: "string",
          max: 50,
          message: compLang.titleLengthTip,
        }]}
      >
        <Input style={{ maxWidth: "700px" }} />
      </Form.Item>

      <Form.Item
        label={compLang.content}
        name="content"
        rules={[{
          required: true,
          message: compLang.inputContent,
        }, {
          type: "string",
          max: 500,
          message: compLang.contentLengthTip,
        }]}
      >
        <Input.TextArea style={{ maxWidth: "700px" }} rows={4} />
      </Form.Item>

      <Form.Item
        label={compLang.sendType}
        name="noticeTypes"
        rules={[{ required: true, validator: validateCheckboxGroup, message: compLang.selectSentType }]}
      >
        <Checkbox.Group>
          {
            data?.noticeTypes.map((noticeType) => (
              <Checkbox
                key={noticeType}
                value={noticeType}
                disabled={NoticeType.SITE_MESSAGE === noticeType}
              >
                {getNoticeTypeName(noticeType)}
              </Checkbox>
            ))
          }
        </Checkbox.Group>
      </Form.Item>
      <Form.Item
        label={(
          <div>
            <span style={{ marginRight: "5px" }}>{compLang.msgExpirationTime}</span>
            <Popover content={compLang.msgExpirationTimeTip}>
              <QuestionCircleOutlined />
            </Popover>
          </div>
        )}
        name="expirationTime"
        rules={[{ required: true, message: compLang.expirationTimeSelectRule }]}
        initialValue={currentDateTime}
      >
        <DatePicker
          showTime={{
            defaultValue: currentDateTime, // 默认时分秒为00:00:00
            format: "HH:mm:ss",
          }}
          format="YYYY-MM-DD HH:mm:ss"
          disabledDate={disabledDate} // 禁选当前时间之前的日期
          disabledTime={disabledTime} // 禁选当前时间之前的时分秒
          showNow={false}
        />
      </Form.Item>
      <Form.Item style={{ marginTop: "48px" }} wrapperCol={{ span: 14 }}>
        <Button loading={isPending} type="primary" htmlType="submit">
          {compLang.sendMsg}
        </Button>
      </Form.Item>
    </Form>
  );
};
