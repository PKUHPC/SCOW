"use client";

import { usePublicConfig } from "src/app/(auth)/context";
import { AlgorithmTable } from "src/app/(auth)/publicAsset/algorithm/AlgorithmTable";
import { useUser } from "src/app/auth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { ForbiddenPage } from "src/layouts/error/ForbiddenPage";
import { PlatformRole } from "src/models/User";
import { useDocumentTitle } from "src/utils/head";

import { AssetContainer } from "../AssetContainer";

export default function Page() {
  const t = useI18nTranslateToString();
  useDocumentTitle(t("routes.publicAsset.algorithmTitle"));

  const user = useUser();
  const isForbidden = !user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);

  if (isForbidden) {
    return <ForbiddenPage />;
  }

  const { publicConfig } = usePublicConfig();

  return (
    <>
      <PageTitle titleText={t("routes.publicAsset.algorithmTitle")} />
      <AssetContainer>
        <AlgorithmTable clusters={publicConfig.CLUSTERS} />
      </AssetContainer>
    </>
  );
}
