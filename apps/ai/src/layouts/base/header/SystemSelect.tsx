"use client";
import { DownOutlined } from "@ant-design/icons";
import { AiIcon, HighComputingIcon, MisIcon, QuantumIcon } from "@scow/lib-web/build/layouts/base/header/icons";
import { UserInfo } from "@scow/lib-web/build/layouts/base/types";
import { Dropdown, theme } from "antd";
import React from "react";
import { useI18nTranslateToString } from "src/i18n";
import { JumpToAnotherLink } from "src/layouts/base/header/Components";
import { styled } from "styled-components";

const { useToken } = theme;

interface Props {
  user: UserInfo | undefined;
  publicConfig: any;
}

const Container = styled.div`
  white-space: nowrap;
  .ant-dropdown-open {
    color: ${({ theme }) => theme.token.colorPrimary} !important;
  }
`;

const InlineBlockSpan = styled.span`
  cursor: pointer;
  line-height: 36px;
  display: inline-flex;
  margin-right: 4px;
  gap: 8px;
  font-size: 14px;
  padding: 0 12px;
  &:hover {
    background-color: #59595914;
    border-radius: 8px;
  }
  &:active {
    background-color: #59595914;
    border-radius: 8px;
  }
`;

export const SystemSelect: React.FC<Props> = ({ user, publicConfig }) => {
  const t = useI18nTranslateToString();
  const { token } = useToken();

  return (
    <Container>
      <Dropdown
        trigger={["click"]}
        overlayClassName="head-system-select"
        menu={{
          items: [
            ...(publicConfig.MIS_URL
              ? [
                  {
                    key: "mis",
                    label: (
                      <JumpToAnotherLink
                        user={user}
                        icon={<MisIcon style={{ paddingRight: 2 }} />}
                        link={publicConfig.MIS_URL}
                        linkText={<span>{t("baseLayout.linkTextMis")}</span>}
                      />
                    ),
                  },
                ]
              : []),
            ...(publicConfig.PORTAL_URL
              ? [
                  {
                    key: "portal",
                    label: (
                      <JumpToAnotherLink
                        user={user}
                        icon={<HighComputingIcon style={{ paddingRight: 2 }} />}
                        link={publicConfig.PORTAL_URL}
                        linkText={<span>{t("baseLayout.linkTextHpc")}</span>}
                      />
                    ),
                  },
                ]
              : []),
            {
              key: "ai",
              label: (
                <JumpToAnotherLink
                  user={user}
                  icon={<AiIcon style={{ paddingRight: 2, color: token.colorPrimary }} />}
                  link=""
                  linkText={<span style={{ color: token.colorPrimary }}>{t("baseLayout.linkTextAi")}</span>}
                />
              ),
            },
            ...(publicConfig.QUANTUM_URL
              ? [
                  {
                    key: "quantum",
                    label: (
                      <JumpToAnotherLink
                        user={user}
                        icon={<QuantumIcon style={{ paddingRight: 2 }} />}
                        link={publicConfig.QUANTUM_URL}
                        linkText={<span>{t("baseLayout.linkTextQuantum")}</span>}
                      />
                    ),
                  },
                ]
              : []),
          ],
        }}
      >
        <InlineBlockSpan>
          <AiIcon style={{ color: token.colorPrimary }} />
          <span>{t("baseLayout.linkTextAi")}</span>
          <DownOutlined style={{ marginLeft: "4px" }} />
        </InlineBlockSpan>
      </Dropdown>
    </Container>
  );
};
