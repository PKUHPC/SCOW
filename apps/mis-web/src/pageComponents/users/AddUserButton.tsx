/**
 * AddUserButton 组件用于在账户下添加新用户，当用户不存在时根据配置决定是否允许创建新用户。
 * 它包含一个按钮，点击按钮后会弹出模态框，用户可以通过表单输入用户 ID 和全名。
 * 用户可以在模态框中提交表单，系统会根据后端返回的结果显示相应的提示信息。
 * 如果用户不存在且允许创建，系统会自动引导用户创建新用户。
 */

import { PlusOutlined } from "@ant-design/icons";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Button, Form, Modal } from "antd";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { CountdownText } from "src/components/CountdownText";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { CreateUserModal } from "src/pageComponents/users/CreateUserModal";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { addUserToAccountParams, getUserIdRule, useBuiltinCreateUser } from "src/utils/createUser";

/**
 * FormProps 定义表单中的字段，identityId 代表用户 ID，name 代表用户全名。
 */
interface FormProps {
  identityId: string;
  name: string;
}

interface ModalProps {
  accountName: string;
  open: boolean;
  close: () => void;
  refresh: () => void;
  onAddUser: (identityId: string, name: string) => Promise<void>;
}
// 定义国际化翻译的前缀
const p = prefix("pageComp.user.addUserButton.");
const pCommon = prefix("common.");
/**
 * NewUserModal 组件负责显示用于添加新用户的模态框。
 * 它包含一个表单，用户需要填写用户 ID 和全名。
 * @param open 模态框是否显示
 * @param close 关闭模态框的函数
 * @param onAddUser 添加用户时的回调函数
 */
