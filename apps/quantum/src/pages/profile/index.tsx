"use client";
import { Descriptions, Typography } from "antd";
import { ModalButton } from "src/components/ModalLink";
import { Section } from "src/components/Section";
import { usePublicConfig } from "src/context/PublicConfigContext";
import { Localized, prefix, useI18nTranslateToString } from "src/i18n";
import { ChangePasswordModal } from "src/pageComponents/profile/ChangePasswordModal";
import { antdBreakpoints } from "src/styles/constants";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

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
  width: 100vw;
  font-weight: 700;
  font-size: 24px;
  padding: 0 0 10px 20px;
  margin-left: -25px;
  border-bottom: 1px solid #ccc;
  @media (min-width: ${antdBreakpoints.md}px) {
    padding: 0 0 20px 30px;
  }
}
`;

const ChangePasswordModalButton = ModalButton(ChangePasswordModal, { type: "link" });

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("page.profile.");

  const publicConfig = usePublicConfig();

  return (
    <Container>
      <Head title={t(p("title"))} />
      <TitleText>
        <Localized id="page.profile.userInfo"></Localized>
      </TitleText>
      <Part title>
        <Descriptions
          column={1}
          labelStyle={{ paddingLeft:"10px", marginBottom:"10px" }}
          contentStyle={{ paddingLeft:"10px" }}
        >
          <Descriptions.Item label={t(p("identityId"))}>
            {publicConfig.user.identityId}
          </Descriptions.Item>
          <Descriptions.Item label={t(p("name"))}>
            {publicConfig.user.name}
          </Descriptions.Item>
        </Descriptions>
      </Part>
      {
        publicConfig.publicConfig.ENABLE_CHANGE_PASSWORD ? (
          <>
            <TitleText>
              <Localized id="page.profile.changePassword"></Localized>
            </TitleText>
            <Part title>
              <Descriptions
                column={1}
                labelStyle={{ paddingLeft:"10px", paddingTop:"5px" }}
                contentStyle={{ paddingLeft:"10px" }}
              >
                <Descriptions.Item label={t(p("loginPassword"))}>
                  <span style={{ width:"200px" }}>********</span>
                  <ChangePasswordModalButton identityId={publicConfig.user.identityId}>
                    <Localized id="page.profile.changePassword"></Localized>
                  </ChangePasswordModalButton>
                </Descriptions.Item>
              </Descriptions>
            </Part>
          </>
        ) : undefined
      }
    </Container>
  );
}
