import { Descriptions, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { Head } from "src/components/head";
import { UserInfo } from "src/models/User";
import { PlatformRole, TenantRole } from "src/models/User";
import { antdBreakpoints } from "src/styles/constants";
import { formatDateTime } from "src/utils/datetime";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";
import { styled } from "styled-components";

import { ChangeEmailModal } from "./ChangeEmailModal";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ModalButton } from "./ModalLink";
import { Section } from "./Section";

export interface mutationType {
  useMutation: ({ onSuccess, onError }) => {
    mutate: (input) => void
  }
}

interface Props {
  user: UserInfo | undefined;
  languageId: string;
  publicConfig;
  api?;
  passwordPatternMessage?: string;
  aiChangePassword?: mutationType;
  aiChangeEmail?: mutationType;
}

const Container = styled.div`
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;
`;

const Part = styled(Section)`
  min-width: 400px;
  max-width: 600px;
  flex: 1;
  margin: 0 8px 16px 0;
  @media (min-width: ${antdBreakpoints.md}px) {
    margin: 0 16px 32px 0;
  }
`;

const TitleText = styled(Typography.Title)`
&& {
  font-size: 24px !important;
  padding: 0 0 10px 20px !important;
  margin-left: -25px;
  border-bottom: 1px solid #ccc;
  @media (min-width: ${antdBreakpoints.md}px) {
    padding: 0 0 20px 30px;
  }
}
`;

const ChangePasswordModalButton = ModalButton(ChangePasswordModal, { type: "link" });
const ChangeEmailModalButton = ModalButton(ChangeEmailModal, { type: "link" });

export const Profile: React.FC<Props> = ({
  user, languageId, publicConfig, api, passwordPatternMessage,
  aiChangePassword, aiChangeEmail,
}) => {

  const [email, setEmail] = useState(user?.email);

  useEffect(() => {
    setEmail(user?.email);
  }, [user]);

  const PlatformRoleI18nTexts = {
    [PlatformRole.PLATFORM_FINANCE]: getCurrentLangLibWebText(languageId, "platformFinance"),
    [PlatformRole.PLATFORM_ADMIN]: getCurrentLangLibWebText(languageId, "platformAdmin"),
  };
  const TenantRoleI18nTexts = {
    [TenantRole.TENANT_FINANCE]: getCurrentLangLibWebText(languageId, "tenantFinance"),
    [TenantRole.TENANT_ADMIN]: getCurrentLangLibWebText(languageId, "tenantAdmin"),
  };

  return (
    <>
      <Container>
        <Head title={getCurrentLangLibWebText(languageId, "userInfo") || ""} />
        <TitleText>{getCurrentLangLibWebText(languageId, "userInfo")}</TitleText>
        <Part title>
          <Descriptions
            column={1}
            labelStyle={{ paddingLeft:"10px", marginBottom:"10px", width: "100px" }}
            contentStyle={{ paddingLeft:"10px" }}
          >
            <Descriptions.Item label={getCurrentLangLibWebText(languageId, "userId")}>
              {user?.identityId}
            </Descriptions.Item>
            <Descriptions.Item label={getCurrentLangLibWebText(languageId, "userFullName")}>
              {user?.name}
            </Descriptions.Item>
            {
              user?.tenantRoles?.length && user.tenantRoles.length > 0 ? (
                <Descriptions.Item label={getCurrentLangLibWebText(languageId, "tenantRole")}>
                  {user?.tenantRoles.map((x) => (
                    <Tag
                      key={x}
                    >{TenantRoleI18nTexts[x]}</Tag>
                  ))}
                </Descriptions.Item>
              ) : undefined
            }
            {
              user?.platformRoles?.length && user.platformRoles.length > 0 ? (
                <Descriptions.Item label={getCurrentLangLibWebText(languageId, "platformRole")}>
                  {user?.platformRoles.map((x) => (
                    <Tag
                      key={x}
                    >{PlatformRoleI18nTexts[x]}</Tag>
                  ))}
                </Descriptions.Item>
              ) : undefined
            }
            <Descriptions.Item label={getCurrentLangLibWebText(languageId, "phone")}>
              {user?.phone ? user.phone : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={getCurrentLangLibWebText(languageId, "organization")}>
              {user?.organization ? user.organization : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={getCurrentLangLibWebText(languageId, "createTime")}>
              {user?.createTime ? formatDateTime(user?.createTime) : ""}
            </Descriptions.Item>
            <Descriptions.Item label={getCurrentLangLibWebText(languageId, "email")}>
              <span style={{ width:"202px" }}>{email ? email : "-"}</span>
              {/* setEmail用于profile页面展示的邮箱同步修改后的邮箱 */}
              <ChangeEmailModalButton
                setEmail={setEmail}
                languageId={languageId}
                userId={user?.identityId || ""}
                email={email}
                api={api}
                aiChangeEmail={aiChangeEmail}
              >
                {getCurrentLangLibWebText(languageId, "changeEmail")}
              </ChangeEmailModalButton>
            </Descriptions.Item>
          </Descriptions>
        </Part>
        {
          publicConfig.ENABLE_CHANGE_PASSWORD ? (
            <>
              <TitleText>{getCurrentLangLibWebText(languageId, "accountSecurity")}</TitleText>
              <Part title>
                <Descriptions
                  column={1}
                  labelStyle={{ paddingLeft:"10px", paddingTop:"5px", width: "100px" }}
                  contentStyle={{ paddingLeft:"10px" }}
                >
                  <Descriptions.Item label={getCurrentLangLibWebText(languageId, "loginPassword")}>
                    <span style={{ width:"200px" }}>********</span>
                    <ChangePasswordModalButton
                      publicConfig={publicConfig}
                      languageId={languageId}
                      userId={user?.identityId || ""}
                      api={api}
                      passwordPatternMessage={passwordPatternMessage}
                      aiChangePassword={aiChangePassword}
                    >
                      {getCurrentLangLibWebText(languageId, "changePassword")}
                    </ChangePasswordModalButton>
                  </Descriptions.Item>
                </Descriptions>
              </Part>
            </>
          ) : undefined
        }
      </Container>
    </>

  );
};

export default Profile;
