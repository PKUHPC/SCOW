"use client";

import { usePublicConfig } from "src/app/(auth)/context";
import { useUser } from "src/app/auth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { ForbiddenPage } from "src/layouts/error/ForbiddenPage";
import { PlatformRole } from "src/models/User";
import { useDocumentTitle } from "src/utils/head";

import { AssetContainer } from "../AssetContainer";
import { DatasetListTable } from "./DatasetListTable";

export default function Page() {
  const { publicConfig, currentAvailableClusterIds } = usePublicConfig();
  const t = useI18nTranslateToString();
  useDocumentTitle(t("routes.publicAsset.dataTitle"));

  const user = useUser();
  const isForbidden = !user.platformRoles?.includes(PlatformRole.PLATFORM_ADMIN);

  if (isForbidden) {
    return <ForbiddenPage />;
  }
  return (
    <>
      <PageTitle
        titleText={t("routes.publicAsset.dataTitle")}
      />
      <AssetContainer>
        <DatasetListTable
          clusters={publicConfig.CLUSTERS}
          currentClusterIds={currentAvailableClusterIds}
        />
      </AssetContainer>
    </>

  );
}
