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

import { Select, theme } from "antd";
import { useRouter } from "next/router";
import { setCookie } from "nookies";
import { useEffect, useState } from "react";
import { languageInfo, useI18n } from "src/i18n";
import { styled } from "styled-components";

const { useToken } = theme;

const Container = styled.div`
  white-space: nowrap;
  &:hover{
    background-color: #59595914 !important;
    border-radius: 8px;
  }

  .ant-select-single {
    height: 36px
  }

  .ant-select-open .ant-select-selection-item{
    color: ${({ theme }) => theme.token.colorPrimary } !important;
  }

  .ant-select-selector {
    color: #434343 !important;
  }
`;

interface LanguageSwitcherProps {
  initialLanguage: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ initialLanguage }) => {

  const [selectedLanguage, setSelectedLanguage] = useState("");

  const i18n = useI18n();

  const router = useRouter();

  useEffect(() => {
    const init = i18n.currentLanguage.id;
    if (init) {
      setSelectedLanguage(init);
    } else {
      const defaultLanguage = initialLanguage;
      setSelectedLanguage(defaultLanguage);
      setLanguageCookie(defaultLanguage);
    }
  }, [router]);

  const setLanguage = (newLocale: string) => {
    setSelectedLanguage(newLocale);
    setLanguageCookie(newLocale);
    i18n.setLanguageById(newLocale);
  };

  const setLanguageCookie = (newLocale: string) => {
    setCookie(null, "language", newLocale, {
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    router.replace(router.asPath);
  };

  return (
    <Container>
      <Select
        value={selectedLanguage}
        onChange={(value) => {
          setLanguage(value);
        }}
        variant="borderless"
        suffixIcon={null}
        popupMatchSelectWidth={false}
        popupClassName="head-language-select"
      >
        {Object.entries(languageInfo).map(([id, { name }]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </Select>
    </Container>
  );
};
