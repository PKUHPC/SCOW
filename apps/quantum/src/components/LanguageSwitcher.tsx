"use client";

import { Select } from "antd";
import { useRouter } from "next/router";
import { setCookie } from "nookies";
import { useEffect, useState } from "react";
import { languageInfo, useI18n } from "src/i18n";
import { styled } from "styled-components";


const Container = styled.div`
  white-space: nowrap;
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
    void i18n.setLanguageById(newLocale);
  };

  const setLanguageCookie = (newLocale: string) => {
    setCookie(null, "language", newLocale, {
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    void router.replace(router.asPath);
  };

  return (
    <Container>
      <Select
        style={{ border: "1px solid #DEDEDE", borderRadius:"5px", backgroundColor:"#fafafa", fontWeight:700 }}
        value={selectedLanguage}
        onChange={(value) => {
          setLanguage(value);
        }}
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
