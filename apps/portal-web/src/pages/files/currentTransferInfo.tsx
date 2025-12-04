import { NextPage } from "next";
import { useStore } from "simstate";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { Redirect } from "src/components/Redirect";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { TransferInfoTable } from "src/pageComponents/filemanager/TransferInfoTable";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Head } from "src/utils/head";

const p = prefix("pages.files.currentTransferInfo.");

export const FileTransferPage: NextPage = requireAuth(() => true)(() => {

  const t = useI18nTranslateToString();

  const { crossClusterFileTransferEnabled } = useStore(ClusterInfoStore);

  if (!crossClusterFileTransferEnabled) {
    return <Redirect url={"/dashboard"} />;
  }

  return (
    <div>
      <Head title={t(p("checkTransfer"))} />
      <PageTitle titleText={t(p("checkTransfer"))} />
      <TransferInfoTable />
    </div>
  );

});

export default FileTransferPage;