const NewUserModal: React.FC<ModalProps> = ({ open, close, onAddUser: onAddingUser }) => {
  // t 用于获取翻译文本
  const t = useI18nTranslateToString();

  // loading 表示模态框的加载状态
  const [loading, setLoading] = useState(false);

  // 使用 Ant Design 的 Form 组件进行表单管理
  const [form] = Form.useForm<FormProps>();

  // 获取当前语言 ID，用于根据不同语言返回 ID 规则
  const languageId = useI18n().currentLanguage.id;
  const userIdRule = getUserIdRule(languageId);

  return (
    <Modal
      title={t(p("addUser"))}
      open={open}
      onCancel={close}
      onOk={async () => {
        const { identityId, name } = await form.validateFields();
        setLoading(true);
        onAddingUser(identityId, name.trim()).finally(() => setLoading(false));
      }}
      confirmLoading={loading}
    >
      <Form form={form}>
        <Form.Item
          name="identityId"
          label={t(pCommon("userId"))}
          rules={[{ required: true }, ...(userIdRule ? [userIdRule] : [])]}
        >
          <Input placeholder={userIdRule?.message} />
        </Form.Item>
        <Form.Item name="name" rules={[{ required: true }]} label={t(pCommon("userFullName"))}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
/**
 * Props 定义 AddUserButton 组件的属性：
 * - accountName: 当前操作的账户名称。
 * - refresh: 刷新页面的回调函数。
 * - token: 用户身份验证的 token。
 * - canCreateUserIfNotExist: 当用户不存在时是否允许创建新用户（默认为 true）。
 */
interface Props {
  accountName: string;
  refresh: () => void;
  token: string;
  disabled?: boolean;
  // 添加用户不存在时是否可以创建用户
  canCreateUserIfNotExist?: boolean;
}

export const AddUserButton: React.FC<Props> = ({
  refresh,
  accountName,
  token,
  disabled,
  canCreateUserIfNotExist = true,
}) => {
  const t = useI18nTranslateToString();

  const { message } = App.useApp();

  const [modalShow, setModalShow] = useState(false);

  const [newUserInfo, setNewUserInfo] = useState<{ identityId: string; name: string } | undefined>(undefined);
  const userStore = useStore(UserStore);

  // 查找当前 accountName 对应的 accountAffiliation
  const currentAffiliation = userStore.user?.accountAffiliations.find(
    (affiliation) => affiliation.accountName === accountName,
  );
  // 检查用户是否欠费
  const [isBelowBlockThreshold, setIsBelowBlockThreshold] = useState<boolean | undefined>(undefined);

  // 是否是租户管理员
  const isTenantAdmin = userStore.user?.tenantRoles.includes(TenantRole.TENANT_ADMIN);

  useEffect(() => {
    const checkAccountStatus = async () => {
      try {
        const result = await api.accountThreshold({
          query: { accountName: currentAffiliation?.accountName ?? "" },
        });
        setIsBelowBlockThreshold(result.isBelowBlockThreshold);
      } catch {
        message.error(t(p("arrearsAccount")));
      }
    };

    if (currentAffiliation?.accountName) {
      checkAccountStatus();
    }
  }, [currentAffiliation, t]);

  // 检查当前账户的角色和状态是否满足禁用按钮的条件
  const isButtonDisabled = () => {
    const router = useRouter();
    const { pathname } = router;

    // 判断是否为租户界面
    const isTenantPage = pathname.includes("tenant");

    // 如果是 tenant 页面且用户为管理员，则不禁用按钮
    if (isTenantPage && isTenantAdmin) {
      return false;
    }

    // 否则按照原有逻辑禁用按钮
    return (
      (currentAffiliation && (currentAffiliation.accountState === 2 || currentAffiliation.accountState === 3)) ||
      isBelowBlockThreshold
    );
  };

  /**
   * onAddUser 函数处理添加用户的逻辑。
   * 它调用后端 API，并根据返回结果显示相应的提示信息。
   * @param identityId 用户 ID
   * @param name 用户全名
   */
  const onAddUser = async (identityId: string, name: string) => {
    await api
      .addUserToAccount({ body: { identityId, name, accountName } })
      .httpError(400, ({ code }) => {
        if (code === "ID_NAME_NOT_MATCH") {
          message.error(t(p("notMatch")));
        }
      })
      .httpError(404, ({ code }) => {
        if (code === "USER_ALREADY_EXIST_IN_OTHER_TENANT") {
          message.error(`${t(pCommon("user"))} ${name} ${t(p("alreadyBelonged"))}`);
        } else if (code === "ACCOUNT_OR_TENANT_NOT_FOUND") {
          message.error(t(p("notExist")));
        } else if (code === "USER_NOT_FOUND") {
          if (!canCreateUserIfNotExist) {
            message.error(t(p("createFirst")));
          } else if (useBuiltinCreateUser()) {
            setModalShow(false);
            setNewUserInfo({ identityId, name });
          } else if (publicConfig.CREATE_USER_CONFIG.misConfig.type === "external") {
            const TIMEOUT_SECONDS = 2;

            message.info(
              <>
                {t(p("will"))}
                <CountdownText seconds={TIMEOUT_SECONDS} />
                {t(p("createModal"))}
              </>,
              TIMEOUT_SECONDS,
              () => {
                window.open(
                  publicConfig.CREATE_USER_CONFIG.misConfig.external!.url +
                    "?" +
                    addUserToAccountParams(accountName, identityId, name, token),
                  "_blank",
                );
                setModalShow(false);
              },
            );
          } else {
            message.error(t(p("createFirst")));
          }
        }
      })
      .httpError(409, (e) => {
        if (e.code === "SYNC_ACCOUNT_USER_IS_RUNNING") {
          message.error(t("common.accountUserSyncRunning"));
        } else {
          message.error(e.message);
        }
      })
      .httpError(410, ({ code }) => {
        if (code === "USER_DELETED") {
          message.error(t(p("userDeleted")));
        } else if (code === "ACCOUNT_BLOCKED_BY_ADMIN") {
          message.error(t(p("blockAccount")));
        } else {
          message.error(code);
        }
      })
      .then(() => {
        message.success(t(p("addSuccess")));
        refresh();
        setModalShow(false);
        setNewUserInfo(undefined);
      });
  };

  return (
    <>
      <NewUserModal
        close={() => setModalShow(false)}
        open={modalShow}
        refresh={refresh}
        accountName={accountName}
        onAddUser={onAddUser}
      />
      <CreateUserModal
        accountName={accountName}
        open={!!newUserInfo}
        newUserInfo={newUserInfo}
        onCreated={({ identityId, name }) => {
          return onAddUser(identityId, name.trim());
        }}
        onClose={() => {
          setNewUserInfo(undefined);
        }}
      />
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setModalShow(true)}
        disabled={disabled || isButtonDisabled()}
      >
        {t(p("addUser"))}
      </Button>
    </>
  );
};
