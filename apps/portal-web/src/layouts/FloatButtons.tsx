import { AppFloatButtons } from "@scow/lib-web/build/layouts/AppFloatButtons";
import moon from "@scow/lib-web/icons/moon.svg";
import sunMoon from "@scow/lib-web/icons/sun-moon.svg";
import sun from "@scow/lib-web/icons/sun.svg";
import { useI18n } from "src/i18n";
import { publicConfig } from "src/utils/config";

interface FloatButtonProps {
  languageId: string;
}

export const FloatButtons: React.FC<FloatButtonProps> = ({ languageId }) => {
  const currentLangId = languageId ? languageId : useI18n().currentLanguage.id;
  return (
    <AppFloatButtons
      darkModeButtonProps={{
        dark: moon,
        light: sun,
        system: sunMoon,
        languageId: currentLangId,
        basePath: publicConfig.BASE_PATH,
      }}
    />
  );
};
