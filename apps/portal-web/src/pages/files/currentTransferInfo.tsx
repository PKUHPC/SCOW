/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

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
