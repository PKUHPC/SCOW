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

import { RefreshLink } from "@scow/lib-web/build/utils/refreshToken";
import { Typography } from "antd";
import React from "react";
import { useI18n } from "src/i18n";
import { styled } from "styled-components";

const Container = styled.div`
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

type PageTitleProps = React.PropsWithChildren<{
  beforeTitle?: React.ReactNode;
  titleText: React.ReactNode;
  isLoading?: boolean;
  reload?: () => void;
}>;

export const TitleText = styled(Typography.Title)`
  && {
    font-size: 20px;
  }
`;

export const PageTitle: React.FC<PageTitleProps> = ({
  beforeTitle, titleText, reload, children,
}) => {
  const languageId = useI18n().currentLanguage.id;
  return (
    <Container>
      <TitleText>
        {beforeTitle}
        {titleText}
      </TitleText>
      {children}
      { reload ? <RefreshLink refresh={reload} languageId={languageId} /> : undefined}
    </Container>
  );

};
