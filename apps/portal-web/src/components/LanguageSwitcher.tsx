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
  &:hover {
    background-color: #59595914 !important;
    border-radius: 8px;
  }

  .ant-select-single {
    height: 36px;
  }

  .ant-select-open .ant-select-selection-item {
    color: ${({ theme }) => theme.token.colorPrimary} !important;
  }

  .ant-select-selector {
    color: #434343 !important;
  }
`;

interface LanguageSwitcherProps {
  initialLanguage: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ initialLanguage }) => {
  const { setLanguageId } = useStore(LoginNodeStore);

  const i18n = useI18n();
  const currentLanguageId = i18n.currentLanguage.id || initialLanguage;
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguageId);

  const router = useRouter();

  useEffect(() => {
    setSelectedLanguage(currentLanguageId);
  }, [currentLanguageId]);

  const setLanguage = (newLocale: string) => {
    setSelectedLanguage(newLocale);
    i18n.setLanguageById(newLocale);
    setLanguageId(newLocale);
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
            <Select.Option key={id} value={id}>
              {name}
            </Select.Option>
          ))}
      </Select>
    </Container>
  );
};
