import { Alert, Button, Form, Typography } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { Centered } from "src/components/layouts";
import { FormLayout } from "src/layouts/FormLayout";
import { useMessage, useModal } from "src/layouts/prompts";
import { CreateUserForm, CreateUserFormFields } from "src/pageComponents/users/CreateUserForm";
import { publicConfig } from "src/utils/config";
import styled from "styled-components";


type FormFields = Omit<CreateUserFormFields, "confirmPassword">;

const AlertContainer = styled.div`
  margin-bottom: 16px;
`;

export const InitAdminForm: React.FC = () => {
  const [form] = Form.useForm<FormFields>();

  const message = useMessage();
  const Modal = useModal();

  const [loading, setLoading] = useState(false);
  const onFinish = async () => {
    setLoading(true);
    const { email, identityId, name, password } = await form.validateFields();

    await api.userExists({ body: { identityId } }).then((result) => {
      if (result.existsInScow) {
        // 如果在scow中已经存在这个用户，则不用创建操作
        Modal.error({
          title: "用户已存在",
          content: "用户已存在于SCOW数据库",
          onOk: async () => {
            setLoading(false);
          },
        });
      }
      else if (!result.existsInAuth && result.getUserCapability && !publicConfig.ENABLE_CREATE_USER) {
        // 用户不存在于scow: 且认证系统支持查询，且查询结果不存在于认证系统，且当前系统不支持创建用户
        Modal.confirm({
          title: "当前系统不支持创建用户",
          content: "用户不存在，请确认用户名和密码是否正确",
          onOk: async () => {
            setLoading(false);
          },
          onCancel: async () => {
            setLoading(false);
          },
        });
      }
      else {
        // 其他情况：
        // 情况1.用户不存在于scow && 认证系统支持查询 && 存在于认证系统 ->数据库创建
        // 情况2：用户不存在于scow && 认证系统支持查询 &&不存在于认证系统 && 系统支持创建用户 -> 认证系统创建用户->数据库创建
        // 情况1与2合并为：用户不存在于scow && 认证系统支持查询 &&(存在于认证系统 || (不存在于认证系统 && 系统支持创建用户))
        // 情况3.用户不存在于scow && 认证系统不支持查询->判断认证系统是否支持创建用户 ->数据库创建->尝试->认证系统创建
        // result.existsInAuth ? "此用户存在于已经认证系统，确认添加为初始管理员？" : "用户不存在，是否确认创建此用户并添加为初始管理员？",
        Modal.confirm({
          title: "提示",
          content: result.getUserCapability ?
          // 认证系统支持查询
            result.existsInAuth ? "此用户存在于已经认证系统，确认添加为初始管理员？" : "用户不存在，是否确认创建此用户并添加为初始管理员？"
            : // 认证系统不支持查询
            publicConfig.ENABLE_CREATE_USER ?
              "无法确认用户是否在认证系统中存在， 将会尝试在认证系统中创建" : "无法确认用户是否在认证系统中存在且无法在认证系统中创建，请确认用户已经在认证系统中存在",
          
          onCancel: () => {
            setLoading(false);
          },
          onOk: async () => {
            await api.createInitAdmin(
              { body: { email, identityId, name, password, existsInAuth: result.existsInAuth } })
              .then((createdResult) => {
                createdResult ? message.success("添加完成！")
                  : Modal.confirm({
                    title: "创建失败",
                    content: "请确认用户已存在于认证系统",
                    onOk: async () => {},
                    onCancel: async () => {},
                  });
                form.resetFields();
              }).finally(() => {
                setLoading(false);
              });
          },
        });
      }
    });
  };
  return (
    <Centered>
      <FormLayout maxWidth={800}>
        <Typography.Paragraph>您可以在此创建初始管理员用户。</Typography.Paragraph>
        <Typography.Paragraph>
          这里添加的用户为初始管理员，位于默认租户中，将会自动拥有<strong>平台管理员</strong>和<strong>默认租户的租户管理员</strong>角色。
        </Typography.Paragraph>
        <AlertContainer>
          <Alert
            type={publicConfig.ENABLE_CREATE_USER ? "success" : "warning"} 
            message={publicConfig.ENABLE_CREATE_USER ? "当前认证系统支持创建用户，您可以选择加入一个已存在于认证系统的用户，或者创建一个全新的用户。系统将会在认证系统中创建此用户"
              : "当前认证系统不支持创建用户，请确认要添加的用户必须已经存在于认证系统，且用户的ID必须和认证系统中的用户ID保持一致"}
            // message="请确认初始管理员用户必须已经存在于认证系统，且用户的ID必须和认证系统中的用户ID保持一致。"
          />
        </AlertContainer>
        <Form form={form} onFinish={onFinish}>
          <CreateUserForm />
          <Centered>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
              添加
              </Button>
            </Form.Item>
          </Centered>
        </Form>
      </FormLayout>
    </Centered>
  );
};
