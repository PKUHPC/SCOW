"use client";

import { usePublicConfig } from "src/app/(auth)/context";
import { ModalTable } from "src/app/(auth)/publicAsset/model/ModelTable";
import { useUser } from "src/app/auth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { ForbiddenPage } from "src/layouts/error/ForbiddenPage";
import { PlatformRole } from "src/models/User";
import { useDocumentTitle } from "src/utils/head";

import { AssetContainer } from "../AssetContainer";

export default function Page() {
  const { publicConfig } = usePublicConfig();
  const t = useI18nTranslateToString();
  useDocumentTitle(t("routes.publicAsset.modelTitle"));

  const user = useUser();
  const isForbidden = !user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);

  if (isForbidden) {
    return <ForbiddenPage />;
  }

  return (
    <>
      <PageTitle titleText={t("routes.publicAsset.modelTitle")} />
      <AssetContainer>
        <ModalTable clusters={publicConfig.CLUSTERS} />
      </AssetContainer>
    </>
  );
}
