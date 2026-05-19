"use client";
import Profile from "@scow/lib-web/build/components/profile";
import { usePublicConfig } from "src/app/(auth)/context";
import { useUser } from "src/app/auth";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";

export default function Page() {
  const t = useI18nTranslateToString();
  const p = prefix("app.profile.");

  const { publicConfig } = usePublicConfig();
  const languageId = useI18n().currentLanguage.id;

  const user = useUser();

  useDocumentTitle(t(p("title")));

  return (
    <Profile
      user={user}
      languageId={languageId}
      publicConfig={publicConfig}
      passwordPatternMessage={t(p("newPwPlaceholder"))}
      aiChangePassword={trpc.auth.changePassword}
      aiChangeEmail={trpc.auth.changeEmail}
    ></Profile>
  );
}
