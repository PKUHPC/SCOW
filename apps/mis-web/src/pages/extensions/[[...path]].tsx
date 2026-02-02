import { ExtensionPage as LibExtensionPage } from "@scow/lib-web/build/extensions/ExtensionPage";
import { UiExtensionStore } from "@scow/lib-web/build/extensions/UiExtensionStore";
import { Loading } from "@scow/lib-web/build/layouts/base/Loading";
import { NextPage } from "next";
import { useStore } from "simstate";
import { NotFoundPage } from "src/components/errorPages/NotFoundPage";
import { useI18n } from "src/i18n";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";


export const ExtensionPage: NextPage = () => {
  const userStore = useStore(UserStore);

  const uiExtensionStore = useStore(UiExtensionStore);

  const i18n = useI18n();

  if (uiExtensionStore.isLoading) {
    return (
      <Loading />
    );
  }

  if (!uiExtensionStore.data) {
    return (
      <NotFoundPage />
    );
  }

  return (
    <LibExtensionPage
      uiExtensionStoreConfig={uiExtensionStore.data}
      user={userStore.user}
      currentLanguageId={i18n.currentLanguage.id}
      NotFoundPageComponent={NotFoundPage}
      titleTag={publicConfig?.UI_CONFIG?.titleTag}
    />
  );

};

export default ExtensionPage;
