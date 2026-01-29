/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Tooltip, Typography } from "antd";
import NextLink from "next/link";
import { useEffect, useRef, useState } from "react";
import { antdBreakpoints } from "src/layouts/base/constants";
import { styled } from "styled-components";

export const HeaderItem = styled.div`
  @media (max-width: ${antdBreakpoints.md}px) {
    padding-right: 8px;
  }
  height: 36px;
 .ant-typography {
    color: #434343 !important;
    &:hover {
      color: #595959 !important;
    }
  }
`;

const Link = styled(NextLink)`
  display: flex;
  padding: 5px 12px;
  flex-wrap: wrap;
  overflow: hidden;
  align-items: center;
`;

const TypographyLink = styled(Typography.Link)`
  display: inline-block;
  height: 100%;
  width: 100%;
  padding: 5px 12px;
  flex-wrap: wrap;
  overflow: hidden;
  align-items: center;
`;

export const TextSpan = styled.span`
  margin: 0 2px;
`;

export const IconContainer = styled.span`
  font-size: 16px !important;
  align-items: center;
  margin-right: 6px;
`;

interface JumpToAnotherLinkProps {
  icon: React.ReactNode;
  href: string;
  text: React.ReactNode;
  hideText?: boolean;
  crossSystem?: boolean;
}

export const JumpToAnotherLink: React.FC<JumpToAnotherLinkProps> = ({ href, icon, text, hideText, crossSystem }) => {

  const [isSmallScreen, setIsSmallScreen] = useState(false);

  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const handler = (e: MediaQueryListEvent) => {
      setIsSmallScreen(e.matches);
    };
    const media = window.matchMedia(`(max-width: ${antdBreakpoints.md}px)`);

    media.addEventListener("change", handler);

    return () => {
      media.removeEventListener("change", handler);
    };
  }, []);

  const content = () => {
    return (
      <>
        {(hideText || isSmallScreen) ? (
          <Tooltip title={text}>
            <IconContainer>
              {icon}
            </IconContainer>
          </Tooltip>
        ) : (
          <>
            <IconContainer>
              {icon}
            </IconContainer>
            <TextSpan>
              {text}
            </TextSpan>
          </>
        )}</>
    );
  };

  if (!href) { return (
    <HeaderItem>
      <TypographyLink onClick={(e) => e.preventDefault()}>
        {content()}
      </TypographyLink>
    </HeaderItem>
  ); }

  return (
    <HeaderItem>
      {
        crossSystem ? (
          <TypographyLink href={href} ref={linkRef}>
            {content()}
          </TypographyLink>
        ) : (
          <Link href={href} ref={linkRef}>
            {content()}
          </Link>
        )
      }
    </HeaderItem>

  );
};
