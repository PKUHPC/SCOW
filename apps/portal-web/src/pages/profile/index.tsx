import Profile from "@scow/lib-web/build/components/profile";
import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { useI18n } from "src/i18n";
import { publicConfig } from "src/utils/config";
import { getRuntimeI18nConfigText } from "src/utils/config";

export const ProfilePage: NextPage = requireAuth(() => true)(({ userStore: { user } }) => {
  const { data } = useAsync({
    promiseFn: useCallback(async () => api.getUserInfo({ query: { token: user.token, userId: user.identityId } }), []),
  });

  const userInfo = data?.userInfo;

  const languageId = useI18n().currentLanguage.id;

  return (
    <Profile
      user={{ ...userInfo, ...user }}
      languageId={languageId}
      publicConfig={publicConfig}
      api={{ checkPassword: api.checkPassword, changePassword: api.changePassword, changeEmail: api.changeEmail }}
      passwordPatternMessage={getRuntimeI18nConfigText(languageId, "passwordPatternMessage")}
    ></Profile>
  );
});

export default ProfilePage;
