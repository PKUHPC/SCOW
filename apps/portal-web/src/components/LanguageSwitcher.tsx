import { Select } from "antd";
import { useRouter } from "next/router";
import { setCookie } from "nookies";
import { useEffect, useState } from "react";
import { useStore } from "simstate";
import { languageInfo, useI18n } from "src/i18n";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { publicConfig } from "src/utils/config";
import { styled } from "styled-components";

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

  const { setLanguageId } = useStore(LoginNodeStore);

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
    setLanguageId(newLocale);
  };

  const setLanguageCookie = (newLocale: string) => {
    setCookie(null, "language", newLocale, {
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    router.replace(router.asPath);
  };

  const enabledLanguages = publicConfig.SYSTEM_LANGUAGE_CONFIG.enabledLanguages;

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
        {Object.entries(languageInfo)
          .filter(([id]) => enabledLanguages.includes(id))
          .map(([id, { name }]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
      </Select>
    </Container>
  );
};
