import Profile from "@scow/lib-web/build/components/profile";
import { NextPage } from "next";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { useI18n } from "src/i18n";
import { publicConfig } from "src/utils/config";
import { getRuntimeI18nConfigText } from "src/utils/config";

export const ProfilePage: NextPage = requireAuth(() => true)(({ userStore: { user } }) => {
  const languageId = useI18n().currentLanguage.id;

  return (
    <Profile
      user={user}
      languageId={languageId}
      publicConfig={publicConfig}
      api={{ checkPassword: api.checkPassword, changePassword: api.changePassword, changeEmail: api.changeEmail }}
      passwordPatternMessage={getRuntimeI18nConfigText(languageId, "passwordPatternMessage")}
    ></Profile>
  );
});

export default ProfilePage;
