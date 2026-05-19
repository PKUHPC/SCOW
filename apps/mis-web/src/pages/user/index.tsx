import { NextPage } from "next";
import { requireAuth } from "src/auth/requireAuth";
import { Redirect } from "src/components/Redirect";
import { useI18nTranslateToString } from "src/i18n";
import { userRoutes } from "src/layouts/routes";

export const IndexPage: NextPage = requireAuth(() => true)(({ userStore }) => {
  const t = useI18nTranslateToString();

  return <Redirect url={userRoutes(userStore.user.accountAffiliations, t)[2].children![0].path} />;
});

export default IndexPage;
