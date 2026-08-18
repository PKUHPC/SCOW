import type { LocalizedConfigText } from "src/features/profile/types";

import { Button, Descriptions, Result, Spin, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMetadataQuery } from "src/api/metadata";
import { ChangeEmailModal } from "src/features/profile/components/ChangeEmailModal";
import { ChangePasswordModal } from "src/features/profile/components/ChangePasswordModal";
import { useProfileQuery } from "src/features/profile/queries";
import { styled } from "styled-components";

const Container = styled.div`
  min-height: 100%;
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;
  padding: 24px 32px;
  background: ${({ theme }) => theme.token.colorBgContainer};

  @media (max-width: 576px) {
    padding: 20px 24px;
  }
`;

const Part = styled.div`
  width: min(600px, 100%);
  flex: 1;
  margin: 0 8px 16px 0;

  @media (min-width: 768px) {
    margin: 0 16px 32px 0;
  }
`;

const ProfileDescriptions = styled(Descriptions)`
  .ant-descriptions-item-container {
    align-items: center;
  }
`;

const descriptionLabelStyle = {
  width: "100px",
  minWidth: "100px",
  paddingLeft: "10px",
  textAlign: "left" as const,
  alignItems: "center",
};

const descriptionContentStyle = {
  paddingLeft: "10px",
  textAlign: "left" as const,
  alignItems: "center",
};

const ValueWithAction = styled.div`
  display: grid;
  grid-template-columns: 202px auto;
  align-items: center;
  justify-content: start;

  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 576px) {
    grid-template-columns: minmax(100px, 1fr) auto;
  }
`;

const TitleText = styled(Typography.Title)`
  && {
    font-size: 24px !important;
    padding: 0 0 10px 20px !important;
    margin-left: -25px;
    border-bottom: 1px solid #ccc;

    @media (min-width: 768px) {
      padding: 0 0 20px 30px;
    }
  }
`;

const resolveConfigText = (text: string | LocalizedConfigText | undefined, language: string) => {
  if (!text || typeof text === "string") return text;
  return text.i18n[language as keyof typeof text.i18n] ?? text.i18n.default;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  const part = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
};

export function ProfilePage() {
  const { i18n, t } = useTranslation("profile");
  const metadataQuery = useMetadataQuery();
  const misEnabled = Boolean(metadataQuery.data?.components.mis);
  const profileQuery = useProfileQuery(misEnabled);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const data = profileQuery.data;
  const user = data?.user;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${t("title", "账号信息")} - SCOW`;
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  if (metadataQuery.isLoading) {
    return (
      <Container>
        <Spin />
      </Container>
    );
  }

  if (!misEnabled) {
    return (
      <Container>
        <Result status="404" title={t("misUnavailable", "管理系统未启用，无法加载个人信息")} />
      </Container>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <Container>
        <Spin />
      </Container>
    );
  }
  if (profileQuery.isError || !user) {
    return (
      <Container>
        <Result status="error" title={t("loadFailed", "个人信息加载失败")} />
      </Container>
    );
  }

  const tenantRoleTexts: Record<number, string> = {
    0: t("roles.tenantAdmin", "租户管理员"),
    1: t("roles.tenantFinance", "财务人员"),
  };
  const platformRoleTexts: Record<number, string> = {
    0: t("roles.platformAdmin", "平台管理员"),
    1: t("roles.platformFinance", "平台财务人员"),
  };
  const passwordPatternMessage = resolveConfigText(data.passwordPatternMessage, i18n.language);

  return (
    <Container>
      <TitleText>{t("userInfo", "用户信息")}</TitleText>
      <Part>
        <ProfileDescriptions
          column={1}
          labelStyle={descriptionLabelStyle}
          contentStyle={descriptionContentStyle}
        >
          <Descriptions.Item label={t("userId", "用户ID")}>{user.identityId}</Descriptions.Item>
          <Descriptions.Item label={t("userFullName", "用户姓名")}>{user.name}</Descriptions.Item>
          {user.tenantRoles?.length ? (
            <Descriptions.Item label={t("tenantRole", "租户角色")}>
              {user.tenantRoles.map((role) => (
                <Tag key={role}>{tenantRoleTexts[role] ?? role}</Tag>
              ))}
            </Descriptions.Item>
          ) : null}
          {user.platformRoles?.length ? (
            <Descriptions.Item label={t("platformRole", "平台角色")}>
              {user.platformRoles.map((role) => (
                <Tag key={role}>{platformRoleTexts[role] ?? role}</Tag>
              ))}
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label={t("phone", "手机号")}>{user.phone || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("organization", "组织")}>{user.organization || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("createTime", "创建时间")}>
            {user.createTime ? formatDateTime(user.createTime) : ""}
          </Descriptions.Item>
          <Descriptions.Item label={t("email.label", "邮箱")}>
            <ValueWithAction>
              <span>{user.email || "-"}</span>
              <Button type="link" onClick={() => setEmailModalOpen(true)}>
                {t("email.change", "修改邮箱")}
              </Button>
            </ValueWithAction>
          </Descriptions.Item>
        </ProfileDescriptions>
      </Part>
      {data.enableChangePassword ? (
        <>
          <TitleText>{t("accountSecurity", "账号安全")}</TitleText>
          <Part>
            <ProfileDescriptions
              column={1}
              labelStyle={descriptionLabelStyle}
              contentStyle={descriptionContentStyle}
            >
              <Descriptions.Item label={t("password.login", "登录密码")}>
                <ValueWithAction>
                  {/* i18next-instrument-ignore */}
                  <span>********</span>
                  <Button type="link" onClick={() => setPasswordModalOpen(true)}>
                    {t("password.change", "修改密码")}
                  </Button>
                </ValueWithAction>
              </Descriptions.Item>
            </ProfileDescriptions>
          </Part>
        </>
      ) : null}
      <ChangeEmailModal email={user.email} open={emailModalOpen} onClose={() => setEmailModalOpen(false)} />
      <ChangePasswordModal
        open={passwordModalOpen}
        passwordPattern={data.passwordPattern}
        passwordPatternMessage={passwordPatternMessage}
        onClose={() => setPasswordModalOpen(false)}
      />
    </Container>
  );
}
