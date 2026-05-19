"use client";
import { UserInfo } from "@scow/lib-web/build/layouts/base/types";
import { Typography } from "antd";
import { join } from "path";
import { antdBreakpoints } from "src/layouts/base/constants";
import { styled } from "styled-components";

export const HeaderItem = styled.div`
  height: 100%;
  .ant-typography {
    color: #434343 !important;
    &:hover {
      color: #595959 !important;
    }
  }

  @media (max-width: ${antdBreakpoints.md}px) {
    padding-right: 8px;
  }
`;

export const HiddenOnSmallScreenSpan = styled.span`
  margin: 0 6px;
  @media (max-width: ${antdBreakpoints.md}px) {
    display: none;
  }
`;

export const IconContainer = styled.span`
  font-size: 16px !important;
`;

const TypographyLink = styled(Typography.Link)`
  display: inline-block;
  padding: 5px 12px;
  height: 100%;
  width: 100%;
`;

interface JumpToAnotherLinkProps {
  user: UserInfo | undefined;
  icon: React.ReactNode;
  link: string | undefined;
  linkText: React.ReactNode;
}

export const JumpToAnotherLink: React.FC<JumpToAnotherLinkProps> = ({ user, link, icon, linkText }) => {
  const content = () => {
    return (
      <>
        <IconContainer>{icon}</IconContainer>
        <HiddenOnSmallScreenSpan>{linkText}</HiddenOnSmallScreenSpan>
      </>
    );
  };

  if (!link) {
    return (
      <HeaderItem>
        <TypographyLink onClick={(e) => e.preventDefault()}>{content()}</TypographyLink>
      </HeaderItem>
    );
  }

  return (
    <HeaderItem>
      {/* Cannot use Link because links adds BASE_PATH, but MIS_URL already contains it */}
      <TypographyLink href={user ? join(link, "/api/auth/callback?token=" + user.token) : link}>
        {content()}
      </TypographyLink>
    </HeaderItem>
  );
};
